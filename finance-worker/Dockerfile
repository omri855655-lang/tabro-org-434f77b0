FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src

USER node
EXPOSE 8080
CMD ["npm", "start"]
