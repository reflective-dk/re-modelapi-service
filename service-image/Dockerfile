FROM gcr.io/city-7337/base:node-12.15.0

COPY package.json package.json
RUN npm install

EXPOSE 8080

CMD [ "npm", "start" ]
