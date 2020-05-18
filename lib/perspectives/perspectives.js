"use strict";

var Promise = require('bluebird');
var _ = require('lodash');
var parseAsync = require('json2csv').parseAsync;
var models = require('re-models').model;
var util = require('../util');
var perspectiveUtil = require('./perspective-util');

var unitPerspective = require('./unit-perspective');
var employeePerspective = require('./employee-perspective');
var roleAssignmentPerspective = require('./role-assignment-perspective');
var userAccountPerspective = require('./user-account-perspective');
var rightPerspective = require('./right-perspective');
var locationPerspective = require('./location-perspective');

module.exports = Perspectives;

function Perspectives(api) {
    this.nowSnapshots = function(context, classId, activityFilter) {
        return api.promise.core.query({ query: { relatesTo: { class: classId } },
                                        context: context })
            .then(result => result.objects || [])
            .then(objects => objects
                  .filter(perspectiveUtil.isActiveObject(context.validOn, activityFilter)));
    };
    this.expand = function(context, objects, paths) {
        return Promise.map(paths, function(path) {
            var args = pathToArgs(path, context);
            return api.promise.expand(objects, args);
        }).then(() => objects);
    };
}

Perspectives.prototype.units = unitPerspective;
Perspectives.prototype.employees = employeePerspective;
Perspectives.prototype.roleAssignments = roleAssignmentPerspective;
Perspectives.prototype.userAccounts = userAccountPerspective;
Perspectives.prototype.rights = rightPerspective;
Perspectives.prototype.locations = locationPerspective;

function pathToArgs(path, context) {
    switch (true) {
    case typeof path === 'string' || Array.isArray(path):
        return {
            path: path,
            context: context,
            expectMany: true
        };
    case !!path.byIncomingRelation:
        return {
            path: path.path,
            byIncomingRelation: path.byIncomingRelation,
            context: context,
            expectMany: true
        };
    default:
        return Object.assign({ context: context, expectMany: true }, path);
    }
}
