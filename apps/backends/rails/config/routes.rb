Rails.application.routes.draw do
  post '/checkout',         to: 'checkout#create'
  get  '/health',           to: 'health#show'
  get  '/metrics',          to: 'metrics#show'
  get  '/products',         to: 'products#index'
  get  '/products/:id',     to: 'products#show'
  get  '/orders/recent',    to: 'orders#recent'
  get  '/orders/:id',       to: 'orders#show'
  get  '/reports/revenue',  to: 'reports#revenue'
end
