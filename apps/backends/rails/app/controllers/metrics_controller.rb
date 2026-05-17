require 'prometheus/client/formats/text'

class MetricsController < ApplicationController
  def show
    ProcessMetrics.update
    output = Prometheus::Client::Formats::Text.marshal(PROMETHEUS_REGISTRY)
    render plain: output, content_type: 'text/plain; version=0.0.4'
  end
end
