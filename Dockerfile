# syntax=docker/dockerfile:1

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# فقط مانیفست‌ها کپی می‌شوند تا layer وابستگی‌ها cache شود
COPY package.json package-lock.json ./

# npm ci از lockfile نصب می‌کند (قابل تکرار) و devDependencies را کنار می‌گذارد
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# dumb-init سیگنال‌ها را درست به Node پاس می‌دهد (خاموش شدن تمیز)
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

# اجرای غیر-root — کاربر node در image رسمی از قبل وجود دارد
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# TLS کار reverse proxy است — اپ فقط HTTP سرو می‌کند
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
