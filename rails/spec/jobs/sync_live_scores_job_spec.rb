require "rails_helper"

RSpec.describe SyncLiveScoresJob do
  let(:fd_url) { %r{api\.football-data\.org/v4/competitions/WC/matches\?dateFrom=} }
  let!(:brazil) { create(:team, name: "Brazil") }
  let!(:argentina) { create(:team, name: "Argentina") }

  def live_payload(status: "IN_PLAY", home: 1, away: 0)
    {
      matches: [ {
        id: 1, status: status,
        homeTeam: { name: "Brazil" }, awayTeam: { name: "Argentina" },
        score: { winner: nil, fullTime: { home: home, away: away } }
      } ]
    }.to_json
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

  it "ignores FINISHED fixtures (those belong to the results sync)" do
    match = create(:match, home_team: brazil, away_team: argentina, kickoff_at: 30.minutes.ago)
    stub_request(:get, fd_url).to_return(status: 200, body: live_payload(status: "FINISHED", home: 2, away: 1))

    SyncLiveScoresJob.perform_now

    match.reload
    expect(match.home_score).to be_nil
    expect(match.result).to be_nil
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

  it "is a no-op without FOOTBALL_DATA_API_KEY" do
    ENV.delete("FOOTBALL_DATA_API_KEY")
    create(:match, home_team: brazil, away_team: argentina, kickoff_at: 30.minutes.ago)

    SyncLiveScoresJob.perform_now

    expect(a_request(:get, fd_url)).not_to have_been_made
  end
end
