"use strict";

var Promise = require('bluebird');

module.exports = {
    getContextFromHeader: getContextFromHeader
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
