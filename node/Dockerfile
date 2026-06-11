# World Cup Coca-Cola betting platform — single-stage image.
# Keeps full deps + source so the data scripts (migrate/import/fetch/lock)
# can run inside the container via `docker compose exec`.
FROM node:22-slim

WORKDIR /app

# better-sqlite3 ships prebuilt binaries for glibc (this slim image),
# build tools are a fallback if a prebuild is unavailable.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

# Source AND the pre-built .next/ from the host. We deliberately do NOT
# run `npm run build` inside the image: the build that produced the hashed
# /_next/static/* files on Cloudflare Pages must be the same build whose
# HTML the server emits, or chunk hashes mismatch and assets 404.
#
# Workflow: run `make deploy` on the host (builds + uploads to Pages),
# THEN `docker compose up -d --build` to ship that same .next/ into the image.
COPY . .

ENV NODE_ENV=production
ENV PORT=8026
ENV DB_PATH=/app/data/cup.db

EXPOSE 8026

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
