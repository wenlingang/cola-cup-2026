module Polymarket
  # Maps one Polymarket moneyline event onto a DB match and extracts the
  # home/draw/away implied probabilities. Ported from the matching half of the
  # legacy src/scripts/matchPolymarket.ts.
  module Matcher
    MatchedOdds = Data.define(
      :match_id, :event_id, :slug, :volume,
      :p_home, :p_draw, :p_away,
      :token_home, :token_draw, :token_away,
      :condition_id, :score
    )

    # A moneyline event slug ends in a date (e.g. "...-2026-06-11") and the
    # event carries a 2-way (knockout) or 3-way (group) market set.
    MONEYLINE_SLUG = /-\d{4}-\d{2}-\d{2}\z/
    TITLE_SPLIT = /\s+vs\.?\s+/i

    module_function

    def moneyline_event?(event)
      MONEYLINE_SLUG.match?(event[:slug].to_s) &&
        event[:markets].to_a.size.between?(2, 3)
    end

    def match_event(event, index)
      home_name, away_name = split_title(event[:title])
      return nil if home_name.blank? || away_name.blank?

      id1 = index.resolve_team(home_name)
      id2 = index.resolve_team(away_name)
      return nil if id1.nil? || id2.nil?

      match_ref = index.pair_match(id1, id2)
      return nil if match_ref.nil?

      draw_market = nil
      win_markets = []
      event[:markets].each do |market|
        draw_market?(market) ? draw_market = market : win_markets << market
      end

      home_market, away_market = assign_win_markets(win_markets, event, index, match_ref[:home_id])

      p_home = parse_price(home_market)
      p_away = parse_price(away_market)
      p_draw = parse_price(draw_market)
      return nil if p_home.nil? || p_away.nil?

      MatchedOdds.new(
        match_id: match_ref[:match_id],
        event_id: event[:id],
        slug: event[:slug],
        volume: event[:volume],
        p_home: p_home,
        p_draw: p_draw,
        p_away: p_away,
        token_home: home_market&.dig(:clob_token_ids)&.first,
        token_draw: draw_market&.dig(:clob_token_ids)&.first,
        token_away: away_market&.dig(:clob_token_ids)&.first,
        condition_id: home_market&.dig(:condition_id) || event[:id],
        score: 1
      )
    end

    # Assign the two win markets to home/away by which team name appears in the
    # market question; fall back to positional order when the name match fails.
    def assign_win_markets(win_markets, event, index, home_team_id)
      home_norm = norm_for_id(event, index, home_team_id)
      home_market = nil
      away_market = nil
      win_markets.each do |market|
        question = MatchIndex.normalize(market[:question])
        if home_norm && question.include?(home_norm)
          home_market = market
        else
          away_market = market
        end
      end
      return [ win_markets[0], win_markets[1] ] if home_market.nil? && win_markets.size == 2

      [ home_market, away_market ]
    end

    def split_title(title)
      title.to_s.split(TITLE_SPLIT)
    end

    def draw_market?(market)
      market[:slug].to_s.end_with?("-draw") || /draw/i.match?(market[:question].to_s)
    end

    def norm_for_id(event, index, team_id)
      home_name, away_name = split_title(event[:title])
      return MatchIndex.normalize(home_name) if index.resolve_team(home_name) == team_id
      return MatchIndex.normalize(away_name) if index.resolve_team(away_name) == team_id

      nil
    end

    def parse_price(market)
      return nil if market.nil?

      raw = market[:outcome_prices].to_a.first
      return nil if raw.nil?

      value = Float(raw, exception: false)
      value&.finite? ? value : nil
    end
  end
end
