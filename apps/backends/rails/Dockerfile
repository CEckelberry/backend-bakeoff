FROM ruby:3.3-slim AS build

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
      build-essential \
      libpq-dev \
      libyaml-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Gemfile ./
RUN bundle install --jobs 4 --retry 3

FROM ruby:3.3-slim AS runtime

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends libpq5 && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -r app && useradd -r -g app app
WORKDIR /app

COPY --from=build /usr/local/bundle /usr/local/bundle
COPY . .
COPY --from=build /app/Gemfile.lock ./Gemfile.lock

ENV RAILS_ENV=production \
    RAILS_LOG_TO_STDOUT=true \
    RAILS_SERVE_STATIC_FILES=false \
    RAILS_MAX_THREADS=20 \
    WEB_CONCURRENCY=2 \
    BUNDLE_FROZEN=true \
    BUNDLE_WITHOUT=development:test

USER app
EXPOSE 8080

CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
