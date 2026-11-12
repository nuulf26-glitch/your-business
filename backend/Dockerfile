FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --package-lock=true --workspaces=false
COPY . .
RUN npx prisma generate && npm run build
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
RUN apk add --no-cache ffmpeg && npm ci --omit=dev --package-lock=true --workspaces=false
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/prisma ./prisma
EXPOSE 10000
CMD ["npm", "run", "start:prod"]
