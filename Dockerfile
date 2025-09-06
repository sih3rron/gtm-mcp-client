FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies and tsx
RUN npm ci && npm install -g tsx

# Copy source code
COPY services/ ./services/
COPY types/ ./types/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001

# Change ownership
RUN chown -R mcp:nodejs /app
USER mcp

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
  const req = http.request('http://localhost:3001/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1); \
  }); \
  req.on('error', () => process.exit(1)); \
  req.end();"

# Start with tsx (runs TypeScript directly)
CMD ["tsx", "services/miro-http-service.ts"]