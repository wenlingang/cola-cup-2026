require "rails_helper"

RSpec.describe SyncLiveScoresJob do
  let(:fd_url) { %r{api\.football-data\.org/v4/competitions/WC/matches\?dateFrom=} }
  let!(:brazil) { create(:team, name: "Brazil") }
  let!(:argentina) { create(:team, name: "Argentina") }

  def fixture(status:, home:, away:, winner: nil, home_name: "Brazil", away_name: "Argentina", id: 1)
    {
      id: id, status: status,
      homeTeam: { name: home_name }, awayTeam: { name: away_name },
      score: { winner: winner, fullTime: { home: home, away: away } }
    }
  end

  def payload(*fixtures)
    { matches: fixtures }.to_json
  end

  def live_payload(status: "IN_PLAY", home: 1, away: 0, winner: nil)
    payload(fixture(status: status, home: home, away: away, winner: winner))
  end

  around do |example|
    original = ENV["FOOTBALL_DATA_API_KEY"]
    ENV["FOOTBALL_DATA_API_KEY"] = "test-key"
    example.run
  ensure
    original ? ENV["FOOTBALL_DATA_API_KEY"] = original : ENV.delete("FOOTBALL_DATA_API_KEY")
  end

  it "makes no HTTP request when no match is inside the live window" do
    create(:match, home_team: brazil, away_team: argentina, kickoff_at: 3.days.from_now)

    SyncLiveScoresJob.perform_now

    expect(a_request(:get, fd_url)).not_to have_been_made
  end

  it "is a no-op without FOOTBALL_DATA_API_KEY" do
    ENV.delete("FOOTBALL_DATA_API_KEY")
    create(:match, home_team: brazil, away_team: argentina, kickoff_at: 30.minutes.ago)

    SyncLiveScoresJob.perform_now

    expect(a_request(:get, fd_url)).not_to have_been_made
  end

  describe "in-play fixtures" do
    it "updates the live score without recording a result or settling" do
      match = create(:match, home_team: brazil, away_team: argentina, kickoff_at: 30.minutes.ago)
      stub_request(:get, fd_url).to_return(status: 200, body: live_payload(home: 2, away: 1))

      expect { SyncLiveScoresJob.perform_now }.not_to have_enqueued_job(AutoSettleJob)

      match.reload
      expect(match.home_score).to eq(2)
      expect(match.away_score).to eq(1)
      expect(match.result).to be_nil
      expect(match.settled).to be(false)
      expect(match.status).to eq(:live)
    end

    it "never overwrites a match that already has a final result" do
      finished = create(:match, :with_result, home_team: brazil, away_team: argentina,
                        kickoff_at: 30.minutes.ago)
      # Another live fixture keeps possibly_live non-empty so the API call happens.
      germany = create(:team, name: "Germany")
      france = create(:team, name: "France")
      create(:match, home_team: germany, away_team: france, kickoff_at: 20.minutes.ago)
      stub_request(:get, fd_url).to_return(status: 200, body: live_payload(home: 9, away: 9))

      SyncLiveScoresJob.perform_now

      expect(finished.reload.home_score).to eq(2)
      expect(finished.reload.result).to eq("home")
    end
  end

  describe "FINISHED fixtures" do
    it "records the final result and enqueues settlement" do
      match = create(:match, home_team: brazil, away_team: argentina, kickoff_at: 30.minutes.ago)
      stub_request(:get, fd_url).to_return(
        status: 200, body: live_payload(status: "FINISHED", winner: "HOME_TEAM", home: 2, away: 1)
      )

      expect { SyncLiveScoresJob.perform_now }.to have_enqueued_job(AutoSettleJob).with(match.id)

      match.reload
      expect(match.result).to eq("home")
      expect(match.home_score).to eq(2)
      expect(match.away_score).to eq(1)
      expect(match.settled).to be(false)
      expect(match.status).to eq(:locked)
    end

    it "flips home/away when football-data's orientation is reversed" do
      # Our home = Argentina; football-data reports Brazil as home and winner.
      match = create(:match, home_team: argentina, away_team: brazil, kickoff_at: 30.minutes.ago)
      stub_request(:get, fd_url).to_return(
        status: 200, body: live_payload(status: "FINISHED", winner: "HOME_TEAM", home: 2, away: 1)
      )

      SyncLiveScoresJob.perform_now

      match.reload
      expect(match.result).to eq("away")
      expect(match.home_score).to eq(1)
      expect(match.away_score).to eq(2)
    end

    it "uses football-data's winner over the scoreline (covers ET/penalties)" do
      match = create(:match, :knockout, home_team: brazil, away_team: argentina, kickoff_at: 2.hours.ago)
      stub_request(:get, fd_url).to_return(
        status: 200, body: live_payload(status: "FINISHED", winner: "HOME_TEAM", home: 1, away: 1)
      )

      SyncLiveScoresJob.perform_now

      expect(match.reload.result).to eq("home")
    end

    it "does not touch an already-settled match" do
      settled = create(:match, :settled, home_team: brazil, away_team: argentina, home_score: 5, away_score: 0)
      # Another live fixture keeps possibly_live non-empty so the API call happens.
      germany = create(:team, name: "Germany")
      france = create(:team, name: "France")
      create(:match, home_team: germany, away_team: france, kickoff_at: 20.minutes.ago)
      stub_request(:get, fd_url).to_return(
        status: 200, body: live_payload(status: "FINISHED", winner: "HOME_TEAM", home: 2, away: 1)
      )

      expect { SyncLiveScoresJob.perform_now }
        .not_to(change { settled.reload.attributes.slice("result", "home_score", "away_score", "settled") })
    end
  end

  describe "mixed payload" do
    it "refreshes a live fixture and finalizes a finished one in one pass" do
      live = create(:match, home_team: brazil, away_team: argentina, kickoff_at: 30.minutes.ago)
      germany = create(:team, name: "Germany")
      france = create(:team, name: "France")
      finished = create(:match, home_team: germany, away_team: france, kickoff_at: 90.minutes.ago)

      stub_request(:get, fd_url).to_return(status: 200, body: payload(
        fixture(status: "IN_PLAY", home: 1, away: 1, id: 1),
        fixture(status: "FINISHED", winner: "HOME_TEAM", home: 3, away: 0,
                home_name: "Germany", away_name: "France", id: 2)
      ))

      expect { SyncLiveScoresJob.perform_now }.to have_enqueued_job(AutoSettleJob).with(finished.id)

      live.reload
      expect(live.home_score).to eq(1)
      expect(live.away_score).to eq(1)
      expect(live.result).to be_nil
      expect(live.status).to eq(:live)

      finished.reload
      expect(finished.result).to eq("home")
      expect(finished.home_score).to eq(3)
      expect(finished.status).to eq(:locked)
    end
  end
end
