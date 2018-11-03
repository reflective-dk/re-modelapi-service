"use strict";

var Promise = require('bluebird');
var serializeError = require('serialize-error');
var logger = require('./logger');
var util = require('./util');
var hrefify = require('./hrefify');

module.exports = initModelApi;

function initModelApi(apiKey, modelApis, initRoute, api) {
    var modelApi = modelApis[apiKey];
    initRoute(apiKey, (request, response) => response.send(modelApi));
    Object.keys(modelApi.types).forEach(typeKey => {
        initTypeApi(apiKey, modelApis, modelApi.types[typeKey], initRoute, api);
    });
}

function initTypeApi(apiKey, modelApis, type, initRoute, api) {
    var typePrefixes = resolveTypePrefixes(modelApis);
    var singular = singularHandler(api, typePrefixes);
    var plural = collectionHandler(api, typePrefixes, type.classId);
    initRoute(apiKey + '/' + type.singular + '/:instanceId', singular);
    initRoute(apiKey + '/' + type.plural + '/:instanceId', singular);
    initRoute(apiKey + '/' + type.singular, plural);
    initRoute(apiKey + '/' + type.plural, plural);
}

function singularHandler(api, modelApis) {
    return genericHandler(function(context, request) {
        if (!request.params.instanceId) {
            return Promise.reject('missing instance id');
        }
        return api.promise.index.snapshot({
            context: context,
            objects: [ { id: request.params.instanceId } ]
        });
    }, api, modelApis);
}

function collectionHandler(api, modelApis, classId) {
    return genericHandler(function(context) {
        return api.promise.index.query({
            context: context,
            query: { relatesTo: { class: classId } }
        });
    }, api, modelApis);
}

function genericHandler(handler, api, modelApis) {
    return function(request, response) {
        return util.getContextFromHeader(request)
            .then(function(context) {
                return handler(context, request).then(function(result) {
                    return hrefify(result.objects || [], context, api, modelApis);
                });
            })
            .then(response.send)
            .catch((error) => {
                response.status(400);
                response.send(serializeError(error));
            });
    };
}

function resolveTypePrefixes(modelApis) {
    var typePrefixes = {};
    Object.keys(modelApis).map(k => modelApis[k]).forEach(function(modelApi) {
        Object.keys(modelApi.types).map(k => modelApi.types[k]).forEach(function(type) {
            type.apiKey = modelApi.key;
            typePrefixes[type.classId] = modelApi.key + '/' + type.plural + '/';
        });
    });
    return typePrefixes;
}
