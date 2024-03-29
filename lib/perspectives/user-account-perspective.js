"use strict";

var Promise = require('bluebird');
var _ = require('lodash');
var models = require('re-models').model;
var util = require('../util');
var perspectiveUtil = require('./perspective-util');

module.exports = function(request, response, next) {
    var self = this;
    var paths1 = [ 'snapshot.employments', 'snapshot.systems' ];
    var paths2 = [ [ 'snapshot.employments', 'snapshot.employee' ],
                   [ 'snapshot.employments', 'snapshot.employedAt' ] ];
    var activationFilter = _.get(request, 'body.activationFilter');
    return util.getContextFromHeader(request)
        .then(function(context) {
            return self.nowSnapshots(context, models.ro.classes['user-account'].id, activationFilter)
                .tap(accounts => self.expand(context, accounts, paths1, activationFilter))
                .tap(accounts => self.expand(context, accounts, paths2, activationFilter))
                .then(function(accounts) {
                    var flattened = [];
                    accounts.forEach(function(account) {
                        var employments = Object.values(_.get(account, 'snapshot.employments', {}))
                            .filter(emp => emp.snapshot); // Disregard un-expanded employments
                        employments = employments.length ? employments : [ {
                            snapshot: { employedAt: { id: 'unassigned' } }
                        } ];
                        employments.forEach(function(employment) {
                            var single = JSON.parse(JSON.stringify(account));
                            delete single.snapshot.employments;
                            single.snapshot.employment = employment;
                            flattened.push(single);
                        });
                    });
                    return Promise.all([
                        self.unitSnapshots(context, activationFilter),
                        self.nowSnapshots(context, models.entity.classes.hierarchy.id, activationFilter)
                    ]).spread(function(units, hierarchies) {
                        return perspectiveUtil.forEachHierarchy(flattened, units, hierarchies,
                            userAccountPerspective, perspectiveUtil.sort('employment.snapshot.employedAt', true),
                            toRows, null, context);
                    });
                });
        })
        .then(perspectiveUtil.formatAndSend(response))
        .catch(next);

    function toRows(upstream, units, order, hierarchy) {
      order = order.concat([ 'unassigned' ]);
      return [].concat.apply([], order.map(unitId => upstream[unitId] || []));
    }
};

function userAccountPerspective(account, hierarchy, upstream, pathFromRootMap, unitMap, context) {
    var employment = _.get(account, 'snapshot.employment', {});
    var unit = _.get(employment, 'snapshot.employedAt', { id: 'unassigned', snapshot: {} } );
    var parentKey = hierarchy.snapshot.pathElements[0].relation.match(/[^.]+$/)[0];
    var parent = _.find(upstream[_.get(unit, [ 'snapshot', 'parents', parentKey, 'id' ])]);
    var employee = _.get(employment, 'snapshot.employee');
    var emails = perspectiveUtil.emailCollection(employment, context);
    var refs = upstream[unit.id] = upstream[unit.id] || [];
    var ref = {
        Id: _.get(account, 'id'),
        EksterntId: _.get(account, 'snapshot.username'),
        Navn: _.get(account, 'snapshot.foreignIds.accountName', _.get(account, 'snapshot.username')),
        MedarbejderId: employment.id,
        MedarbejderEksterntId: _.get(employment, 'snapshot.foreignIds.employeeId',
                                     _.get(employment, 'snapshot.foreignIds.employmentId')),
	MedarbejderNavn: _.get(employee, 'snapshot.name'),
        EnhedId: _.get(unit, 'id'),
        EnhedEksterntId: _.get(unit, 'snapshot.foreignIds.orgUnitId',
                               _.get(unit, 'snapshot.foreignIds.departmentId')),
        EnhedNavn: _.get(unit, 'snapshot.name'),
        StiFraRod: pathFromRootMap[unit.id],
        Systemer: Object.values(_.get(account, 'snapshot.systems', {}))
            .map(s => _.get(s, 'snapshot.name')).join(', '),
        Brugernavn: _.get(account, 'snapshot.username'),
        HomeDrive: _.get(account, 'snapshot.homeDrive'),
        HomeDirectory: _.get(account, 'snapshot.homeDirectory')
    };
    Object.assign(ref, emails.all || {});
    ref.MedarbejderAktivFra = util.asDanishDate(_.get(employment, 'snapshot.activeFrom')) || undefined;
    ref.MedarbejderAktivTil = util.asDanishDate(_.get(employment, 'snapshot.activeTo')) || undefined;
    ref.AktivFra = util.asDanishDate(_.get(account, 'snapshot.activeFrom')) || undefined;
    ref.AktivTil = util.asDanishDate(_.get(account, 'snapshot.activeTo')) || undefined;
    refs.push(ref);
}
