FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/package.json .
RUN npm install --omit=dev
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "build"]
