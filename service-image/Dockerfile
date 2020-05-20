FROM gcr.io/city-7337/base:node-10.20.1

COPY package.json package.json
RUN npm install

EXPOSE 8080

CMD [ "npm", "start" ]
