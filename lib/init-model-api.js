"use strict";

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
    var singular = modelApi.key + '/' + type.singular + '/:instanceId';
    var collection = modelApi.key + '/' + type.plural;
    initRoute(singular, singularHandler(api));
    initRoute(collection, collectionHandler(api, type.classId));
}

function singularHandler(api) {
    return function(request, response) {
        return util.getContextFromHeader(request)
            .then(function(context) {
                if (!request.params.instanceId) {
                    response.status(400);
                    response.send('missing instance id');
                    return false;
                }
                return api.promise.index.snapshot({
                    context: context,
                    objects: [ { id: request.params.instanceId } ]
                }).then(function(result) {
                    var instance = (result.objects || [])[0];
                    if (instance) {
                        response.send(instance);
                    } else {
                        response.status(404);
                        response.send('not found');
                    }
                });
            })
            .catch((error) => {
                response.status(400);
                response.send(JSON.stringify(error.message || error));
            });
    };
}

function collectionHandler(api, classId) {
    return function(request, response) {
        return util.getContextFromHeader(request)
            .then(function(context) {
                return api.promise.index.query({
                    context: context,
                    query: { relatesTo: { class: classId } }
                }).then(function(result) {
                    response.send(result.objects || []);
                });
            })
            .catch((error) => {
                response.status(400);
                response.send(JSON.stringify(error.message || error));
            });
    };
}
