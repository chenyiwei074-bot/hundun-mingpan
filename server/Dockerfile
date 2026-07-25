# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

RUN mkdir -p dist/templates dist/prompts &&     cp src/templates/* dist/templates/ 2>/dev/null || true &&     cp src/prompts/* dist/prompts/ 2>/dev/null || true

# ---- Production runtime ----
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache curl

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY entrypoint.sh ./

RUN npx prisma generate && chmod +x entrypoint.sh

EXPOSE 3000
CMD ["/bin/sh", "entrypoint.sh"]
