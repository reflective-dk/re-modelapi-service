#!/usr/bin/env node
/*global global_logger*/
"use strict";

var bunyan = require('bunyan');
var express = require('express');

var path = require('path');
var packageFile = path.join(path.dirname(require.resolve('./index')), 'package.json');
var packageJson = require(packageFile);
var config = packageJson.config;
global.global_logger = bunyan.createLogger({
    name: config.serviceName,
    level: config.logLevel
});
const logger = global_logger;

const auth = require('re-auth').middleware;
var JWT_SECRET = process.env['JWT_SECRET'];

var diff = require('./lib/diff');
var delta = require('./lib/delta');

var app = express();

module.exports = app.listen(8080, function() {
    logger.info('service ready');
});

app.get('/', function(request, response) {
    response.send({
        'package.json': packageJson,
        operations: [ 'diff', 'delta' ]
    });
});

// === NOTE: Ordering matters below ===

// Operations streaming their request body first
app.post('/delta', delta);
app.post('/api/core/delta', auth(JWT_SECRET), delta);

// Operations reading their request body as json below
app.post('/diff', express.json(), diff);
app.post('/api/core/diff', auth(JWT_SECRET), express.json(), diff);