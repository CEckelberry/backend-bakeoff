class ReportsController < ApplicationController
  def revenue
    rows = ActiveRecord::Base.connection.execute(
      "SELECT DATE(created_at) as date, COUNT(*) as order_count, SUM(total_cents) as revenue_cents " \
      "FROM orders WHERE created_at >= NOW() - INTERVAL '30 days' " \
      "GROUP BY DATE(created_at) ORDER BY date DESC"
    )
    report = rows.map do |r|
      { date: r['date'], order_count: r['order_count'].to_i, revenue_cents: r['revenue_cents'].to_i }
    end
    render json: { report: report }
  end
end
