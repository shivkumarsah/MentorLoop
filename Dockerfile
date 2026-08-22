FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN npm ci

# Copy all source files
COPY . .

# Build client
RUN npm run build --workspace=client

# Build server
RUN npm run build --workspace=server

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install production dependencies
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN npm ci --omit=dev

# Copy built server and client
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/shared ./shared

# Required for runtime
COPY --from=builder /app/server/package.json ./server/

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

WORKDIR /app/server
CMD ["npm", "start"]
