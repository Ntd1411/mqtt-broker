FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 1883 8883 3000

CMD ["node", "server.js"]
