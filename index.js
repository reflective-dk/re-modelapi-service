#!/usr/bin/env node

"use strict";

var requireyml = require('require-yml');

var packageJson = require.main.require('./package.json');
var logger = require('./lib/logger');
var initModelApi = require('./lib/init-model-api');

var auth = require('re-auth').middleware;
var JWT_SECRET = process.env['JWT_SECRET'];

var express = require('express');
var app = express();

var modelApis = requireyml('./model-apis');

module.exports = app.listen(8080, function() {
    logger.info('service ready');
});

app.get('/', function(request, response) {
    response.send({
        'package.json': packageJson,
        'model-apis': modelApis
    });
});

Object.keys(modelApis).forEach(function(apiKey) {
    var prefix = '/api/modelapi/';
    initModelApi(modelApis[apiKey], function initRoute(route, handler) {
        app.get('/' + route, handler);
        app.get(prefix + route, handler);
        app.post('/' + route, express.json(), handler);
        app.post(prefix + route, auth(JWT_SECRET), express.json(), handler);
    });
});
