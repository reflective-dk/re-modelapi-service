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
