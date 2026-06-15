class PolyMarket < ApplicationRecord
  belongs_to :match

  validates :match_id, uniqueness: true

  FOCUS_CACHE_KEY = "focus_match_ids/v1".freeze
  # Inputs change slowly (volume refreshes hourly via FetchOddsJob; a result drops
  # a match) and the focus marker is a cosmetic 🔥 where a few minutes of staleness
  # is harmless — so a short TTL beats threading explicit invalidation through every
  # odds/result write. It also collapses the repeated JOIN this runs during a
  # settlement, which re-renders card_teams (and thus calls focus_match?) per match.
  FOCUS_CACHE_TTL = 5.minutes

  # 焦点大战: exactly one match — the top Polymarket volume of the nearest
  # Beijing calendar week (Monday start) that still has unfinished fixtures.
  # Weekly grouping keeps the volume comparison fair (it piles up as kickoff
  # nears), and a recorded result drops the match immediately, handing the
  # spotlight to the week's runner-up and eventually to the following week.
  def self.focus_match_ids
    Rails.cache.fetch(FOCUS_CACHE_KEY, expires_in: FOCUS_CACHE_TTL) { compute_focus_match_ids }
  end

  def self.compute_focus_match_ids
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
