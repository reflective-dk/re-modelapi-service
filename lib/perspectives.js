"use strict";

var Promise = require('bluebird');
var _ = require('lodash');
var converter = require('json-2-csv');
var models = require('re-models').model;
var util = require('./util');

module.exports = Perspectives;

/* CONSTRUCTOR */

function Perspectives(api) {
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
    var self = this;
    var paths1 = [ 'snapshot.unitType', 'snapshot.locations', 'snapshot.organizations' ];
    var paths2 = [ [ 'snapshot.locations', 'snapshot.address' ] ];
    return util.getContextFromHeader(request)
        .then(function(context) {
            return self.nowSnapshots(context, models.ro.classes.unit.id)
                .tap(units => self.expand(context, units, paths1))
                .tap(units => self.expand(context, units, paths2))
                .then(function(units) {
                    return self.nowSnapshots(context, models.entity.classes.hierarchy.id)
                        .then(hierarchies => forEachHierarchy(units, units, hierarchies,
                                                              unitPerspective, sort, toRows));
                });
        })
        .then(formatAndSend(response))
        .catch(next);

    function sort(units, order) {
        var unitMap = {};
        units.forEach(u => unitMap[u.id] = u);
        return order.map(key => unitMap[key]);
    }

    function toRows(upstream, units, order, hierarchy) {
        return order.map(key => upstream[key]);
    }
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

/* MAPPERS */

/* Note: When 'unitPerspective' is called with a given unit, then all units
 * upstream of that unit in the specified hierarchy are guaranteed to have been
 * processed. Attributes can then be 'propagated' down the hierarchy by reading
 * the result from the parent unit provided in the 'upstream' map.
 */
function unitPerspective(unit, hierarchy, upstream) {
    var parentKey = hierarchy.snapshot.pathElements[0].relation.match(/[^.]+$/)[0];
    var parent = upstream[_.get(unit, [ 'snapshot', 'parents', parentKey, 'id' ])];
    var location = _.find(unit.snapshot.locations);
    var stiFraRod = [ _.get(parent, 'StiFraRod'), _.get(parent, 'Navn') ]
        .filter(n => n).join(' < ') || undefined;
    var ean = _.get(unit, 'snapshot.ean', {});
    upstream[unit.id] = {
        Id: unit.id,
	EksterntId: _.get(unit, 'snapshot.foreignIds.orgUnitId'),
	Navn: _.get(unit, 'snapshot.name'),
	OverordnetId: _.get(parent, 'Id'),
	OverordnetEksterntId: _.get(parent, 'EksterntId'),
	OverordnetNavn: _.get(parent, 'Navn'),
	StiFraRod: stiFraRod,
	KortNavn: _.get(unit, 'snapshot.shortName'),
	EnhedstypeId: _.get(unit, 'snapshot.unitType.id'),
	EnhedstypeEksterntId: _.get(unit, 'snapshot.unitType.snapshot.foreignIds.opusId'),
	EnhedstypeNavn: _.get(unit, 'snapshot.unitType.snapshot.name'),
	Telefon: Object.values(_.get(unit, 'snapshot.phoneNumbers', {})).join(', '),
	Email: Object.values(_.get(unit, 'snapshot.emailAddresses', {})).join(', '),
	SENummer: _.get(unit, 'snapshot.seNr'),
	EanNummer: typeof ean === 'string' ? ean : Object.values(ean).join(', '),
	Omkostningssteder: Object.values(_.get(unit, 'snapshot.costCenters', {})).join(', '),
        Adresse: _.get(location, 'snapshot.address.snapshot.streetAddress'),
        Postnummer: _.get(location, 'snapshot.address.snapshot.postalCode'),
        By: _.get(location, 'snapshot.address.snapshot.city'),
        Land: _.get(location, 'snapshot.address.snapshot.country'),
	AktivFra: util.asDanishDate(_.get(unit, 'snapshot.activeFrom')) || undefined,
	AktivTil: util.asDanishDate(_.get(unit, 'snapshot.activeTo')) || undefined
    };
}

/* UTILITIES */

function forEachHierarchy(elements, units, hierarchies, mapper, sort, toRows) {
    var rows = [];
    hierarchies
        // TODO: Should filter on hierarchy type == Admin Hierarchy
        // For now, explicitly pick the administrative hierarchy
        .filter(h => h.id === '4849d400-406d-4070-a745-6fe1fe47204f')
        .forEach(function(hierarchy) {
            var order = util.hierarchicalSort(units, hierarchy);
            var upstream = {};
            elements = sort(elements, order);
            elements.forEach(element => mapper(element, hierarchy, upstream));
            rows = rows.concat(toRows(upstream, units, order, hierarchy));
        });
    return rows;
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
    return converter.json2csvAsync(objects, {
        delimiter: { field: ';', array: null },
        checkSchemaDifferences: false,
        emptyFieldValue: ''
    });
}
