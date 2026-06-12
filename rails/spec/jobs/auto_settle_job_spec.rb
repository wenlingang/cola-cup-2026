require "rails_helper"

RSpec.describe AutoSettleJob do
  let(:match) { create(:match, :with_result, kickoff_at: 2.hours.ago) }
  let(:home1) { create(:user) }
  let(:home2) { create(:user) }
  let(:away1) { create(:user) }

  def vote_all
    create(:vote, match: match, user: home1, pick: "home", stake: 1.0)
    create(:vote, match: match, user: home2, pick: "home", stake: 1.0)
    create(:vote, match: match, user: away1, pick: "away", stake: 1.0)
  end

  it "settles the match including every voter" do
    vote_all

    described_class.perform_now(match.id)

    match.reload
    expect(match.settled).to be(true)
    expect(match.settlement).to be_present
    expect(match.settlement.created_by).to be_nil
    expect(LedgerEntry.where(match: match).pluck(:user_id))
      .to match_array([ home1.id, home2.id, away1.id ])
  end

  it "no-ops when the match is already settled" do
    settled = create(:match, :settled)

    expect { described_class.perform_now(settled.id) }
      .not_to change(Settlement, :count)
  end

  it "no-ops when the match has no result or is gone" do
    pending_match = create(:match)

    expect { described_class.perform_now(pending_match.id) }
      .not_to change(Settlement, :count)
    expect { described_class.perform_now(-1) }
      .not_to change(Settlement, :count)
  end

  describe "scheduling from Match#record_result!" do
    it "enqueues an immediate auto-settle per recorded result" do
      fresh = create(:match, kickoff_at: 2.hours.ago)

      expect {
        fresh.record_result!(home_score: 1, away_score: 0)
      }.to have_enqueued_job(described_class).with(fresh.id).once

      enqueued = enqueued_jobs.find { |job| job["job_class"] == "AutoSettleJob" }
      expect(enqueued["scheduled_at"]).to be_nil
    end

    it "does not enqueue when recording fails" do
      settled = create(:match, :settled)

      expect {
        expect { settled.record_result!(home_score: 1, away_score: 0) }
          .to raise_error(Match::DomainError)
      }.not_to have_enqueued_job(described_class)
    end
  end
end
