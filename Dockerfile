# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Run the built app using Vite preview on port 8080
FROM node:20-alpine AS runner
WORKDIR /app

# Copy everything (including dist) from builder
COPY --from=builder /app .

EXPOSE 8080

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "8080"]
