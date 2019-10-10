#!/usr/bin/env node

"use strict";

var requireyml = require('require-yml');

var packageJson = require('./package.json');
var logger = require('./lib/logger');
var initModelApi = require('./lib/init-model-api');
var api = new (require('reflective-api'))();

var auth = require('re-auth').middleware;
var JWT_SECRET = process.env['JWT_SECRET'];

var express = require('express');
var app = express();

var modelApis = requireyml(__dirname + '/model-apis');
var perspectives = new (require('./lib/perspectives/perspectives'))(api);

module.exports = app.listen(8080, function() {
    logger.info('service ready');
});

app.get('/', function(request, response) {
    response.send({
        'package.json': packageJson,
        'model-apis': modelApis
    });
});

// MODEL API

Object.keys(modelApis).forEach(function(apiKey) {
    var prefix = '/api/model/';
    initModelApi(apiKey, modelApis, function(route, handler) {
        app.get('/model/' + route, handler);
        app.get('/api/model/' + route, handler);
        app.post('/model/' + route, express.json(), handler);
        app.post('/api/model/' + route, auth(JWT_SECRET), express.json(), handler);
    }, api);
});

// PERSPECTIVES

app.get('/perspective/units', unitPerspective);
app.post('/perspective/units', unitPerspective);
app.get('/api/perspective/units', auth(JWT_SECRET), unitPerspective);
app.post('/api/perspective/units', auth(JWT_SECRET), unitPerspective);
function unitPerspective(request, response, next) {
    return perspectives.units(request, response, next);
}

app.get('/perspective/employees', employeePerspective);
app.post('/perspective/employees', employeePerspective);
app.get('/api/perspective/employees', auth(JWT_SECRET), employeePerspective);
app.post('/api/perspective/employees', auth(JWT_SECRET), employeePerspective);
function employeePerspective(request, response, next) {
    return perspectives.employees(request, response, next);
}

app.get('/perspective/role-assignments', roleAssignmentPerspective);
app.post('/perspective/role-assignments', roleAssignmentPerspective);
app.get('/api/perspective/role-assignments', auth(JWT_SECRET), roleAssignmentPerspective);
app.post('/api/perspective/role-assignments', auth(JWT_SECRET), roleAssignmentPerspective);
function roleAssignmentPerspective(request, response, next) {
    return perspectives.roleAssignments(request, response, next);
}

app.get('/perspective/user-accounts', userAccountPerspective);
app.post('/perspective/user-accounts', userAccountPerspective);
app.get('/api/perspective/user-accounts', auth(JWT_SECRET), userAccountPerspective);
app.post('/api/perspective/user-accounts', auth(JWT_SECRET), userAccountPerspective);
function userAccountPerspective(request, response, next) {
    return perspectives.userAccounts(request, response, next);
}

app.get('/perspective/rights', rightPerspective);
app.post('/perspective/rights', rightPerspective);
app.get('/api/perspective/rights', auth(JWT_SECRET), rightPerspective);
app.post('/api/perspective/rights', auth(JWT_SECRET), rightPerspective);
function rightPerspective(request, response, next) {
    return perspectives.rights(request, response, next);
}

app.get('/perspective/locations', locationPerspective);
app.post('/perspective/locations', locationPerspective);
app.get('/api/perspective/locations', auth(JWT_SECRET), locationPerspective);
app.post('/api/perspective/locations', auth(JWT_SECRET), locationPerspective);
function locationPerspective(request, response, next) {
    return perspectives.locations(request, response, next);
}
