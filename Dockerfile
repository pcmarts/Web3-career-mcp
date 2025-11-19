# Use Node.js LTS
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Production image
FROM node:20-slim

WORKDIR /app

# Copy built files and dependencies from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Set environment variable for production
ENV NODE_ENV=production

# Entry point
ENTRYPOINT ["node", "dist/index.js"]

