FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install dependencies
RUN npm install || npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Expose port
EXPOSE 5174

# Start
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5174"]
