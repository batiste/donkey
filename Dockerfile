FROM node:24-slim

WORKDIR /usr/src/donkey
RUN chown node:node /usr/src/donkey
USER node

COPY --chown=node:node package*.json ./
RUN npm ci --ignore-scripts

COPY --chown=node:node . .

EXPOSE 3000

CMD ["npm", "run", "serve"]
