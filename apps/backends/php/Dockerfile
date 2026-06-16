FROM composer:2 AS deps

# ---- build stage ------------------------------------------------------------
FROM php:8.4-fpm-alpine AS builder

COPY --from=deps /usr/bin/composer /usr/bin/composer

WORKDIR /app

RUN apk add --no-cache libpq postgresql-dev build-base && \
    docker-php-ext-install pdo_pgsql && \
    apk del postgresql-dev build-base

COPY composer.json ./
RUN composer install --no-dev --optimize-autoloader --no-scripts --no-interaction

COPY . .
RUN mkdir -p var/cache var/log && \
    composer dump-autoload --optimize --classmap-authoritative

# ---- runtime ----------------------------------------------------------------
FROM php:8.4-fpm-alpine

RUN apk add --no-cache libpq nginx postgresql-dev build-base && \
    docker-php-ext-install pdo_pgsql && \
    apk del postgresql-dev build-base && \
    mkdir -p /run/nginx

WORKDIR /app

COPY --from=builder /app /app
RUN chown -R nobody:nobody /app/var

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/fpm-pool.conf /usr/local/etc/php-fpm.d/www.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

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
    TAX_SERVICE_URL=http://tax-service:8080 \
    RUNTIME_NAME=php

CMD ["/entrypoint.sh"]
