require "rails_helper"

RSpec.describe SyncResultsJob do
  let(:fd_url) { "https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED" }
  let!(:brazil) { create(:team, name: "Brazil") }
  let!(:argentina) { create(:team, name: "Argentina") }

  def finished_payload(winner: "HOME_TEAM", home: 2, away: 1, home_name: "Brazil", away_name: "Argentina")
    {
      matches: [ {
        id: 1, status: "FINISHED",
        homeTeam: { name: home_name }, awayTeam: { name: away_name },
        score: { winner: winner, fullTime: { home: home, away: away } }
      } ]
    }.to_json
  end

  context "without FOOTBALL_DATA_API_KEY" do
    # dotenv loads the real .env key in test, so unset it explicitly.
    around do |example|
      original = ENV.delete("FOOTBALL_DATA_API_KEY")
      example.run
    ensure
      ENV["FOOTBALL_DATA_API_KEY"] = original if original
    end

    it "is a no-op that makes no HTTP request" do
      result = FootballData::ResultsSync.run
      expect(result).to eq(recorded: 0, skipped: 0, unmatched: 0)
      expect(a_request(:get, %r{api\.football-data\.org})).not_to have_been_made
    end
  end

  context "with a key set" do
    around do |example|
      ENV["FOOTBALL_DATA_API_KEY"] = "test-key"
      example.run
    ensure
      ENV.delete("FOOTBALL_DATA_API_KEY")
    end

    it "sends the auth token and records the result + score without settling" do
      match = create(:match, home_team: brazil, away_team: argentina)
      stub = stub_request(:get, fd_url)
        .with(headers: { "X-Auth-Token" => "test-key" })
        .to_return(status: 200, body: finished_payload)

      SyncResultsJob.perform_now

      expect(stub).to have_been_requested
      match.reload
      expect(match.result).to eq("home")
      expect(match.home_score).to eq(2)
      expect(match.away_score).to eq(1)
      expect(match.settled).to be false
    end

    it "flips home/away when football-data's orientation is reversed" do
      match = create(:match, home_team: argentina, away_team: brazil) # our home = Argentina
      stub_request(:get, fd_url).to_return(status: 200, body: finished_payload(winner: "HOME_TEAM", home: 2, away: 1))

      SyncResultsJob.perform_now

      match.reload
      # FD home (Brazil) won; our home is Argentina -> our result "away", scores flipped.
      expect(match.result).to eq("away")
      expect(match.home_score).to eq(1)
      expect(match.away_score).to eq(2)
    end

    it "does not touch already-settled matches" do
      match = create(:match, :settled, home_team: brazil, away_team: argentina, home_score: 5, away_score: 0)
      stub_request(:get, fd_url).to_return(status: 200, body: finished_payload(winner: "HOME_TEAM", home: 2, away: 1))

      expect { SyncResultsJob.perform_now }
        .not_to(change { match.reload.attributes.slice("result", "home_score", "away_score", "settled") })
    end
  end
end
