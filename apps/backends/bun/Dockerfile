FROM oven/bun:latest AS base
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

FROM base
COPY src ./src
COPY tsconfig.json ./
USER bun
EXPOSE 8080
CMD ["bun", "src/index.ts"]
