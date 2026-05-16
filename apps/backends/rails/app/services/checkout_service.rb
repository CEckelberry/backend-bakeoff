require 'securerandom'

class CheckoutService
  UUID_RE = /\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i

  def initialize(tax_client)
    @tax_client = tax_client
  end

  def call(params)
    cart           = params[:cart] || []
    customer_id    = params[:customer_id].to_s
    shipping       = params[:shipping_address] || {}

    raise ArgumentError, 'Cart must have 1-8 items'   if cart.empty? || cart.size > 8
    raise ArgumentError, 'Invalid customer ID'         unless UUID_RE.match?(customer_id)

    subtotal   = 0
    line_items = []

    cart.each do |item|
      product_id = item[:product_id].to_s
      quantity   = item[:quantity].to_i

      raise ArgumentError, 'Invalid product ID'          unless UUID_RE.match?(product_id)
      raise ArgumentError, 'Quantity must be 1-8'        unless (1..8).cover?(quantity)

      product = Product.find_by(id: product_id)
      raise StandardError, 'Product not found'           if product.nil?
      raise StandardError, 'Insufficient stock'          if product.stock < quantity

      subtotal += product.price_cents * quantity
      line_items << { product: product, quantity: quantity, price_cents: product.price_cents }
    end

    tax_resp    = @tax_client.calculate(subtotal_cents: subtotal, state: shipping[:country])
    tax_cents   = tax_resp[:tax_cents].to_i
    total_cents = subtotal + tax_cents
    fraud_score = (subtotal / 100) + (line_items.size * 10)
    order_id    = SecureRandom.uuid

    ActiveRecord::Base.transaction do
      Order.create!(
        id:          order_id,
        customer_id: customer_id,
        total_cents: total_cents,
        tax_cents:   tax_cents,
        created_at:  Time.now.utc
      )

      line_items.each do |li|
        OrderItem.create!(
          id:          SecureRandom.uuid,
          order_id:    order_id,
          product_id:  li[:product].id,
          quantity:    li[:quantity],
          price_cents: li[:price_cents],
          created_at:  Time.now.utc
        )

        updated = Product.where(id: li[:product].id)
                         .where('stock >= ?', li[:quantity])
                         .update_all('stock = stock - ?', li[:quantity])
        raise StandardError, 'Insufficient stock' if updated == 0
      end
    end

    {
      order_id:    order_id,
      total_cents: total_cents,
      tax_cents:   tax_cents,
      fraud_score: fraud_score,
      items:       line_items.map do |li|
        {
          product_id:   li[:product].id,
          product_name: li[:product].name,
          quantity:     li[:quantity],
          price_cents:  li[:price_cents]
        }
      end,
      created_at: Time.now.utc.iso8601
    }
  end
end
