# Enqueued (per match) the moment a final result is recorded — either from a
# football-data FINISHED fixture or a manual admin entry — and settles it right
# away with every voter included, exactly like a settler committing the single
# match from the admin with all participants selected. Safe to run more than
# once — it no-ops when the match is gone, already settled (manually or by an
# earlier run), or the result was cleared.
class AutoSettleJob < ApplicationJob
  queue_as :default

  def self.schedule(match)
    perform_later(match.id)
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
