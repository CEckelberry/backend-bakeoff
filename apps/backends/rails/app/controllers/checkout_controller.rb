class CheckoutController < ApplicationController
  def create
    params = request.body.read
    body = JSON.parse(params, symbolize_names: true)

    start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    result = tax_checkout_service.call(body)
    duration = Process.clock_gettime(Process::CLOCK_MONOTONIC) - start

    CHECKOUT_REQUESTS.increment(labels: { status: '201' })
    CHECKOUT_DURATION.observe(duration)

    render json: result, status: :created
  rescue ArgumentError => e
    CHECKOUT_REQUESTS.increment(labels: { status: '400' })
    render json: { error: e.message }, status: :bad_request
  rescue StandardError => e
    msg = e.message
    if msg.include?('stock') || msg.include?('Cart must') || msg.include?('not found')
      CHECKOUT_REQUESTS.increment(labels: { status: '422' })
      render json: { error: msg }, status: :unprocessable_entity
    else
      CHECKOUT_REQUESTS.increment(labels: { status: '500' })
      render json: { error: msg }, status: :internal_server_error
    end
  end

  private

  def tax_checkout_service
    @tax_checkout_service ||= CheckoutService.new(
      TaxClient.new(ENV.fetch('TAX_SERVICE_URL', 'http://tax-service:8080'))
    )
  end
end
