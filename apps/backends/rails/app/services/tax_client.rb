require 'net/http'
require 'json'
require 'uri'

class TaxClient
  def initialize(base_url)
    uri = URI.parse(base_url)
    @http = Net::HTTP.new(uri.host, uri.port)
    @http.open_timeout = 5
    @http.read_timeout = 5
    @base_url = base_url
  end

  def calculate(subtotal_cents:, state:)
    uri = URI.parse("#{@base_url}/tax")
    req = Net::HTTP::Post.new(uri.path, 'Content-Type' => 'application/json')
    req.body = { subtotal_cents: subtotal_cents, state: state }.to_json

    resp = @http.request(req)
    raise "Tax service error: #{resp.code}" unless resp.is_a?(Net::HTTPSuccess)

    JSON.parse(resp.body, symbolize_names: true)
  end
end
