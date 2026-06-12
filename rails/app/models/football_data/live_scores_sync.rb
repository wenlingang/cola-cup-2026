module FootballData
  # Refreshes the live score of in-play World Cup matches from football-data.
  # Scores only — the result (the "finished" marker that feeds the settle list
  # and auto-settlement) is recorded exclusively by ResultsSync from FINISHED
  # fixtures, so a live score can never settle a match early. Skips the API
  # call entirely when no fixture is inside the live window.
  class LiveScoresSync
    include Matching

    LIVE_STATUSES = %w[IN_PLAY PAUSED EXTRA_TIME PENALTY_SHOOTOUT].to_set.freeze

    def self.run
      new.run
    end

    def run
      return idle unless Match.possibly_live.exists?

      key = ENV["FOOTBALL_DATA_API_KEY"]
      if key.blank?
        Rails.logger.info("[FootballData::LiveScoresSync] FOOTBALL_DATA_API_KEY not set — skipping.")
        return idle
      end

      today = Time.current.utc.to_date
      data = HttpJson.get(
        "#{ResultsSync::BASE}/competitions/#{ResultsSync::WORLD_CUP_CODE}/matches" \
        "?dateFrom=#{today - 1}&dateTo=#{today + 1}",
        headers: { "X-Auth-Token" => key }
      )
      in_play = Array(data["matches"]).select { |fd| LIVE_STATUSES.include?(fd["status"]) }
      index = MatchIndex.build

      updated = 0
      skipped = 0
      unmatched = 0

      in_play.each do |fd|
        match_ref, fd_home_is_our_home = locate_match(fd, index)
        if match_ref.nil?
          unmatched += 1
          next
        end

        match = Match.find_by(id: match_ref[:match_id])
        home_score, away_score = our_scores(fd, fd_home_is_our_home)
        if match&.record_live_score!(home_score: home_score, away_score: away_score)
          updated += 1
        else
          skipped += 1
        end
      end

      Rails.logger.info(
        "[FootballData::LiveScoresSync] in_play=#{in_play.size} updated=#{updated} " \
        "skipped=#{skipped} unmatched=#{unmatched}"
      )
      { updated: updated, skipped: skipped, unmatched: unmatched }
    end

    private

    def idle
      { updated: 0, skipped: 0, unmatched: 0 }
    end
  end
end
