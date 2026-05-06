FROM php:8.3-cli-alpine

WORKDIR /app

RUN apk add --no-cache \
    libpq \
    postgresql-client \
    postgresql-dev \
    build-base && \
    docker-php-ext-install pdo_pgsql && \
    apk del postgresql-dev build-base

COPY . .

EXPOSE 8086

ENV DB_HOST=db \
    DB_PORT=5432 \
    DB_DATABASE=bakeoff \
    DB_USERNAME=postgres \
    DB_PASSWORD=password \
    DB_SCHEMA=bakeoff_php \
    TAX_SERVICE_URL=http://tax-service:8080 \
    RUNTIME_NAME=php

CMD ["php", "-S", "0.0.0.0:8086", "-t", "public"]
