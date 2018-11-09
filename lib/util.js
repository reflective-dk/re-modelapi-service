"use strict";

var Promise = require('bluebird');

module.exports = {
    getContextFromHeader: getContextFromHeader,
    resolveValidityParameters: resolveValidityParameters
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
    if (context.validOn) {
        if (context.validFrom || context.validTo) {
            return Promise.reject('both validOn and validFrom/validTo specified');
        }
        if (isNaN(new Date(context.validOn))) {
            return Promise.reject('invalid validOn parameter in context: ' + context.validOn);
        }
        return Promise.resolve(context);
    }
    if (context.validFrom || context.validTo) {
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
    }
    return Promise.resolve(context);
}
