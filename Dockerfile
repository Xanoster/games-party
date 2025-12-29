# Fly.io deployment for Node + WebSocket server
FROM node:18-slim

WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm install --omit=dev

# Copy app source
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
