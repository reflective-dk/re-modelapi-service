"use strict";

var Promise = require('bluebird');
var _ = require('lodash');
var parseAsync = require('json2csv').parseAsync;
var models = require('re-models').model;
var util = require('../util');
var perspectiveUtil = require('./perspective-util');

module.exports = Perspectives;

/* CONSTRUCTOR */

function Perspectives(api) {
    this.nowSnapshots = function(context, classId) {
        return api.promise.core.query({ query: { relatesTo: { class: classId } },
                                        context: context })
            .then(result => result.objects || [])
            .then(objects => objects.filter(perspectiveUtil.isActiveObject(context.validOn)));
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
                        .then(hierarchies => perspectiveUtil.forEachHierarchy(units, units, hierarchies,
                                               unitPerspective, perspectiveUtil.sortUnits, toRows));
                });
        })
        .then(perspectiveUtil.formatAndSend(response))
        .catch(next);

    function toRows(upstream, units, order, hierarchy) {
        return order.map(key => upstream[key]);
    }
};

Perspectives.prototype.employees = function(request, response, next) {
    var self = this;
    var paths1 = [
        'snapshot.employedAt', 'snapshot.position', 'snapshot.employee',
        { path: 'snapshot.userAccounts',
          byIncomingRelation: { relatesTo: { class: models.ro.classes['user-account'].id },
                                relation: 'employments' } }
    ];
    var paths2 = [ [ 'snapshot.userAccounts', 'snapshot.systems' ] ];
    return util.getContextFromHeader(request)
        .then(function(context) {
            return self.nowSnapshots(context, models.ro.classes.employment.id)
                .tap(employments => self.expand(context, employments, paths1))
                .tap(function(employments) {
                    employments.forEach(function(emp) {
                        emp.snapshot.userAccounts =
                            _.keyBy(emp.snapshot.userAccounts || [], 'id');
                    });
                })
                .tap(employments => self.expand(context, employments, paths2))
                .then(function(employments) {
                    return Promise.all([
                        self.nowSnapshots(context, models.ro.classes.unit.id),
                        self.nowSnapshots(context, models.entity.classes.hierarchy.id)
                    ]).spread(function(units, hierarchies) {
                        return perspectiveUtil.forEachHierarchy(employments, units, hierarchies,
                                 employeePerspective, perspectiveUtil.sort('employedAt'), perspectiveUtil.toRows);
                    });
                });
        })
        .then(perspectiveUtil.formatAndSend(response))
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
    var paths4 = [ [ 'snapshot.userAccounts', 'snapshot.systems' ] ];
    return util.getContextFromHeader(request)
        .then(function(context) {
            return self.nowSnapshots(context, models.ro.classes['role-assignment'].id)
                .tap(assignments => self.expand(context, assignments, paths1))
                .tap(assignments => self.expand(context, assignments, paths2))
                .tap(function(assignments) {
                    var employments = assignments.map(a => _.get(a, 'snapshot.employment')).filter(e => _.get(e, 'snapshot'));
                    return self.expand(context, employments, paths3)
                        .tap(() => employments.forEach(emp => emp.snapshot.userAccounts = _.keyBy(emp.snapshot.userAccounts || [], 'id')))
                        .tap(() => self.expand(context, employments, paths4));
                })
                .then(function(assignments) {
                    return Promise.all([
                        self.nowSnapshots(context, models.ro.classes.unit.id),
                        self.nowSnapshots(context, models.entity.classes.hierarchy.id)
                    ]).spread(function(units, hierarchies) {
                        return perspectiveUtil.forEachHierarchy(assignments, units, hierarchies,
                                 roleAssignmentPerspective, perspectiveUtil.sort('propagateFrom'), perspectiveUtil.toRows);
                    });
                });
        })
        .then(perspectiveUtil.formatAndSend(response))
        .catch(next);
};

Perspectives.prototype.userAccounts = function(request, response, next) {
    var self = this;
    var paths1 = [ 'snapshot.employments', 'snapshot.systems' ];
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
                        return perspectiveUtil.forEachHierarchy(flattened, units, hierarchies,
                                 userAccountPerspective, perspectiveUtil.sort('employment.snapshot.employedAt'), perspectiveUtil.toRows);
                    });
                });
        })
        .then(perspectiveUtil.formatAndSend(response))
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
                        return perspectiveUtil.forEachHierarchy(locations, units, hierarchies,
                                 locationPerspective, perspectiveUtil.sort('unit'), perspectiveUtil.toRows);
                    });
                });
        })
        .then(perspectiveUtil.formatAndSend(response))
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
    var emails = perspectiveUtil.emailCollection(unit);
    var ref = {
        Id: _.get(unit, 'id'),
	EksterntId: perspectiveUtil.toCommaList(_.get(unit, 'snapshot.foreignIds', {}), true),
	Navn: _.get(unit, 'snapshot.name'),
	OverordnetId: _.get(parent, 'Id'),
	OverordnetEksterntId: _.get(parent, 'EksterntId'),
	OverordnetNavn: _.get(parent, 'Navn'),
	StiFraRod: pathFromRootMap[unit.id],
	KortNavn: _.get(unit, 'snapshot.shortName'),
	EnhedstypeId: _.get(unit, 'snapshot.unitType.id'),
	EnhedstypeEksterntId: _.get(unit, 'snapshot.unitType.snapshot.foreignIds.opusId'),
	EnhedstypeNavn: _.get(unit, 'snapshot.unitType.snapshot.name'),
	Telefon: perspectiveUtil.toCommaList(_.get(unit, 'snapshot.phoneNumbers', {})),
	SENummer: _.get(unit, 'snapshot.seNr'),
	EanNummer: typeof ean === 'string' ? ean : perspectiveUtil.toCommaList(ean),
	Omkostningssteder: perspectiveUtil.toCommaList(_.get(unit, 'snapshot.costCenters', {})),
        Adresse: _.get(location, 'snapshot.address.snapshot.streetAddress'),
        Postnummer: _.get(location, 'snapshot.address.snapshot.postalCode'),
        By: _.get(location, 'snapshot.address.snapshot.city'),
        Land: _.get(location, 'snapshot.address.snapshot.country')
    };
    Object.keys(emails).forEach(k => ref[k] = emails[k]);
    ref.AktivFra = util.asDanishDate(_.get(unit, 'snapshot.activeFrom')) || undefined;
    ref.AktivTil = util.asDanishDate(_.get(unit, 'snapshot.activeTo')) || undefined;
    upstream[unit.id] = ref;
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
    var userAccounts = perspectiveUtil.userAccountCollection(employment);
    var emails = perspectiveUtil.emailCollection(employment);
    var refs = upstream[unit.id] = upstream[unit.id] || [];
    var ref = {
        Id: _.get(employment, 'id'),
	EksterntId: perspectiveUtil.toCommaList(_.get(employment, 'snapshot.foreignIds', {}), true),
        Medarbejdernummer: _.get(employment, 'snapshot.foreignIds.employeeId'),
	Navn: _.get(employee, 'snapshot.name'),
        EnhedId: _.get(unit, 'id'),
	EnhedEksterntId: perspectiveUtil.toCommaList(_.get(unit, 'snapshot.foreignIds', {}), true),
	EnhedNavn: _.get(unit, 'snapshot.name'),
	StiFraRod: pathFromRootMap[unit.id],
        StillingId: _.get(position, 'id'),
	StillingEksterntId: perspectiveUtil.toCommaList(_.get(position, 'snapshot.foreignIds', {}), true),
	StillingNavn: _.get(position, 'snapshot.name'),
	StillingKortNavn: _.get(position, 'snapshot.shortName'),
        CprNummer: _.get(employee, 'snapshot.cprNr'),
	Telefon: perspectiveUtil.toCommaList(_.get(employment, 'snapshot.phoneNumbers', {}))
    };
    Object.keys(emails).forEach(k => ref[k] = emails[k]);
    Object.keys(userAccounts).forEach(k => ref[k] = userAccounts[k]);
    ref.AktivFra = util.asDanishDate(_.get(employment, 'snapshot.activeFrom')) || undefined;
    ref.AktivTil = util.asDanishDate(_.get(employment, 'snapshot.activeTo')) || undefined;
    refs.push(ref);
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
    var userAccounts = perspectiveUtil.userAccountCollection(employment);
    var emails = perspectiveUtil.emailCollection(employment);
    var refs = upstream[unit.id] = upstream[unit.id] || [];
    var ref = {
        Id: _.get(assignment, 'id'),
        MedarbejderId: _.get(employment, 'id'),
	MedarbejderEksterntId: perspectiveUtil.toCommaList(_.get(employment, 'snapshot.foreignIds', {}), true),
	MedarbejderNavn: _.get(employee, 'snapshot.name'),
        EnhedId: _.get(unit, 'id'),
	EnhedEksterntId: perspectiveUtil.toCommaList(_.get(unit, 'snapshot.foreignIds', {}), true),
	EnhedNavn: _.get(unit, 'snapshot.name'),
	StiFraRod: pathFromRootMap[unit.id],
	RolleId: _.get(role, 'id'),
	RolleEksterntId: perspectiveUtil.toCommaList(_.get(role, 'snapshot.foreignIds', {}), true),
	RolleNavn: _.get(role, 'snapshot.name'),
	Ansvar: responsibilities,
	Telefon: perspectiveUtil.toCommaList(_.get(employment, 'snapshot.phoneNumbers', {}))
    };
    Object.keys(emails).forEach(k => ref[k] = emails[k]);
    Object.keys(userAccounts).forEach(k => ref[k] = userAccounts[k]);
    ref.AktivFra = util.asDanishDate(_.get(assignment, 'snapshot.activeFrom')) || undefined;
    ref.AktivTil = util.asDanishDate(_.get(assignment, 'snapshot.activeTo')) || undefined;
    refs.push(ref);
}

function userAccountPerspective(account, hierarchy, upstream, pathFromRootMap) {
    var employment = _.get(account, 'snapshot.employment');
    var unit = _.get(employment, 'snapshot.employedAt', { id: 'unassigned', snapshot: {} } );
    var parentKey = hierarchy.snapshot.pathElements[0].relation.match(/[^.]+$/)[0];
    var parent = _.find(upstream[_.get(unit, [ 'snapshot', 'parents', parentKey, 'id' ])]);
    var employee = _.get(employment, 'snapshot.employee');
    var emails = perspectiveUtil.emailCollection(employment);
    var refs = upstream[unit.id] = upstream[unit.id] || [];
    var ref = {
        Id: _.get(account, 'id'),
        EksterntId: perspectiveUtil.toCommaList(_.get(account, 'snapshot.foreignIds', {}), true),
        Navn: _.get(account, 'snapshot.foreignIds.accountName', _.get(account, 'snapshot.username')),
        MedarbejderId: employment.id,
	MedarbejderEksterntId: perspectiveUtil.toCommaList(_.get(employment, 'snapshot.foreignIds', {}), true),
	MedarbejderNavn: _.get(employee, 'snapshot.name'),
        EnhedId: _.get(unit, 'id'),
        EnhedEksterntId: perspectiveUtil.toCommaList(_.get(unit, 'snapshot.foreignIds', {}), true),
        EnhedNavn: _.get(unit, 'snapshot.name'),
        StiFraRod: pathFromRootMap[unit.id],
        Systemer: Object.values(_.get(account, 'snapshot.systems', {}))
            .map(s => _.get(s, 'snapshot.name')).join(', '),
        Brugernavn: _.get(account, 'snapshot.username'),
        HomeDrive: _.get(account, 'snapshot.homeDrive'),
        HomeDirectory: _.get(account, 'snapshot.homeDirectory')
    };
    Object.keys(emails).forEach(k => ref[k] = emails[k]);
    ref.AktivFra = util.asDanishDate(_.get(account, 'snapshot.activeFrom')) || undefined;
    ref.AktivTil = util.asDanishDate(_.get(account, 'snapshot.activeTo')) || undefined;
    refs.push(ref);
}

function locationPerspective(location, hierarchy, upstream, pathFromRootMap) {
    var unit = _.get(location, 'snapshot.unit');
    var parentKey = hierarchy.snapshot.pathElements[0].relation.match(/[^.]+$/)[0];
    var parent = _.find(upstream[_.get(unit, [ 'snapshot', 'parents', parentKey, 'id' ])]);
    var position = _.get(location, 'snapshot.position');
    var employee = _.get(location, 'snapshot.employee');
    var refs = upstream[unit.id] = upstream[unit.id] || [];
    refs.push({
        Id: _.get(location, 'id'),
	Navn: _.get(location, 'snapshot.name'),
        EnhedId: _.get(unit, 'id'),
	EnhedEksterntId: perspectiveUtil.toCommaList(_.get(unit, 'snapshot.foreignIds', {}), true),
	EnhedNavn: _.get(unit, 'snapshot.name'),
        StiFraRod: pathFromRootMap[unit.id],
	PNummer: _.get(location, 'snapshot.pNr'),
	Telefon: perspectiveUtil.toCommaList(_.get(location, 'snapshot.phoneNumbers', {})) || undefined,
	Adresse: _.get(location, 'snapshot.address.snapshot.streetAddress'),
	Postnummer: _.get(location, 'snapshot.address.snapshot.postalCode'),
	By: _.get(location, 'snapshot.address.snapshot.city'),
	Land: _.get(location, 'snapshot.address.snapshot.country'),
	AktivFra: util.asDanishDate(_.get(location, 'snapshot.activeFrom')) || undefined,
	AktivTil: util.asDanishDate(_.get(location, 'snapshot.activeTo')) || undefined
    });
}
