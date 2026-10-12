FROM node:24-bookworm-slim
WORKDIR /app
COPY selfhost-dist ./selfhost-dist
COPY drizzle ./drizzle
COPY initial-data ./initial-data
COPY startup ./startup
ENV NODE_ENV=production PORT=3080 DATA_DIR=/data
VOLUME /data
EXPOSE 3080
CMD ["node","startup/start.mjs"]
