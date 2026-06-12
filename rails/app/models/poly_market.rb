class PolyMarket < ApplicationRecord
  belongs_to :match

  validates :match_id, uniqueness: true

  # 焦点大战: exactly one match — the top Polymarket volume of the nearest
  # Beijing calendar week (Monday start) that still has unfinished fixtures.
  # Weekly grouping keeps the volume comparison fair (it piles up as kickoff
  # nears), and a recorded result drops the match immediately, handing the
  # spotlight to the week's runner-up and eventually to the following week.
  def self.focus_match_ids
    rows = joins(:match)
      .where(matches: { settled: false, result: nil })
      .where(volume: 0.0001..)
      .pluck(:match_id, :volume, Arel.sql("matches.kickoff_at"))

    by_week = rows.group_by do |_, _, kickoff|
      kickoff.in_time_zone(FormatHelper::DISPLAY_TIME_ZONE).to_date.beginning_of_week
    end
    nearest_week = by_week.keys.min
    return Set.new if nearest_week.nil?

    Set[by_week[nearest_week].max_by { |_, volume, _| volume }.first]
  end
end
