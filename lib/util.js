"use strict";

var Promise = require('bluebird');
var moment = require('moment');
var _ = require('lodash');

module.exports = {
    getContextFromHeader: getContextFromHeader,
    resolveValidityParameters: resolveValidityParameters,
    asDanishDate: asDanishDate,
    hierarchicalSort: hierarchicalSort
};

function getContextFromHeader(request) {
    var contextString = request.header('context');
    if (!contextString || contextString.length == 0) {
        return Promise.reject('missing header \'context\'');
    }
    try {
        return Promise.resolve(JSON.parse(contextString));
    } catch (error) {
        return Promise.reject('header \'context\' must be valid JSON');
    }
}

function resolveValidityParameters(context) {
    switch (true) {
    case !!context.validOn:
        if (context.validFrom || context.validTo) {
            return Promise.reject('both validOn and validFrom/validTo specified');
        }
        if (isNaN(new Date(context.validOn))) {
            return Promise.reject('invalid validOn parameter in context: ' + context.validOn);
        }
        return Promise.resolve(context);
    case !!context.validFrom:
    case !!context.validTo:
        var validFrom = context.validFrom ? new Date(context.validFrom) : new Date('0001-01-01');
        var validTo = context.validTo ? new Date(context.validTo) : new Date('9999-12-31');
        if (isNaN(validFrom)) {
            return Promise.reject('invalid validFrom parameter in context: ' + context.validFrom);
        }
        if (isNaN(validTo)) {
            return Promise.reject('invalid validTo parameter in context: ' + context.validTo);
        }
        if (validTo < validFrom) {
            return Promise.reject('validFrom > validTo in context: ' + context.validFrom + ' > ' + context.validTo);
        }
        context.validFrom = validFrom.toISOString();
        context.validTo = validTo.toISOString();
        return Promise.resolve(context);
    default:
        context.validOn = (new Date()).toISOString();
        return Promise.resolve(context);
    }
}

function asDanishDate(isoDate, midnightAsDayBefore) {
    var date = moment(isoDate);
    date.utc();
    switch (true) {
    case !isoDate:
    case !date.isValid():
    case date > moment('3000-12-31'):
        return null;
    case midnightAsDayBefore && date.hours() === 0 && date.minutes() === 0 &&
            date.seconds() === 0:
        date = date.subtract(1, 'days');
        // Drop through
    default:
        return date.format('DD-MM-YYYY');
    }
}

function hierarchicalSort(nodes, hierarchy) {
    var parentKey = 'snapshot.' + hierarchy.snapshot.pathElements[0].relation + '.id';
    var nodeMap = {};
    var rootRef = {};
    nodes.forEach(function(node) {
        var ref = nodeMap[node.id] = nodeMap[node.id] || {};
        var parent = _.get(node, parentKey);
        if (parent && parent != node.id) {
            var parentRef = nodeMap[parent] = nodeMap[parent] || {};
            parentRef[node.id] = ref;
        } else {
            rootRef[node.id] = ref;
        }
    });
    return flatten(rootRef);
}

function flatten(ref, list) {
    list = list || [];
    Object.keys(ref).forEach(function(key) {
        list.push(key);
        flatten(ref[key], list);
    });
    return list;
}
