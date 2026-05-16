Rails.application.configure do
  config.cache_classes = true
  config.eager_load = true
  config.consider_all_requests_local = false
  config.log_level = ENV.fetch('LOG_LEVEL', 'info').to_sym
  config.log_tags = [:request_id]
  config.active_record.dump_schema_after_migration = false
end
