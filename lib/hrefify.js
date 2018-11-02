"use strict";

var Promise = require('bluebird');

module.exports = hrefify;

function hrefify(objects, context, api, modelApis) {
    return fetchTypes(objects, context, api)
        .then(types => mapTypesToModels(types, modelApis))
        .then(types => hrefifyObjects(objects, types, api));
}

function hrefifyObjects(objects, types, api) {
    return objects.map(function(object) {
        return object;
    });
}

function mapTypesToModels(types, modelApis) {
    return types;
}

function fetchTypes(objects, context, api) {
    var typeSet = {};
    objects.forEach(o => {
        var id = ((o.snapshot || {}).class || {}).id;
        typeSet[id] = { id: id };
    });
    return api.promise.index.snapshot({
        context: context,
        objects: Object.keys(typeSet).map(k => typeSet[k])
    }).then(function(result) {
        var primary = {};
        var secondary = {};
        (result.objects || []).forEach(function(type) {
            primary[type.id] = type;
            var props = (type.snapshot || {}).properties || {};
            Object.keys(props).map(k => props[k]).forEach(function(prop) {
                if ((prop.dataType || {}).type === 'relation') {
                    var id = prop.dataType.target.id;
                    secondary[id] = { id: id };
                }
            });
        });
        var sec = Object.keys(secondary).filter(k => !primary[k]).map(k => secondary[k]);
        if (sec.length === 0) {
            return primary;
        }
        return api.promise.index.snapshot({ context: context, objects: sec })
            .then(function(secResult) {
                (secResult.objects || []).forEach(function(type) {
                    primary[type.id] = type;
                });
                return primary;
            });
    });
}
