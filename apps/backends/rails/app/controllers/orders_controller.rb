class OrdersController < ApplicationController
  def recent
    orders = Order.order(created_at: :desc).limit(20).includes(:order_items).map do |o|
      {
        id:          o.id,
        customer_id: o.customer_id,
        total_cents: o.total_cents,
        tax_cents:   o.tax_cents,
        created_at:  o.created_at,
        items:       o.order_items.map do |i|
          { product_id: i.product_id, quantity: i.quantity, price_cents: i.price_cents }
        end
      }
    end
    render json: { orders: orders }
  end

  def show
    order = Order.includes(:order_items).find_by(id: params[:id])
    if order.nil?
      render json: { error: 'not found' }, status: :not_found
      return
    end
    render json: {
      id:          order.id,
      customer_id: order.customer_id,
      total_cents: order.total_cents,
      tax_cents:   order.tax_cents,
      created_at:  order.created_at,
      items:       order.order_items.map do |i|
        { product_id: i.product_id, quantity: i.quantity, price_cents: i.price_cents }
      end
    }
  end
end
