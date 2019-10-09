"use strict";

var Promise = require('bluebird');
var _ = require('lodash');
var models = require('re-models').model;
var util = require('../util');
var perspectiveUtil = require('./perspective-util');

module.exports = function(request, response, next) {
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
