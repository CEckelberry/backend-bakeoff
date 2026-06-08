class ApplicationController < ActionController::API
  around_action :record_http_metrics

  private

  def record_http_metrics
    start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    yield
  ensure
    duration = Process.clock_gettime(Process::CLOCK_MONOTONIC) - start
    endpoint = request.path.gsub(/\/[0-9a-f-]{8,}/, '/:id')
    status = response.status.to_s
    HTTP_REQUESTS_TOTAL.increment(labels: { method: request.method, endpoint: endpoint, status: status })
    HTTP_REQUEST_DURATION_SECONDS.observe(duration, labels: { method: request.method, endpoint: endpoint })
  end
end
