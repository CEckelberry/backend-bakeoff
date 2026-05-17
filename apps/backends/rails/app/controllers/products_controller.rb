class ProductsController < ApplicationController
  def index
    cols = %i[id sku name price_cents stock]
    rows = Product.order(:name).pluck(*cols)
    products = rows.map { |r| cols.zip(r).to_h }
    render json: { products: products }
  end

  def show
    product = Product.find_by(id: params[:id])
    if product.nil?
      render json: { error: 'not found' }, status: :not_found
      return
    end
    render json: { id: product.id, sku: product.sku, name: product.name, price_cents: product.price_cents, stock: product.stock }
  end
end
