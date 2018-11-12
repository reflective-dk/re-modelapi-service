"use strict";

var Promise = require('bluebird');
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
    var singular = singularHandler(api, typePrefixes, type.classId);
    var plural = collectionHandler(api, typePrefixes, type.classId);
    initRoute(apiKey + '/' + type.singular + '/:instanceId', singular);
    initRoute(apiKey + '/' + type.plural + '/:instanceId', singular);
    initRoute(apiKey + '/' + type.singular, plural);
    initRoute(apiKey + '/' + type.plural, plural);
}

function singularHandler(api, modelApis, classId) {
    return genericHandler(pit, interval, api, modelApis, classId);

    function pit(context, request) {
        if (!request.params.instanceId) {
            return Promise.reject('missing instance id');
        }
        return api.promise.index.snapshot({
            context: context,
            objects: [ { id: request.params.instanceId } ]
        }).then(result => result.objects || []);
    }

    function interval(context, request) {
        return api.promise.index.snapshots.list({
            context: context,
            id: request.params.instanceId
        }).then(result => result.objects || []);
    }
}

function collectionHandler(api, modelApis, classId) {
    return genericHandler(pit, interval, api, modelApis, classId);

    function pit(context, request) {
        return api.promise.index.query({
            context: context,
            query: { relatesTo: { class: classId } }
        }).then(result => result.objects || []);
    }

    function interval(context, request) {
        return api.promise.index.snapshots.list({
            context: context,
            classId: classId
        }).then(result => result.objects || []);
    }
}

function genericHandler(pointInTimeHandler, intervalHandler, api, modelApis, classId) {
    return function(request, response) {
        return util.getContextFromHeader(request)
            .then(util.resolveValidityParameters)
            .then(function(context) {
                var handler = context.validOn ? pointInTimeHandler : intervalHandler;
                return handler(context, request)
                    .then(objects => filterOnClassId(objects, classId))
                    .then(objects => filterOnValidity(objects, context))
                    .then(objects => hrefify(objects, context, api, modelApis));
            })
            .then(objects => response.send(objects))
            .catch((error) => {
                response.status(400);
                response.send(JSON.stringify(error.message || error));
            });
    };
}

function filterOnClassId(objects, classId) {
    return objects.filter(o => ((o.snapshot || {}).class || {}).id === classId);
}

function filterOnValidity(objects, context) {
    if (context.validOn) {
        return objects;
    }
    return objects.filter(function(object) {
        return (!object.to || context.validFrom <= object.to)
            && (!object.from || context.validTo > object.from);
    });
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
