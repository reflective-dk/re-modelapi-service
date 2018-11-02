"use strict";

var Promise = require('bluebird');
var logger = require('./logger');
var util = require('./util');

module.exports = initModelApi;

function initModelApi(modelApi, initRoute, api) {
    initRoute(modelApi.key, (request, response) => response.send(modelApi));
    Object.keys(modelApi.types).forEach(typeKey => {
        initTypeApi(modelApi, modelApi.types[typeKey], initRoute, api);
    });
}

function initTypeApi(modelApi, type, initRoute, api) {
    var singular = singularHandler(api);
    var plural = collectionHandler(api, type.classId);
    initRoute(modelApi.key + '/' + type.singular + '/:instanceId', singular);
    initRoute(modelApi.key + '/' + type.plural + '/:instanceId', singular);
    initRoute(modelApi.key + '/' + type.singular, plural);
    initRoute(modelApi.key + '/' + type.plural, plural);
}

function singularHandler(api) {
    return genericHandler(function(context, request) {
        if (!request.params.instanceId) {
            return Promise.reject('missing instance id');
        }
        return api.promise.index.snapshot({
            context: context,
            objects: [ { id: request.params.instanceId } ]
        });
    });
}

function collectionHandler(api, classId) {
    return genericHandler(function(context) {
        return api.promise.index.query({
            context: context,
            query: { relatesTo: { class: classId } }
        });
    });
}

function genericHandler(handler) {
    return function(request, response) {
        return util.getContextFromHeader(request)
            .then(context => handler(context, request))
            .then(function(result) {
                response.send(result.objects || []);
            })
            .catch((error) => {
                response.status(400);
                response.send(JSON.stringify(error.message || error));
            });
    };
}
