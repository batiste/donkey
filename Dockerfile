FROM node:14

WORKDIR /usr/src/donkey

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "serve"]