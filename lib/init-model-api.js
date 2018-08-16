"use strict";

var logger = require('./lib/logger');

module.exports = initModelApi;

function initModelApi(api, initRoute) {
    initRoute('/' + api.key, (request, response) => response.send(api));
    Object.keys(api.types).forEach(typeKey => {
        initTypeApi(api, api.types[typeKey], initRoute);
    });
}

function initTypeApi(api, type, initRoute) {
    var singular = '/' + api.key + '/' + type.singular + '/:instanceId';
    var collection = '/' + api.key + '/' + type.plural;
    initRoute(singular, (request, response) => response.send({
        message: 'should return instance: ' + request.params.instanceId
    }));
    initRoute(collection, (request, response) => response.send({
        message: 'should return all instances of type: ' + type.singular
    }));
}
