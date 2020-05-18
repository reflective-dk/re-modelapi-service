"use strict";

var Promise = require('bluebird');
var _ = require('lodash');
var models = require('re-models').model;
var util = require('../util');
var perspectiveUtil = require('./perspective-util');

module.exports = function(request, response, next) {
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
    var activityFilter = _.get(request, 'body.activityFilter');
    return util.getContextFromHeader(request)
        .then(function(context) {
            return self.nowSnapshots(context, models.ro.classes['role-assignment'].id, activityFilter)
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
                        self.nowSnapshots(context, models.ro.classes.unit.id, activityFilter),
                        self.nowSnapshots(context, models.entity.classes.hierarchy.id, activityFilter)
                    ]).spread(function(units, hierarchies) {
                        return perspectiveUtil.forEachHierarchy(assignments, units, hierarchies,
                                 roleAssignmentPerspective, perspectiveUtil.sort('propagateFrom'), perspectiveUtil.toRows);
                    });
                });
        })
        .then(perspectiveUtil.formatAndSend(response))
        .catch(next);
};

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
