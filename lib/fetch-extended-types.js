"use strict";

var models = require('re-models').model;

module.exports = fetchExtendedTypes;

function fetchExtendedTypes(context, api) {
    return fetchAllTypes(context, api).then(extendTypes);
}

function fetchAllTypes(context, api) {
    return api.promise.index.query({
        context: context,
        query: { relatesTo: { class: models.metamodel.classes.class.id } }
    }).then(function(result) {
        var types = {};
        (result.objects || []).forEach(function(type) {
            types[type.id] = type;
        });
        return types;
    });
}

function extendTypes(types) {
    Object.keys(types).forEach(typeId => extendType(typeId, types));
    return types;
}

function extendType(typeId, types) {
    var type = types[typeId];
    switch (true) {
    case !type:
        return {};
    case type.status === 'done':
        return type.snapshot.properties;
    case type.status === 'pending':
        throw new Error('circular type hierarchy for type: ' + typeId);
    default:
        type.status = 'pending';
        var properties = {};
        var extendsId = (type.snapshot.extends || {}).id;
        Object.assign(properties, extendType(extendsId, types));
        Object.keys(type.snapshot.mixins || {})
            .map(k => type.snapshot.mixins[k].id)
            .forEach(function(mixinId) {
                extendType(mixinId, types);
                Object.assign(properties, extendType(mixinId, types));
            });
        Object.assign(properties, type.snapshot.properties || {});
        type.snapshot.properties = properties;
        type.status = 'done';
        return properties;
    }
}
