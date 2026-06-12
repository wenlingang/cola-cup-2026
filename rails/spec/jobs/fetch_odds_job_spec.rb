require "rails_helper"

RSpec.describe FetchOddsJob do
  let!(:brazil) { create(:team, name: "Brazil") }
  let!(:argentina) { create(:team, name: "Argentina") }
  let!(:match) { create(:match, home_team: brazil, away_team: argentina) }

  def event_payload
    [ {
      id: "evt-1",
      slug: "brazil-vs-argentina-2026-06-11",
      title: "Brazil vs. Argentina",
      volume: "123456.78",
      markets: [
        { slug: "x-brazil", question: "Will Brazil win?",
          outcomes: %w[Yes No].to_json, outcomePrices: [ "0.55", "0.45" ].to_json,
          clobTokenIds: [ "tk-bra" ].to_json, conditionId: "c1" },
        { slug: "x-draw", question: "Will it be a draw?",
          outcomes: %w[Yes No].to_json, outcomePrices: [ "0.25", "0.75" ].to_json,
          clobTokenIds: [ "tk-draw" ].to_json, conditionId: "c2" },
        { slug: "x-argentina", question: "Will Argentina win?",
          outcomes: %w[Yes No].to_json, outcomePrices: [ "0.20", "0.80" ].to_json,
          clobTokenIds: [ "tk-arg" ].to_json, conditionId: "c3" }
      ]
    } ].to_json
  end

  before do
    stub_request(:get, %r{gamma-api\.polymarket\.com/events})
      .to_return(status: 200, body: event_payload, headers: { "Content-Type" => "application/json" })
  end

  it "writes the poly_market mapping and a display-only polymarket snapshot for the matched fixture" do
    expect { FetchOddsJob.perform_now }
      .to change { OddsSnapshot.where(source: "polymarket").count }.by(1)

    poly = match.reload.poly_market
    expect(poly).to be_present
    expect(poly.match_method).to eq("auto")
    expect(poly.token_home).to eq("tk-bra")
    expect(poly.condition_id).to eq("c1")
    expect(poly.closed).to be false
    expect(poly.volume).to be_within(1e-6).of(123_456.78)

    snapshot = match.odds_snapshots.where(source: "polymarket").order(:taken_at).last
    expect(snapshot.locked).to be false
    expect(snapshot.p_home).to be_within(1e-9).of(0.55)
    expect(snapshot.p_draw).to be_within(1e-9).of(0.25)
    expect(snapshot.p_away).to be_within(1e-9).of(0.20)
    expect(snapshot.d_home).to be_within(1e-6).of(1.0 / 0.55)
  end

  it "refreshes the existing poly_market row instead of duplicating it (snapshots accumulate as history)" do
    FetchOddsJob.perform_now

    expect { FetchOddsJob.perform_now }
      .to change { OddsSnapshot.where(source: "polymarket").count }.by(1)
      .and change { PolyMarket.count }.by(0)
  end

  it "stops refreshing market odds once the vote window has closed" do
    match.update!(kickoff_at: 30.minutes.from_now)

    expect { FetchOddsJob.perform_now }
      .not_to change { OddsSnapshot.where(source: "polymarket").count }
  end
end
