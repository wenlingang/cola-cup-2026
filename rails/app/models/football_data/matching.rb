module FootballData
  # Shared football-data payload helpers: map an external fixture onto one of
  # our matches via MatchIndex and orient its scores to our home/away sides.
  module Matching
    private

    # Returns [match_ref, fd_home_is_our_home] or [nil, nil] when unmatched.
    def locate_match(fd, index)
      home_name = fd.dig("homeTeam", "name")
      away_name = fd.dig("awayTeam", "name")
      home_id = home_name ? index.resolve_team(home_name) : nil
      away_id = away_name ? index.resolve_team(away_name) : nil
      return [ nil, nil ] if home_id.nil? || away_id.nil?

      match_ref = index.pair_match(home_id, away_id)
      return [ nil, nil ] if match_ref.nil?

      [ match_ref, home_id == match_ref[:home_id] ]
    end

    def our_scores(fd, fd_home_is_our_home)
      home, away = full_time_scores(fd)
      return [ nil, nil ] if home.nil? || away.nil?

      fd_home_is_our_home ? [ home, away ] : [ away, home ]
    end

    def full_time_scores(fd)
      full_time = fd.dig("score", "fullTime") || {}
      [ full_time["home"], full_time["away"] ]
    end
  end
end
