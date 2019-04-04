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
                                                              unitPerspective, sortUnits, toRows));
                });
        })
        .then(formatAndSend(response))
        .catch(next);

    function toRows(upstream, units, order, hierarchy) {
        return order.map(key => upstream[key]);
    }
};

Perspectives.prototype.employees = function(request, response, next) {
    var self = this;
    var paths = [
        'snapshot.employedAt', 'snapshot.position', 'snapshot.employee',
        { path: 'snapshot.userAccounts',
          byIncomingRelation: { relatesTo: { class: models.ro.classes['user-account'].id },
                                relation: 'employments' } }
    ];
    return util.getContextFromHeader(request)
        .then(function(context) {
            return self.nowSnapshots(context, models.ro.classes.employment.id)
                .tap(employments => self.expand(context, employments, paths))
                .tap(function(employments) {
                    employments.forEach(function(emp) {
                        emp.snapshot.userAccounts =
                            _.keyBy(emp.snapshot.userAccounts || [], 'id');
                    });
                })
                .then(function(employments) {
                    return Promise.all([
                        self.nowSnapshots(context, models.ro.classes.unit.id),
                        self.nowSnapshots(context, models.entity.classes.hierarchy.id)
                    ]).spread(function(units, hierarchies) {
                        return forEachHierarchy(employments, units, hierarchies,
                                                employeePerspective, sort('employedAt'), toRows);
                    });
                });
        })
        .then(formatAndSend(response))
        .catch(next);
};

Perspectives.prototype.roleAssignments = function(request, response, next) {
    var self = this;
    var paths1 = [ 'snapshot.employment', 'snapshot.propagateFrom', 'snapshot.role', 'snapshot.responsibilities' ];
    var paths2 = [ [ 'snapshot.employment', 'snapshot.position' ],
                   [ 'snapshot.employment', 'snapshot.employee' ] ];
    var paths3 = [
        { path: 'snapshot.userAccounts',
          byIncomingRelation: { relatesTo: { class: models.ro.classes['user-account'].id },
                                relation: 'employments' } }
    ];
    return util.getContextFromHeader(request)
        .then(function(context) {
            return self.nowSnapshots(context, models.ro.classes['role-assignment'].id)
                .tap(assignments => self.expand(context, assignments, paths1))
                .tap(assignments => self.expand(context, assignments, paths2))
                .tap(function(assignments) {
                    var employments = assignments.map(a => _.get(a, 'snapshot.employment')).filter(e => _.get(e, 'snapshot'));
                    return self.expand(context, employments, paths3)
                        .tap(() => employments.forEach(emp => emp.snapshot.userAccounts = _.keyBy(emp.snapshot.userAccounts || [], 'id')));
                })
                .then(function(assignments) {
                    return Promise.all([
                        self.nowSnapshots(context, models.ro.classes.unit.id),
                        self.nowSnapshots(context, models.entity.classes.hierarchy.id)
                    ]).spread(function(units, hierarchies) {
                        return forEachHierarchy(assignments, units, hierarchies,
                                                roleAssignmentPerspective, sort('propagateFrom'), toRows);
                    });
                });
        })
        .then(formatAndSend(response))
        .catch(next);
};

Perspectives.prototype.userAccounts = function(request, response, next) {
    var self = this;
    var paths1 = [ 'snapshot.employments', 'snapshot.system' ];
    var paths2 = [ [ 'snapshot.employments', 'snapshot.employee' ],
                   [ 'snapshot.employments', 'snapshot.employedAt' ] ];
    return util.getContextFromHeader(request)
        .then(function(context) {
            return self.nowSnapshots(context, models.ro.classes['user-account'].id)
                .tap(accounts => self.expand(context, accounts, paths1))
                .tap(accounts => self.expand(context, accounts, paths2))
                .then(function(accounts) {
                    var flattened = [];
                    accounts.forEach(function(account) {
                        var employments = Object.values(_.get(account, 'snapshot.employments', {}));
                        employments.forEach(function(employment) {
                            var single = JSON.parse(JSON.stringify(account));
                            delete single.snapshot.employments;
                            single.snapshot.employment = employment;
                            flattened.push(single);
                        });
                    });
                    return Promise.all([
                        self.nowSnapshots(context, models.ro.classes.unit.id),
                        self.nowSnapshots(context, models.entity.classes.hierarchy.id)
                    ]).spread(function(units, hierarchies) {
                        return forEachHierarchy(flattened, units, hierarchies,
                                                userAccountPerspective, sort('employment.snapshot.employedAt'), toRows);
                    });
                });
        })
        .then(formatAndSend(response))
        .catch(next);
};

Perspectives.prototype.locations = function(request, response, next) {
    var self = this;
    var paths = [
        'snapshot.address',
        { path: 'snapshot.units',
          byIncomingRelation: { relatesTo: { class: models.ro.classes.unit.id },
                                relation: 'locations' } }
    ];
    return util.getContextFromHeader(request)
        .then(function(context) {
            return self.nowSnapshots(context, models.ro.classes.location.id)
                .tap(locations => self.expand(context, locations, paths))
                .tap(function(locations) {
                    locations.forEach(function(loc) {
                        // A location should never be referenced by more than one unit
                        loc.snapshot.unit = loc.snapshot.units[0];
                    });
                })
                .then(function(locations) {
                    return Promise.all([
                        self.nowSnapshots(context, models.ro.classes.unit.id),
                        self.nowSnapshots(context, models.entity.classes.hierarchy.id)
                    ]).spread(function(units, hierarchies) {
                        return forEachHierarchy(locations, units, hierarchies,
                                                locationPerspective, sort('unit'), toRows);
                    });
                });
        })
        .then(formatAndSend(response))
        .catch(next);
};

/* MAPPERS */

/* Note: When 'unitPerspective' is called with a given unit, then all units
 * upstream of that unit in the specified hierarchy are guaranteed to have been
 * processed. Attributes can then be 'propagated' down the hierarchy by reading
 * the result from the parent unit provided in the 'upstream' map.
 */
function unitPerspective(unit, hierarchy, upstream, pathFromRootMap) {
    var parentKey = hierarchy.snapshot.pathElements[0].relation.match(/[^.]+$/)[0];
    var parent = upstream[_.get(unit, [ 'snapshot', 'parents', parentKey, 'id' ])];
    var location = _.find(unit.snapshot.locations);
    var ean = _.get(unit, 'snapshot.ean', {});
    upstream[unit.id] = {
        Id: _.get(unit, 'id'),
	EksterntId: toCommaList(_.get(unit, 'snapshot.foreignIds', {})),
	Navn: _.get(unit, 'snapshot.name'),
	OverordnetId: _.get(parent, 'Id'),
	OverordnetEksterntId: _.get(parent, 'EksterntId'),
	OverordnetNavn: _.get(parent, 'Navn'),
	StiFraRod: pathFromRootMap[unit.id],
	KortNavn: _.get(unit, 'snapshot.shortName'),
	EnhedstypeId: _.get(unit, 'snapshot.unitType.id'),
	EnhedstypeEksterntId: _.get(unit, 'snapshot.unitType.snapshot.foreignIds.opusId'),
	EnhedstypeNavn: _.get(unit, 'snapshot.unitType.snapshot.name'),
	Telefon: toCommaList(_.get(unit, 'snapshot.phoneNumbers', {})),
	Email: toCommaList(_.get(unit, 'snapshot.emailAddresses', {})),
	SENummer: _.get(unit, 'snapshot.seNr'),
	EanNummer: typeof ean === 'string' ? ean : toCommaList(ean),
	Omkostningssteder: toCommaList(_.get(unit, 'snapshot.costCenters', {})),
        Adresse: _.get(location, 'snapshot.address.snapshot.streetAddress'),
        Postnummer: _.get(location, 'snapshot.address.snapshot.postalCode'),
        By: _.get(location, 'snapshot.address.snapshot.city'),
        Land: _.get(location, 'snapshot.address.snapshot.country'),
	AktivFra: util.asDanishDate(_.get(unit, 'snapshot.activeFrom')) || undefined,
	AktivTil: util.asDanishDate(_.get(unit, 'snapshot.activeTo')) || undefined
    };
}

/* Initially, employeePerspective is called for all the employments and the
 * results are written to the 'upstream' mapper result. Subsequently, we use this
 * information to generate a 'path from root' down the hierarchy by following the
 * order provided.
 */
function employeePerspective(employment, hierarchy, upstream, pathFromRootMap) {
    var unit = _.get(employment, 'snapshot.employedAt');
    var parentKey = hierarchy.snapshot.pathElements[0].relation.match(/[^.]+$/)[0];
    var parent = _.find(upstream[_.get(unit, [ 'snapshot', 'parents', parentKey, 'id' ])]);
    var position = _.get(employment, 'snapshot.position');
    var employee = _.get(employment, 'snapshot.employee');
    var userAccounts = Object.values(_.get(employment, 'snapshot.userAccounts', {}))
        .map(account => _.get(account, 'snapshot.username'))
        .join(', ');
    var refs = upstream[unit.id] = upstream[unit.id] || [];
    refs.push({
        Id: _.get(employment, 'id'),
	EksterntId: toCommaList(_.get(employment, 'snapshot.foreignIds', {})),
	Navn: _.get(employee, 'snapshot.name'),
        EnhedId: _.get(unit, 'id'),
	EnhedEksterntId: toCommaList(_.get(unit, 'snapshot.foreignIds', {})),
	EnhedNavn: _.get(unit, 'snapshot.name'),
	StiFraRod: pathFromRootMap[unit.id],
        StillingId: _.get(position, 'id'),
	StillingEksterntId: toCommaList(_.get(position, 'snapshot.foreignIds', {})),
	StillingNavn: _.get(position, 'snapshot.name'),
	StillingKortNavn: _.get(position, 'snapshot.shortName'),
        CprNummer: _.get(employee, 'snapshot.cprNr'),
	Telefon: toCommaList(_.get(employment, 'snapshot.phoneNumbers', {})),
	Email: toCommaList(_.get(employment, 'snapshot.emailAddresses', {})),
	Brugere: userAccounts,
	AktivFra: util.asDanishDate(_.get(employment, 'snapshot.activeFrom')) || undefined,
	AktivTil: util.asDanishDate(_.get(employment, 'snapshot.activeTo')) || undefined
    });
}

/* Initially, roleAssignmentPerspective is called for all the employments and the
 * results are written to the 'upstream' mapper result. Subsequently, we use this
 * information to generate a 'path from root' down the hierarchy by following the
 * order provided.
 */
function roleAssignmentPerspective(assignment, hierarchy, upstream, pathFromRootMap) {
    var unit = _.get(assignment, 'snapshot.propagateFrom');
    var parentKey = hierarchy.snapshot.pathElements[0].relation.match(/[^.]+$/)[0];
    var parent = _.find(upstream[_.get(unit, [ 'snapshot', 'parents', parentKey, 'id' ])]);
    var role = _.get(assignment, 'snapshot.role', {});
    var responsibilities = Object.values(_.get(assignment, 'snapshot.responsibilities', {}))
        .map(responsibility => _.get(responsibility, 'snapshot.name'))
        .join(', ');
    var employment = _.get(assignment, 'snapshot.employment');
    var position = _.get(employment, 'snapshot.position');
    var employee = _.get(employment, 'snapshot.employee');
    var userAccounts = Object.values(_.get(employment, 'snapshot.userAccounts', {}))
        .map(account => _.get(account, 'snapshot.username'))
        .join(', ');
    var refs = upstream[unit.id] = upstream[unit.id] || [];
    refs.push({
        Id: _.get(assignment, 'id'),
        MedarbejderId: _.get(employment, 'id'),
	MedarbejderEksterntId: toCommaList(_.get(employment, 'snapshot.foreignIds', {})),
	MedarbejderNavn: _.get(employee, 'snapshot.name'),
        EnhedId: _.get(unit, 'id'),
	EnhedEksterntId: toCommaList(_.get(unit, 'snapshot.foreignIds', {})),
	EnhedNavn: _.get(unit, 'snapshot.name'),
	StiFraRod: pathFromRootMap[unit.id],
	RolleId: _.get(role, 'id'),
	RolleEksterntId: toCommaList(_.get(role, 'snapshot.foreignIds', {})),
	RolleNavn: _.get(role, 'snapshot.name'),
	Ansvar: responsibilities,
	Telefon: toCommaList(_.get(employment, 'snapshot.phoneNumbers', {})),
	Email: toCommaList(_.get(employment, 'snapshot.emailAddresses', {})),
	Brugere: userAccounts,
	AktivFra: util.asDanishDate(_.get(assignment, 'snapshot.activeFrom')) || undefined,
	AktivTil: util.asDanishDate(_.get(assignment, 'snapshot.activeTo')) || undefined
    });
}

function userAccountPerspective(account, hierarchy, upstream, pathFromRootMap) {
    var employment = _.get(account, 'snapshot.employment');
    var unit = _.get(employment, 'snapshot.employedAt', { id: 'unassigned', snapshot: {} } );
    var parentKey = hierarchy.snapshot.pathElements[0].relation.match(/[^.]+$/)[0];
    var parent = _.find(upstream[_.get(unit, [ 'snapshot', 'parents', parentKey, 'id' ])]);
    var employee = _.get(employment, 'snapshot.employee');
    var refs = upstream[unit.id] = upstream[unit.id] || [];
    refs.push({
        Id: _.get(account, 'id'),
        EksterntId: toCommaList(_.get(account, 'snapshot.foreignIds', {})),
        Navn: _.get(account, 'snapshot.name'),
        MedarbejderId: employment.id,
	MedarbejderEksterntId: toCommaList(_.get(employment, 'snapshot.foreignIds', {})),
	MedarbejderNavn: _.get(employee, 'snapshot.name'),
	Email: toCommaList(_.get(employment, 'snapshot.emailAddresses', {})),
        EnhedId: _.get(unit, 'id'),
        EnhedEksterntId: toCommaList(_.get(unit, 'snapshot.foreignIds', {})),
        EnhedNavn: _.get(unit, 'snapshot.name'),
        StiFraRod: pathFromRootMap[unit.id],
        SystemId: _.get(account, 'snapshot.system.id'),
        SystemNavn: _.get(account, 'snapshot.system.snapshot.name'),
        Brugernavn: _.get(account, 'snapshot.username'),
        HomeDrive: _.get(account, 'snapshot.homeDrive'),
        HomeDirectory: _.get(account, 'snapshot.homeDirectory'),
	AktivFra: util.asDanishDate(_.get(account, 'snapshot.activeFrom')) || undefined,
	AktivTil: util.asDanishDate(_.get(account, 'snapshot.activeTo')) || undefined
    });
}

function locationPerspective(location, hierarchy, upstream, pathFromRootMap) {
    var unit = _.get(location, 'snapshot.unit');
    var parentKey = hierarchy.snapshot.pathElements[0].relation.match(/[^.]+$/)[0];
    var parent = _.find(upstream[_.get(unit, [ 'snapshot', 'parents', parentKey, 'id' ])]);
    var position = _.get(location, 'snapshot.position');
    var employee = _.get(location, 'snapshot.employee');
    var userAccounts = Object.values(_.get(location, 'snapshot.userAccounts', {}))
        .map(account => _.get(account, 'snapshot.username'))
        .join(', ');
    var refs = upstream[unit.id] = upstream[unit.id] || [];
    refs.push({
        Id: _.get(location, 'id'),
	Navn: _.get(location, 'snapshot.name'),
        EnhedId: _.get(unit, 'id'),
	EnhedEksterntId: toCommaList(_.get(unit, 'snapshot.foreignIds', {})),
	EnhedNavn: _.get(unit, 'snapshot.name'),
	PNummer: _.get(location, 'snapshot.pNr'),
	Telefon: toCommaList(_.get(location, 'snapshot.phoneNumbers', {})) || undefined,
	Adresse: _.get(location, 'snapshot.address.snapshot.streetAddress'),
	Postnummer: _.get(location, 'snapshot.address.snapshot.postalCode'),
	By: _.get(location, 'snapshot.address.snapshot.city'),
	Land: _.get(location, 'snapshot.address.snapshot.country'),
	AktivFra: util.asDanishDate(_.get(location, 'snapshot.activeFrom')) || undefined,
	AktivTil: util.asDanishDate(_.get(location, 'snapshot.activeTo')) || undefined
    });
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
            var pathFromRootMap = pathFromRoot(sortUnits(units, order), hierarchy);
            elements = sort(elements, order);
            elements.forEach(element => mapper(element, hierarchy, upstream, pathFromRootMap));
            rows = rows.concat(toRows(upstream, units, order, hierarchy));
        });
    return rows;
}

function pathFromRoot(sortedUnits, hierarchy) {
    var parentKey = 'snapshot.' + hierarchy.snapshot.pathElements[0].relation + '.id';
    var pathMap = {};
    var nameMap = {};
    sortedUnits.forEach(function(unit) {
        var parentId = _.get(unit, parentKey, {});
        nameMap[unit.id] = unit.snapshot.name;
        pathMap[unit.id] = [ pathMap[parentId], nameMap[unit.id] ]
            .filter(n => n).join(' < ') || undefined;
    });
    return pathMap;
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

function sortUnits(units, order) {
    var unitMap = {};
    units.forEach(u => unitMap[u.id] = u);
    return order.map(key => unitMap[key]);
}

function sort(unitAttribute) {
    return function(elements, order) {
        var elementsByUnit = {};
        elements.forEach(function(element) {
            var unitId = _.get(element, 'snapshot.' + unitAttribute + '.id');
            if (!unitId) {
                return;
            }
            var list = elementsByUnit[unitId] = elementsByUnit[unitId] || [];
            list.push(element);
        });
        return [].concat.apply([], order.map(key => elementsByUnit[key] || []));
    };
}

function toRows(upstream, units, order, hierarchy) {
    return [].concat.apply([], order.map(unitId => upstream[unitId] || []));
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

function toCommaList(collection) {
    var values = {};
    Object.values(collection || {}).forEach(v => values[v] = true);
    return Object.keys(values).join(', ');
}
