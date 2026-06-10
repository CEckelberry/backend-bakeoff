FROM php:8.3-cli-alpine AS builder

RUN apk add --no-cache \
    libpq \
    postgresql-dev \
    build-base \
    linux-headers \
    autoconf \
    openssl-dev && \
    pecl install swoole && \
    docker-php-ext-enable swoole && \
    docker-php-ext-install pdo_pgsql && \
    apk del postgresql-dev build-base autoconf linux-headers openssl-dev

FROM php:8.3-cli-alpine

RUN apk add --no-cache libpq

COPY --from=builder /usr/local/lib/php/extensions /usr/local/lib/php/extensions
COPY --from=builder /usr/local/etc/php/conf.d /usr/local/etc/php/conf.d

WORKDIR /app
COPY server.php .

EXPOSE 8086

ENV DB_HOST=db \
    DB_PORT=5432 \
    DB_DATABASE=bakeoff \
    DB_USERNAME=postgres \
    DB_PASSWORD=password \
    DB_SCHEMA=bakeoff_php \
    TAX_SERVICE_URL=http://tax-service:8080 \
    RUNTIME_NAME=php

CMD ["php", "server.php"]
