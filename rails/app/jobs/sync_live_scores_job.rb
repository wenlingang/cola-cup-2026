class SyncLiveScoresJob < ApplicationJob
  queue_as :default

  def perform
    result = FootballData::LiveScoresSync.run
    Rails.logger.info(
      "[SyncLiveScoresJob] live_updated=#{result[:live_updated]} " \
      "results_recorded=#{result[:results_recorded]} skipped=#{result[:skipped]} " \
      "unmatched=#{result[:unmatched]}"
    )
  end
end
