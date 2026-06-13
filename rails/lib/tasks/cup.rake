# Operational tasks mirroring the legacy npm scripts. Each one runs a single
# external-data sync on demand (the same work the recurring jobs schedule).
namespace :cup do
  desc "Fetch current Polymarket World Cup odds (display only, never settles)"
  task fetch_odds: :environment do
    result = Polymarket::Sync.run
    puts "[cup:fetch_odds] events=#{result[:events]} matched=#{result[:matched]} unmatched=#{result[:unmatched]}"
  end

  desc "Sync live scores + final results from football-data.org (FINISHED fixtures record the result, which auto-settles)"
  task sync_live: :environment do
    result = FootballData::LiveScoresSync.run
    puts "[cup:sync_live] live_updated=#{result[:live_updated]} results_recorded=#{result[:results_recorded]} skipped=#{result[:skipped]} unmatched=#{result[:unmatched]}"
  end

  desc "Re-import teams + fixtures from openfootball over the network (idempotent upsert)"
  task import_schedule: :environment do
    result = Openfootball::ScheduleImport.run(source: :network)
    puts "[cup:import_schedule] teams=#{result[:teams]} matches=#{result[:matches]}"
  end
end
