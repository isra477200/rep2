FROM node:22-alpine AS build

ARG GIT_SHA=development

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN printf '%s\n' "$GIT_SHA" > /app/public/deployment.txt \
  && npm run build \
  && test -f /app/dist/client/deployment.txt

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

RUN mkdir -p /app/.wrangler && chown node:node /app/.wrangler
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["./node_modules/.bin/vinext", "start"]
