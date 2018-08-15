FROM gcr.io/city-7337/base

COPY package.json package.json
COPY test test
COPY run-unit-tests.sh run-unit-tests.sh
RUN chmod a+x run-unit-tests.sh
RUN npm install
RUN git clone git@github.com:reflective-dk/re-modelapi-service.git
RUN cd re-modelapi-service && npm install

EXPOSE 8080

CMD [ "npm", "test" ]
