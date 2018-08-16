#!/usr/bin/env node

"use strict";

var express = require('express');

var packageJson = require.main.require('./package.json');
var logger = require('./lib/logger');

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
