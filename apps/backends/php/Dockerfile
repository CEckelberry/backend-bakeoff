FROM composer:2 AS composer

FROM dunglas/frankenphp:1-php8.3-alpine AS builder

COPY --from=composer /usr/bin/composer /usr/bin/composer

WORKDIR /app

RUN apk add --no-cache libpq postgresql-dev build-base && \
    install-php-extensions pdo_pgsql && \
    apk del postgresql-dev build-base

COPY composer.json ./
RUN composer install --no-dev --optimize-autoloader --no-scripts

COPY . .
RUN mkdir -p var/cache var/log && \
    composer dump-autoload --optimize --classmap-authoritative

# Pre-warm the Symfony DI container so first request isn't slow
RUN APP_ENV=prod APP_SECRET=warmup php bin/console cache:warmup --env=prod

# ---- runtime ----------------------------------------------------------------
FROM dunglas/frankenphp:1-php8.3-alpine

RUN apk add --no-cache libpq && \
    install-php-extensions pdo_pgsql

WORKDIR /app
COPY --from=builder /app /app
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 8086

ENV APP_ENV=prod \
    APP_DEBUG=0 \
    APP_SECRET=bakeoffphpsecret \
    DB_HOST=localhost \
    DB_PORT=5432 \
    DB_DATABASE=bakeoff \
    DB_USERNAME=postgres \
    DB_PASSWORD=password \
    DB_SCHEMA=bakeoff_php \
    TAX_SERVICE_URL=http://tax-service:8080

CMD ["frankenphp", "run", "--config", "/etc/caddy/Caddyfile"]
