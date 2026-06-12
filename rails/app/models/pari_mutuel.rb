# Pari-mutuel payout (pure, no writes): each loser forfeits exactly their stake
# into the pool; the winners split that pool in proportion to their stake. Each
# winner's share is floored to 0.01 bottles, so the total paid out can never
# exceed the pool — the house never subsidises (it keeps the sub-cent remainder,
# and the whole pool when nobody backed the winner). d_used is the implied pool
# decimal for the bettor's own pick (total pool ÷ that pick's stake).
module PariMutuel
  Delta = Struct.new(:user_id, :pick, :stake, :d_used, :won, :delta, keyword_init: true)

  # Absorbs float noise (e.g. 37.499999...) before flooring to hundredths.
  FLOAT_SLACK = 1e-9

  # `votes` is any enumerable of objects responding to user_id / pick / stake
  # (Vote records work directly). `result` is the winning pick string.
  def self.deltas(votes, result)
    total = votes.sum(&:stake)
    win_stake = votes.select { |v| v.pick == result }.sum(&:stake)
    lose_stake = total - win_stake

    stake_by_pick = Hash.new(0.0)
    votes.each { |v| stake_by_pick[v.pick] += v.stake }

    votes.map do |vote|
      won = vote.pick == result
      delta =
        if won
          win_stake.positive? ? floor_to_hundredth((vote.stake / win_stake) * lose_stake) : 0.0
        else
          -vote.stake
        end
      own_stake = stake_by_pick[vote.pick]
      d_used = own_stake.positive? ? total / own_stake : 1.0

      Delta.new(
        user_id: vote.user_id, pick: vote.pick, stake: vote.stake,
        d_used: d_used, won: won, delta: delta
      )
    end
  end

  def self.floor_to_hundredth(value)
    ((value * 100) + FLOAT_SLACK).floor / 100.0
  end
  private_class_method :floor_to_hundredth
end
