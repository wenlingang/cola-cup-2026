require "rails_helper"

RSpec.describe PolyMarket do
  def market_for(match, volume:)
    PolyMarket.create!(match: match, volume: volume)
  end

  describe ".focus_match_ids" do
    it "returns only the nearest week's top-volume match" do
      # 2026-06-15 is a Monday; 6/12-6/14 belong to the prior week.
      week1_small = create(:match, kickoff_at: Time.utc(2026, 6, 12, 12, 0))
      week1_big   = create(:match, kickoff_at: Time.utc(2026, 6, 14, 9, 0))
      week2_huge  = create(:match, kickoff_at: Time.utc(2026, 6, 16, 12, 0))
      market_for(week1_small, volume: 100.0)
      market_for(week1_big, volume: 900.0)
      market_for(week2_huge, volume: 99_999.0)

      expect(described_class.focus_match_ids).to eq(Set[week1_big.id])
    end

    it "hands the spotlight to the runner-up once the focus match finishes" do
      runner_up = create(:match, kickoff_at: Time.utc(2026, 6, 12, 12, 0))
      finished  = create(:match, :with_result, kickoff_at: Time.utc(2026, 6, 14, 9, 0))
      market_for(runner_up, volume: 100.0)
      market_for(finished, volume: 900.0)

      expect(described_class.focus_match_ids).to eq(Set[runner_up.id])
    end

    it "assigns weeks by Beijing calendar day, not UTC" do
      # Sunday 6/14 16:30 UTC is Monday 6/15 00:30 Beijing — next week's slate,
      # so the lower-volume same-week match still wins the nearest week.
      utc_sunday = create(:match, kickoff_at: Time.utc(2026, 6, 14, 16, 30))
      this_week  = create(:match, kickoff_at: Time.utc(2026, 6, 12, 12, 0))
      market_for(utc_sunday, volume: 900.0)
      market_for(this_week, volume: 100.0)

      expect(described_class.focus_match_ids).to eq(Set[this_week.id])
    end

    it "skips settled matches and missing/zero volume" do
      settled = create(:match, :settled)
      market_for(settled, volume: 9_999.0)
      zero = create(:match)
      market_for(zero, volume: 0.0)
      no_volume = create(:match)
      market_for(no_volume, volume: nil)
      hot = create(:match)
      market_for(hot, volume: 50.0)

      expect(described_class.focus_match_ids).to eq(Set[hot.id])
    end

    it "is empty when nothing qualifies" do
      expect(described_class.focus_match_ids).to eq(Set.new)
    end
  end
end
