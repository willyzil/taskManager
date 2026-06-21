FROM node:18-alpine

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma/
RUN npx prisma generate

COPY dist ./dist/

EXPOSE 5001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
