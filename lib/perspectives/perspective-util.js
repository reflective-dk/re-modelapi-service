"use strict";

var _ = require('lodash');
var parseAsync = require('json2csv').parseAsync;
var util = require('../util');

module.exports = {
    emailCollection: emailCollection,
    forEachHierarchy: forEachHierarchy,
    formatAndSend: formatAndSend,
    isActiveObject: isActiveObject,
    sort: sort,
    sortUnits: sortUnits,
    toRows: toRows,
    userAccountCollection: userAccountCollection
};

function forEachHierarchy(elements, units, hierarchies, mapper, sort, toRows) {
    var rows = [];
    hierarchies
        // TODO: Should filter on hierarchy type == Admin Hierarchy
        // For now, explicitly pick the administrative hierarchy
        .filter(h => h.id === '4849d400-406d-4070-a745-6fe1fe47204f')
        .forEach(function(hierarchy) {
            var order = util.hierarchicalSort(units, hierarchy);
            var upstream = {};
            var pathFromRootMap = pathFromRoot(sortUnits(units, order), hierarchy);
            elements = sort(elements, order);
            elements.forEach(element => mapper(element, hierarchy, upstream, pathFromRootMap));
            rows = rows.concat(toRows(upstream, units, order, hierarchy));
        });
    return rows;
}

function pathFromRoot(sortedUnits, hierarchy) {
    var parentKey = 'snapshot.' + hierarchy.snapshot.pathElements[0].relation + '.id';
    var pathMap = {};
    var nameMap = {};
    sortedUnits.forEach(function(unit) {
        var parentId = _.get(unit, parentKey, {});
        nameMap[unit.id] = unit.snapshot.name;
        pathMap[unit.id] = [ pathMap[parentId], nameMap[unit.id] ]
            .filter(n => n).join(' < ') || undefined;
    });
    return pathMap;
}

function isActiveObject(validOn) {
    validOn = validOn || (new Date()).toISOString();
    return function(object) {
        if (!object) {
            return false;
        }
        var activeFrom = _.get(object, 'snapshot.activeFrom');
        var activeTo = _.get(object, 'snapshot.activeTo');
        if (activeFrom && validOn < activeFrom) {
            return false;
        }
        return !(activeTo && activeTo <= validOn);
    };
}

function sortUnits(units, order) {
    var unitMap = {};
    units.forEach(u => unitMap[u.id] = u);
    return order.map(key => unitMap[key]);
}

function sort(unitAttribute) {
    return function(elements, order) {
        var elementsByUnit = {};
        elements.forEach(function(element) {
            var unitId = _.get(element, 'snapshot.' + unitAttribute + '.id');
            if (!unitId) {
                return;
            }
            var list = elementsByUnit[unitId] = elementsByUnit[unitId] || [];
            list.push(element);
        });
        return [].concat.apply([], order.map(key => elementsByUnit[key] || []));
    };
}

function toRows(upstream, units, order, hierarchy) {
    return [].concat.apply([], order.map(unitId => upstream[unitId] || []));
}

function formatAndSend(response) {
    return function(objects) {
        return response.format({
            'text/csv': function() {
                toCsv(objects).then(function(body) {
                    response.set('Content-Type', 'text/csv');
                    return response.send(body);
                });
            },
            'default': function() {
                response.set('Content-Type', 'application/json');
                return response.send(objects);
            }
        });
    };
}

function toCsv(objects) {
    var columnMap = {};
    objects.forEach(o => Object.keys(o).forEach(k => columnMap[k] = true));
    return parseAsync(objects.map(o => JSON.stringify(o)), {
        fields: Object.keys(columnMap),
        delimiter: ';',
        defaultValue: undefined,
        quote: '"'
    });
}

function toCommaList(collection, strict) {
    collection = collection || {};
    var values = {};
    Object.keys(collection).forEach(function(key) {
        var value = collection[key];
        switch (true) {
        case !value:
        case typeof value != 'string':
        case strict && /[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}/.test(key):
            return;
        default:
            values[value] = true;
        }
    });
    return Object.keys(values).join(', ');
}

function userAccountCollection(object) {
    var collection = {};
    Object.values(_.get(object, 'snapshot.userAccounts', {}))
        .forEach(function(account) {
            var systemNames = {};
            Object.values(_.get(account, 'snapshot.systems', {}))
                .forEach(s => systemNames[_.get(s, 'snapshot.name', 'noname')] = true);
            var list = Object.keys(systemNames).sort().join(', ');
            var name = _.get(account, 'snapshot.foreignIds.accountName', _.get(account, 'snapshot.username'));
            collection['Bruger ' + list] = name;
        });
    return collection;
}

function emailCollection(object) {
    var domains = [ 'thisted.dk', 'thistedskoler.dk', 'skolekom.dk' ];
    var collection = {};
    Object.values(_.get(object, 'snapshot.emailAddresses', {}))
        .map(email => email.toLowerCase())
        .forEach(function(email) {
            var index = domains.indexOf((/@(.+)$/.exec(email) || [])[1]);
            if (index > -1) {
                collection['Email ' + domains[index]] = email;
            }
        });
    return collection;
}