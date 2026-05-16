FROM ruby:3.3-slim AS build

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
      build-essential \
      libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Gemfile ./
RUN bundle install --jobs 4 --retry 3 && \
    bundle exec bootsnap precompile --gemfile

FROM ruby:3.3-slim AS runtime

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends libpq5 && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -r app && useradd -r -g app app
WORKDIR /app

COPY --from=build /usr/local/bundle /usr/local/bundle
COPY . .

RUN bundle exec bootsnap precompile app/ lib/

ENV RAILS_ENV=production \
    RAILS_LOG_TO_STDOUT=true \
    RAILS_SERVE_STATIC_FILES=false \
    RAILS_MAX_THREADS=5

USER app
EXPOSE 8080

CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
