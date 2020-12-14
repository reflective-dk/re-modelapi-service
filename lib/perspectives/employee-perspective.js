"use strict";

var Promise = require('bluebird');
var _ = require('lodash');
var models = require('re-models').model;
var util = require('../util');
var perspectiveUtil = require('./perspective-util');
var confRo = require('re-conf-ro').model;

module.exports = function(request, response, next) {
    var self = this;
    var paths1 = [
        // TODO: Solve this wrt. supertypes and mixins (e.g. AAU Unit vs RO Unit)
        { path: 'snapshot.employedAt', class: models.ro.classes.unit.id },
        { path: 'snapshot.position', class: models.ro.classes.position.id },
        { path: 'snapshot.employee', class: models.ro.classes.person.id },
        { path: 'snapshot.userAccounts',
          byIncomingRelation: { relatesTo: { class: models.ro.classes['user-account'].id },
                                relation: 'employments' } },
        { path: 'snapshot.assignments',
          byIncomingRelation: { relatesTo: { class: models.ro.classes['role-assignment'].id },
                                relation: 'employment' } }
    ];
    var paths2 = [
        { path: [ 'snapshot.userAccounts', 'snapshot.systems' ],
          class: models.ro.classes.system.id },
        { path: [ 'snapshot.employedAt', 'snapshot.locations' ],
          class: models.ro.classes.location.id }
    ];
    var paths3 = [
        { path: [ 'snapshot.employedAt', 'snapshot.locations', 'snapshot.address' ],
          class: models.ro.classes.address.id }
    ];
    var activationFilter = _.get(request, 'body.activationFilter');
    var isActive = perspectiveUtil.isActiveObject();
    return util.getContextFromHeader(request)
        .then(function(context) {
            return self.nowSnapshots(context, models.ro.classes.employment.id, activationFilter)
                .tap(employments => self.expand(context, employments, paths1, activationFilter))
                .tap(function(employments) {
                    employments.forEach(function(emp) {
                        emp.snapshot.userAccounts =
                          _.keyBy((emp.snapshot.userAccounts || []).filter(isActive), 'id');
                        emp.snapshot.assignments =
                          _.keyBy((emp.snapshot.assignments || []).filter(isActive), 'id');
                    });
                })
                .tap(employments => self.expand(context, employments, paths2, activationFilter))
                .tap(employments => self.expand(context, employments, paths3, activationFilter))
                .then(function(employments) {
                    return Promise.all([
                        self.nowSnapshots(context, models.ro.classes.unit.id, activationFilter),
                        self.nowSnapshots(context, models.entity.classes.hierarchy.id, activationFilter)
                    ]).spread(function(units, hierarchies) {
                        return perspectiveUtil.forEachHierarchy(employments, units, hierarchies,
                            employeePerspective, perspectiveUtil.sort('employedAt'),
                            perspectiveUtil.toRows, decorateUnitWithManagerInfo(employments),
                            context);
                    });
                });
        })
        .then(perspectiveUtil.formatAndSend(response))
        .catch(next);
};

function decorateUnitWithManagerInfo(employments) {
    var managers = employments.filter(function(employment) {
        var assignments = _.get(employment, 'snapshot.assignments', []);
        return _.find(assignments, a => Object.values(_.get(a, 'snapshot.responsibilities', {}))
                      .some(r => r.id === confRo.ro.instances.responsibility.personale.id));
    });
    return function(unit, unitMap, parentKey) {
        var manager = _.find(managers, m => _.get(m, 'snapshot.employedAt.id') === unit.id);
        var parent = unitMap[_.get(unit, [ 'snapshot', 'parents', parentKey, 'id' ])] || {};
        unit.manager = manager;
        unit.closestManager = parent.manager || parent.closestManager;
    };
}

/* Initially, employeePerspective is called for all the employments and the
 * results are written to the 'upstream' mapper result. Subsequently, we use this
 * information to generate a 'path from root' down the hierarchy by following the
 * order provided.
 */
function employeePerspective(employment, hierarchy, upstream, pathFromRootMap,
                             decoratedUnits, context) {
    var unitId = _.get(employment, 'snapshot.employedAt.id');
    var unit = decoratedUnits[unitId];
    var location = _.find(_.get(employment, 'snapshot.employedAt.snapshot.locations'));
    var unitAddress = _.get(location, 'snapshot.address.snapshot.streetAddress', '')
        + ', ' + _.get(location, 'snapshot.address.snapshot.postalCode', '')
        + ' ' + _.get(location, 'snapshot.address.snapshot.city', '')
        + ', ' + _.get(location, 'snapshot.address.snapshot.country', '');
    var position = _.get(employment, 'snapshot.position');
    var employee = _.get(employment, 'snapshot.employee');
    var assignments = _.get(employment, 'snapshot.assignments', []);
    var managerAssignment = _.find(assignments, a => Object.values(_.get(a, 'snapshot.responsibilities', {}))
                                   .some(r => r.id === confRo.ro.instances.responsibility.personale.id));
    var userAccounts = perspectiveUtil.userAccountCollection(employment);
    var emails = perspectiveUtil.emailCollection(employment, context);
    var refs = upstream[unit.id] = upstream[unit.id] || [];
    var ref = {
        Id: _.get(employment, 'id'),
        EksterntId: _.get(employment, 'snapshot.foreignIds.employeeId',
                          _.get(employment, 'snapshot.foreignIds.employmentId')),
        Medarbejdernummer: _.get(employment, 'snapshot.foreignIds.employeeId',
                          _.get(employment, 'snapshot.foreignIds.employmentId')),
        Navn: _.get(employee, 'snapshot.name'),
        Fornavn: _.get(employee, 'snapshot.givenName'),
        Efternavn: _.get(employee, 'snapshot.familyName'),
        EnhedId: _.get(unit, 'id'),
        EnhedEksterntId: _.get(unit, 'snapshot.foreignIds.orgUnitId',
                               _.get(unit, 'snapshot.foreignIds.departmentId')),
        EnhedNavn: _.get(unit, 'snapshot.name'),
        EnhedAdresse: unitAddress,
        ErLeder: (!!managerAssignment).toString(),
        EgetLederniveau: _.get(managerAssignment, 'snapshot.aliases.ledelsesniveau') || undefined,
        StiFraRod: pathFromRootMap[unit.id],
        StillingId: _.get(position, 'id'),
        StillingEksterntId: perspectiveUtil.toCommaList(_.get(position, 'snapshot.foreignIds', {}), true),
        StillingNavn: _.get(position, 'snapshot.name'),
        StillingKortNavn: _.get(position, 'snapshot.shortName'),
        UniloginRoller: perspectiveUtil.systemRoles(employment),
        CprNummer: _.get(employee, 'snapshot.cprNr'),
        Telefon: perspectiveUtil.toCommaList(_.get(employment, 'snapshot.phoneNumbers', {})),
        TimetalTaeller: _.get(employment, 'snapshot.aliases.taeller'),
        TimetalNaevner: _.get(employment, 'snapshot.aliases.naevner')
    };
    Object.assign(ref, closestManagerInfo(ref, unit, context));
    Object.keys(emails.all).forEach(k => ref[k] = emails.all[k]);
    Object.keys(userAccounts).forEach(k => ref[k] = userAccounts[k]);
    ref.AktivFra = util.asDanishDate(_.get(employment, 'snapshot.activeFrom')) || undefined;
    ref.AktivTil = util.asDanishDate(_.get(employment, 'snapshot.activeTo')) || undefined;
    refs.push(ref);
}

function closestManagerInfo(ref, unit, context) {
    var manager = ref.ErLeder === 'true'
        ? unit.closestManager : (unit.manager || unit.closestManager);
    if (!manager) {
        return {};
    }
    var assignments = _.get(manager, 'snapshot.assignments', []);
    var managerAssignment = _.find(assignments, a => Object.values(_.get(a, 'snapshot.responsibilities', {}))
        .some(r => r.id === confRo.ro.instances.responsibility.personale.id));
    return {
        LederEmail: perspectiveUtil.emailCollection(manager, context).main,
        LederLederniveau: _.get(managerAssignment, 'snapshot.aliases.ledelsesniveau') || undefined,
        LederMedarbejdernummer: _.get(manager, 'snapshot.foreignIds.employeeId',
                                      _.get(manager, 'snapshot.foreignIds.employmentId')),
        LederNavn: _.get(manager, 'snapshot.employee.snapshot.name') || undefined,
        LederStilling: _.get(manager, 'snapshot.position.snapshot.name') || undefined
    };
}
