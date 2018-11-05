"use strict";

var Promise = require('bluebird');
var fetchExtendedTypes = require('./fetch-extended-types');

module.exports = hrefify;

function hrefify(objects, context, api, typePrefixes) {
    return fetchExtendedTypes(context, api)
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
