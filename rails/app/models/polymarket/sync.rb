module Polymarket
  # Pulls current World Cup moneyline probabilities from Polymarket's Gamma API
  # and stores them as display-only odds. Ported from src/lib/jobs/fetchOdds.ts.
  # Writes upsert poly_markets metadata + a fresh odds_snapshots row per match;
  # it never locks odds and never settles.
  class Sync
    GAMMA = "https://gamma-api.polymarket.com".freeze
    WORLD_CUP_SERIES_ID = "11433".freeze
    PAGE_SIZE = 100
    PAGE_DELAY = 0.5

    MIN_PROB = 0.001
    MAX_PROB = 0.999

    def self.run
      new.run
    end

    def run
      index = MatchIndex.build
      events = fetch_all_events

      matched = []
      unmatched = 0
      events.select { |event| Matcher.moneyline_event?(event) }.each do |event|
        result = Matcher.match_event(event, index)
        result ? matched << result : unmatched += 1
      end

      write_odds(matched)
      { events: events.size, matched: matched.size, unmatched: unmatched }
    end

    private

    def fetch_all_events
      events = []
      offset = 0
      loop do
        url = "#{GAMMA}/events?series_id=#{WORLD_CUP_SERIES_ID}&limit=#{PAGE_SIZE}&offset=#{offset}&closed=false"
        data = HttpJson.get(url)
        page = data.is_a?(Array) ? data : Array(data["data"])
        break if page.empty?

        page.each { |raw| events << shape_event(raw) }
        break if page.size < PAGE_SIZE

        offset += PAGE_SIZE
        sleep(PAGE_DELAY)
      end
      events
    end

    def shape_event(raw)
      markets = Array(raw["markets"]).map do |market|
        {
          slug: market["slug"],
          question: market["question"],
          outcomes: parse_json_array(market["outcomes"]),
          outcome_prices: parse_json_array(market["outcomePrices"]),
          clob_token_ids: parse_json_array(market["clobTokenIds"]),
          condition_id: market["conditionId"]
        }
      end
      {
        id: raw["id"].to_s, slug: raw["slug"], title: raw["title"],
        volume: parse_volume(raw), markets: markets
      }
    end

    def parse_volume(raw)
      value = raw["volume"] || raw["volumeNum"]
      value.nil? ? nil : value.to_f
    end

    def parse_json_array(value)
      return value if value.is_a?(Array)

      if value.is_a?(String)
        parsed = begin
          JSON.parse(value)
        rescue JSON::ParserError
          nil
        end
        return parsed.is_a?(Array) ? parsed : []
      end
      []
    end

    # Market odds stop refreshing once a match's vote window has closed (1h
    # before kickoff): the binding line is already frozen by ensure_locked_odds!
    # and in-play prices would just mirror the unfolding result.
    def write_odds(matched)
      taken_at = Time.current
      matches_by_id = Match.where(id: matched.map(&:match_id)).index_by(&:id)
      ActiveRecord::Base.transaction do
        matched.each do |row|
          match = matches_by_id[row.match_id]
          next if match.nil? || taken_at >= match.vote_closes_at

          PolyMarket.find_or_initialize_by(match_id: row.match_id).update!(
            event_id: row.event_id,
            slug: row.slug,
            condition_id: row.condition_id,
            token_home: row.token_home,
            token_draw: row.token_draw,
            token_away: row.token_away,
            match_method: "auto",
            match_score: row.score,
            volume: row.volume,
            closed: false
          )
          OddsSnapshot.create!(
            match_id: row.match_id,
            source: "polymarket",
            locked: false,
            p_home: row.p_home,
            p_draw: row.p_draw,
            p_away: row.p_away,
            d_home: price_to_decimal(row.p_home),
            d_draw: row.p_draw.nil? ? nil : price_to_decimal(row.p_draw),
            d_away: price_to_decimal(row.p_away),
            taken_at: taken_at
          )
        end
      end
    end

    def price_to_decimal(price)
      1.0 / clamp_prob(price)
    end

    def clamp_prob(price)
      return MIN_PROB unless price.is_a?(Numeric) && price.finite?

      price.clamp(MIN_PROB, MAX_PROB)
    end
  end
end
