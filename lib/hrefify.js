"use strict";

var Promise = require('bluebird');

module.exports = hrefify;

function hrefify(objects, context, api, typePrefixes) {
    return fetchTypes(objects, context, api)
        .then(types => hrefifyObjects(objects, types, api, typePrefixes));
}

function hrefifyObjects(objects, types, api, typePrefixes) {
    return objects.map(function(object) {
        hrefifyElement(object, object.snapshot.class.id, typePrefixes);
        var props = (types[object.snapshot.class.id] || { snapshot: { properties: {} } })
            .snapshot.properties || {};
        Object.keys(props).forEach(function(propKey) {
            var prop = props[propKey];
            switch (true) {
            case prop.dataType.type !== 'relation':
                return;
            case prop.type === 'simple':
                hrefifyElement(object.snapshot[propKey], prop.dataType.target.id, typePrefixes);
                return;
            default:
                var collection = object.snapshot[propKey] || {};
                Object.keys(collection).map(k => collection[k]).forEach(function(element) {
                    hrefifyElement(element, prop.dataType.target.id, typePrefixes);
                });
            }
        });
        return object;
    });
}

function hrefifyElement(element, typeId, typePrefixes) {
    var prefix = typePrefixes[typeId];
    if (element && prefix) {
        element.href = prefix + element.id;
    }
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
