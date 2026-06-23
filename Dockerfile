FROM node:22-bookworm-slim AS build

WORKDIR /app

# Install build deps for better-sqlite3 (node-gyp)
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml ./

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

# Install dependencies
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

FROM node:22-bookworm-slim AS run

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/drizzle ./drizzle

EXPOSE 3000

# Liveness: hit the app's health endpoint. Node 22 has a global fetch, so no
# curl is needed in the slim image. Reports unhealthy if the DB ping fails (503).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "build"]
