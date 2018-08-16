"use strict";

var logger = require('./logger');

module.exports = initModelApi;

function initModelApi(modelApi, initRoute) {
    initRoute('/' + modelApi.key, (request, response) => response.send(modelApi));
    Object.keys(modelApi.types).forEach(typeKey => {
        initTypeApi(modelApi, modelApi.types[typeKey], initRoute);
    });
}

function initTypeApi(modelApi, type, initRoute) {
    var singular = '/' + modelApi.key + '/' + type.singular + '/:instanceId';
    var collection = '/' + modelApi.key + '/' + type.plural;
    initRoute(singular, (request, response) => response.send({
        message: 'should return instance: ' + request.params.instanceId
    }));
    initRoute(collection, (request, response) => response.send({
        message: 'should return all instances of type: ' + type.singular
    }));
}
