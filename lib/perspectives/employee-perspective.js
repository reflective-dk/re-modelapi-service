"use strict";

var Promise = require('bluebird');
var _ = require('lodash');
var models = require('re-models').model;
var util = require('../util');
var perspectiveUtil = require('./perspective-util');

// TODO: Certain responsibilities should be common across customers
var THISTED_PERSONALEANSVAR = '87341d78-23db-4d78-94cf-5fd02b73060a';

module.exports = function(request, response, next) {
    var self = this;
    var paths1 = [
        'snapshot.employedAt', 'snapshot.position', 'snapshot.employee',
        { path: 'snapshot.userAccounts',
          byIncomingRelation: { relatesTo: { class: models.ro.classes['user-account'].id },
                                relation: 'employments' } },
        { path: 'snapshot.assignments',
          byIncomingRelation: { relatesTo: { class: models.ro.classes['role-assignment'].id },
                                relation: 'employment' } }
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
                        emp.snapshot.assignments =
                            _.keyBy(emp.snapshot.assignments || [], 'id');
                    });
                })
                .tap(employments => self.expand(context, employments, paths2))
                .then(function(employments) {
                    return Promise.all([
                        self.nowSnapshots(context, models.ro.classes.unit.id),
                        self.nowSnapshots(context, models.entity.classes.hierarchy.id)
                    ]).spread(function(units, hierarchies) {
                        return perspectiveUtil.forEachHierarchy(employments, units, hierarchies,
                            employeePerspective, perspectiveUtil.sort('employedAt'),
                            perspectiveUtil.toRows, decorateUnitWithManagerInfo(employments));
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
                      .some(r => r.id === THISTED_PERSONALEANSVAR));
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
                            decoratedUnits) {
    var unitId = _.get(employment, 'snapshot.employedAt.id');
    var unit = decoratedUnits[unitId];
    var position = _.get(employment, 'snapshot.position');
    var employee = _.get(employment, 'snapshot.employee');
    var assignments = _.get(employment, 'snapshot.assignments', []);
    var managerAssignment = _.find(assignments, a => Object.values(_.get(a, 'snapshot.responsibilities', {}))
                                   .some(r => r.id === THISTED_PERSONALEANSVAR));
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
        ErLeder: (!!managerAssignment).toString(),
        EgetLederniveau: _.get(managerAssignment, 'snapshot.aliases.ledelsesniveau') || undefined,
	StiFraRod: pathFromRootMap[unit.id],
        StillingId: _.get(position, 'id'),
	StillingEksterntId: perspectiveUtil.toCommaList(_.get(position, 'snapshot.foreignIds', {}), true),
	StillingNavn: _.get(position, 'snapshot.name'),
	StillingKortNavn: _.get(position, 'snapshot.shortName'),
        CprNummer: _.get(employee, 'snapshot.cprNr'),
	Telefon: perspectiveUtil.toCommaList(_.get(employment, 'snapshot.phoneNumbers', {}))
    };
    Object.assign(ref, closestManagerInfo(ref, unit));
    Object.keys(emails).forEach(k => ref[k] = emails[k]);
    Object.keys(userAccounts).forEach(k => ref[k] = userAccounts[k]);
    ref.AktivFra = util.asDanishDate(_.get(employment, 'snapshot.activeFrom')) || undefined;
    ref.AktivTil = util.asDanishDate(_.get(employment, 'snapshot.activeTo')) || undefined;
    refs.push(ref);
}

function closestManagerInfo(ref, unit) {
    var manager = ref.ErLeder === 'true'
        ? unit.closestManager : (unit.manager || unit.closestManager);
    if (!manager) {
        return {};
    }
    var assignments = _.get(manager, 'snapshot.assignments', []);
    var managerAssignment = _.find(assignments, a => Object.values(_.get(a, 'snapshot.responsibilities', {}))
                                   .some(r => r.id === THISTED_PERSONALEANSVAR));
    return {
        "NaermesteLederEmail thisted.dk": perspectiveUtil.emailCollection(manager)['Email thisted.dk'] || undefined,
        NaermesteLederLederniveau: _.get(managerAssignment, 'snapshot.aliases.ledelsesniveau') || undefined,
        NaermesteLederMedarbejdernummer: _.get(manager, 'snapshot.foreignIds.employeeId'),
        NaermesteLederNavn: _.get(manager, 'snapshot.employee.snapshot.name') || undefined,
        NaermesteLederStilling: _.get(manager, 'snapshot.position.snapshot.name') || undefined
    };
}
