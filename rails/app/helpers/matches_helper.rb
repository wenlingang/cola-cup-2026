module MatchesHelper
  # status (Match#status symbol) => [css modifier, label]. Ported from
  # matchState.ts STATUS_META + StatusBadge.BADGE_CLASS (upcoming reuses the
  # "scheduled" badge styling).
  STATUS_BADGE = {
    scheduled: [ "scheduled", "未开放" ],
    upcoming:  [ "scheduled", "待开盘" ],
    open:      [ "open", "可预测" ],
    live:      [ "live", "比赛中" ],
    locked:    [ "locked", "已截止" ],
    settled:   [ "settled", "已结算" ]
  }.freeze

  PICK_SHORT = { "home" => "主", "draw" => "平", "away" => "客" }.freeze
  RESULT_LABEL = { "home" => "主胜", "draw" => "平局", "away" => "客胜" }.freeze
  DIVERGENCE_TIP = "市场（聪明钱）与同事看法分歧大 —— 用同事赔率下注可能赢更多可乐".freeze
  GROUP_RE = /Group ([A-L])/.freeze

  def status_badge(status, extra_class: nil)
    css, label = STATUS_BADGE.fetch(status)
    tag.span(label, class: [ "badge", css, extra_class ].compact.join(" "))
  end

  # 焦点大战: top Polymarket-volume unsettled matches. Memoized per render so a
  # full schedule page costs one query; broadcast re-renders work the same way.
  def focus_match?(match)
    @_focus_match_ids ||= PolyMarket.focus_match_ids
    @_focus_match_ids.include?(match.id)
  end

  def match_group_letter(match)
    match.group_name&.match(GROUP_RE)&.captures&.first
  end

  def team_display_name(team, label)
    team&.display_name.presence || label.presence || ""
  end

  def team_flag(team)
    team&.flag.presence || "🏳️"
  end

  # The "VS" / score middle token on a schedule card (shows the score as soon as
  # it is recorded).
  def match_score_token(match)
    if match.home_score && match.away_score
      "#{match.home_score}–#{match.away_score}"
    else
      "VS"
    end
  end

  # Detail-page middle token — shows the live score while in play and the final
  # score once settled; hides it in between so a pre-settlement correction
  # isn't presented as final.
  def detail_score_token(match)
    if (match.settled? || match.live?) && match.home_score && match.away_score
      "#{match.home_score}–#{match.away_score}"
    else
      "VS"
    end
  end

  # Outcome label for a pick: the team's display name, or 平局 for a draw.
  def pick_team_label(match, key)
    case key
    when "home" then team_display_name(match.home_team, match.home_label)
    when "away" then team_display_name(match.away_team, match.away_label)
    else "平局"
    end
  end

  # Describes the giant right-hand block on a schedule card. Mirrors
  # ScheduleTimeline.MatchBig: result > market leader (+divergence) > crowd
  # leader > nothing.
  def match_card_big(match, tally, market_snapshot)
    # No cap once settled — the meta line's status badge already says 已结算.
    return { kind: :result, label: RESULT_LABEL[match.result], cap: match.settled? ? nil : "待结算" } if match.result.present?

    allows_draw = match.allows_draw?
    market = market_pcts(market_snapshot, allows_draw)
    leader = market && market_leader(market)
    if leader
      return {
        kind: :market,
        short: PICK_SHORT[leader[:pick]],
        pct: leader[:pct],
        divergence: divergence_label(match, market, tally, allows_draw, leader[:pick])
      }
    end

    crowd = crowd_leader(tally, allows_draw)
    if crowd
      crowd_odds = VoteOdds.from_tally(tally, allows_draw: allows_draw)
      decimal = crowd_odds&.public_send("d_#{crowd[:pick]}")
      return {
        kind: :crowd,
        short: PICK_SHORT[crowd[:pick]],
        pct: crowd[:pct],
        cap: decimal ? "赔率 #{format_decimal(decimal)}x" : "暂无市场对照"
      }
    end

    { kind: :none }
  end

  # --- detail-page odds comparison (ported from OddsCompare.tsx) ---

  def odds_clamp_width(probability)
    return 0 if probability.nil?

    (probability.clamp(0.0, 1.0) * 100).round
  end

  def odds_pct_text(probability)
    probability.nil? ? "—" : "#{(probability.clamp(0.0, 1.0) * 100).round}%"
  end

  # Outcome to feature (largest bar): highest market probability, else highest
  # crowd probability, else -1.
  def odds_featured_index(outcomes)
    max_index_by(outcomes) { |o| o[:market_p] } ||
      max_index_by(outcomes) { |o| o[:crowd_p] } || -1
  end

  # Outcome with the widest market-vs-crowd gap (crowd must have stake).
  def odds_lead_index(outcomes)
    best_index = -1
    best_diff = -1
    outcomes.each_with_index do |o, i|
      next if o[:crowd_p].nil? || o[:crowd_p] <= 0 || o[:market_p].nil?

      diff = (o[:market_p] - o[:crowd_p]).abs
      best_index, best_diff = i, diff if diff > best_diff
    end
    best_index
  end

  def odds_lead_label(crowd_p, market_p, featured)
    return nil if crowd_p.nil? || market_p.nil?

    diff = ((market_p - crowd_p) * 100).round
    return nil if diff.abs < VoteOdds::LEAD_DIVERGENCE_PCT

    if diff > 0
      tag.span("市场更看好", class: [ "o-lead", "mk-lead", ("strong" if featured) ].compact.join(" "))
    else
      tag.span("同事更看好", class: "o-lead cr-lead")
    end
  end

  private

  def max_index_by(outcomes)
    best_index = nil
    best_value = nil
    outcomes.each_with_index do |o, i|
      value = yield(o)
      next if value.nil?

      best_index, best_value = i, value if best_value.nil? || value > best_value
    end
    best_index
  end

  def odds_pct(probability)
    probability.nil? ? nil : (probability * 100).round
  end

  def market_pcts(snapshot, allows_draw)
    return nil unless snapshot

    {
      "home" => odds_pct(snapshot.p_home),
      "draw" => allows_draw ? odds_pct(snapshot.p_draw) : nil,
      "away" => odds_pct(snapshot.p_away)
    }
  end

  def market_leader(market)
    best = nil
    Match::PICKS.each do |pick|
      value = market[pick]
      next if value.nil?
      best = { pick: pick, pct: value } if best.nil? || value > best[:pct]
    end
    best
  end

  def crowd_leader(tally, allows_draw)
    return nil unless tally.stake_total.positive?

    entries = { "home" => tally.home, "draw" => allows_draw ? tally.draw : -1, "away" => tally.away }
    pick, value = entries.max_by { |_, v| v }
    { pick: pick, pct: (value / tally.stake_total * 100).round }
  end

  # Largest market-vs-crowd gap; returns the spark label when it clears the
  # LEAD_DIVERGENCE_PCT threshold, else nil.
  def divergence_label(_match, market, tally, allows_draw, leader_pick)
    best = nil
    Match::PICKS.each do |pick|
      market_pct = market[pick]
      crowd_pct = crowd_pct_for(tally, pick, allows_draw)
      next if market_pct.nil? || crowd_pct.nil? || crowd_pct <= 0

      diff = market_pct - crowd_pct
      best = { pick: pick, diff: diff } if best.nil? || diff.abs > best[:diff].abs
    end
    return nil if best.nil? || best[:diff].abs < VoteOdds::LEAD_DIVERGENCE_PCT

    market_leads = best[:diff] > 0
    same_as_shown = best[:pick] == leader_pick
    text = (market_leads ? "市场更看好" : "同事更看好") + (same_as_shown ? "" : PICK_SHORT[best[:pick]])
    { tone: market_leads ? "mk" : "cr", text: text }
  end

  def crowd_pct_for(tally, pick, allows_draw)
    return nil if tally.voters.zero?
    return nil if pick == "draw" && !allows_draw

    (tally.public_send(pick) / tally.stake_total * 100).round
  end
end
