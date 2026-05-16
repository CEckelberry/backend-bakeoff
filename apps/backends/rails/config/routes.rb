Rails.application.routes.draw do
  post '/checkout', to: 'checkout#create'
  get  '/health',   to: 'health#show'
  get  '/metrics',  to: 'metrics#show'
end
