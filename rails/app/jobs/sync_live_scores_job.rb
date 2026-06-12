class SyncLiveScoresJob < ApplicationJob
  queue_as :default

  def perform
    result = FootballData::LiveScoresSync.run
    Rails.logger.info(
      "[SyncLiveScoresJob] updated=#{result[:updated]} skipped=#{result[:skipped]} unmatched=#{result[:unmatched]}"
    )
  end
end
