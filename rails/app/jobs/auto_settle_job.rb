# Scheduled (per match) when a result is recorded: settles the match after a
# grace delay with every voter included, exactly like a settler committing the
# single match from the admin with all participants selected. Safe to run more
# than once — it no-ops when the match is gone, already settled (manually or by
# an earlier run), or the result was cleared.
class AutoSettleJob < ApplicationJob
  queue_as :default

  DELAY = 10.minutes

  def self.schedule(match)
    set(wait: DELAY).perform_later(match.id)
  end

  def perform(match_id)
    match = Match.find_by(id: match_id)
    return if match.nil? || match.settled? || match.result.blank?

    result = Settlement.commit!([ match_id ], settler: nil)
    Rails.logger.info("[AutoSettleJob] match=#{match_id} settled (settlement=#{result.settlement.id})")
  rescue Settlement::CommitError => e
    Rails.logger.info("[AutoSettleJob] match=#{match_id} skipped: #{e.message}")
  end
end
