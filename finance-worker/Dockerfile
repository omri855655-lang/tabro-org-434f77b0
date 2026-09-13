FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates curl fonts-liberation unzip wget xz-utils \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-glib-1-2 \
    libdrm2 libgbm1 libgtk-3-0 libnss3 libpangocairo-1.0-0 libxcomposite1 \
    libxdamage1 libxkbcommon0 libxrandr2 libxshmfence1 libxss1 libxt6 \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PII_REDACTION=on

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
RUN mkdir -p /home/node/.cache \
  && chown -R node:node /home/node /app

USER node
RUN npx @hieutran094/camoufox-js fetch \
  && test -f /home/node/.cache/camoufox/camoufox-bin

COPY --chown=node:node src ./src
EXPOSE 8080
CMD ["npm", "start"]
