FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && node selfhost/build.mjs
FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build /app/selfhost-dist ./selfhost-dist
COPY --from=build /app/drizzle ./drizzle
COPY initial-data ./initial-data
COPY startup ./startup
ENV NODE_ENV=production PORT=3080 DATA_DIR=/data
VOLUME /data
EXPOSE 3080
CMD ["node","startup/start.mjs"]
