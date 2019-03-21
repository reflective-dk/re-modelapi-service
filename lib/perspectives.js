"use strict";

var Promise = require('bluebird');
var _ = require('lodash');

module.exports = Perspectives;

/* CONSTRUCTOR */

function Perspectives(api) {
    this.snapshots = function(context, classId) {
        return api.promise.index.snapshots.list({ context: context, classId: classId })
            .then(result => result.objects.filter(o => ((o.snapshot || {}).class || {}).id === classId));
    };
    this.nowSnapshots = function(context, classId) {
        return api.promise.core.query({ query: { relatesTo: { class: classId } },
                                        context: context })
            .then(result => result.objects || [])
            .then(objects => objects.filter(isActiveObject(context.validOn)));
    };
    this.expand = function(context, objects, paths) {
        return Promise.map(paths, function(path) {
            var args = path.byIncomingRelation
                ? { path: path.path, byIncomingRelation: path.byIncomingRelation, context: context }
                : { path: path, context: context };
            return api.promise.expand(objects, args);
        }).then(() => objects);
    };
}

/* OPERATIONS */

Perspectives.prototype.units = function(request, response, next) {
    response.send('called units');
};

Perspectives.prototype.employees = function(request, response, next) {
    response.send('called employees');
};

Perspectives.prototype.roleAssignments = function(request, response, next) {
    response.send('called role-assignments');
};

Perspectives.prototype.userAccounts = function(request, response, next) {
    response.send('called user-accounts');
};

Perspectives.prototype.locations = function(request, response, next) {
    response.send('called locations');
};

/* UTILITIES */

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
