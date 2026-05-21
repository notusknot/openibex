FROM node:22-bookworm-slim AS build

WORKDIR /app

# Install build deps for better-sqlite3 (node-gyp)
RUN apt-get update && apt-get install -y --no-install-recommends \\
  python3 make g++ \\
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

# Install dependencies (will use pnpm via corepack)
RUN pnpm install --frozen-lockfile=false

COPY . .

RUN pnpm build

FROM node:22-bookworm-slim AS run

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "build"]
