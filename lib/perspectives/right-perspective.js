"use strict";

var Promise = require('bluebird');
var _ = require('lodash');
var models = require('re-models').model;
var util = require('../util');
var perspectiveUtil = require('./perspective-util');

module.exports = function(request, response, next) {
    var self = this;
    var paths = [
        'snapshot.system',
        { path: 'snapshot.allocations',
          byIncomingRelation: { relatesTo: { class: models.ro.classes['system-allocation'].id },
                                relation: 'right' } }
    ];
    return util.getContextFromHeader(request)
        .then(function(context) {
            return self.nowSnapshots(context, models.ro.classes.right.id)
                .tap(rights => self.expand(context, rights, paths))
                .then(function(rights) {
                    return rights
                        .map(rightPerspective)
                        .sort(function(a, b) {
                            return a.Navn < b.Navn ? -1 : a.Navn == b.Navn ? 0 : 1;
                        });
                });
        })
        .then(perspectiveUtil.formatAndSend(response))
        .catch(next);
};

function rightPerspective(right) {
    var allocations = _.get(right, 'snapshot.allocations', []).filter(util.isActive);
    return {
        Id: _.get(right, 'id'),
        EksterntId: perspectiveUtil.toCommaList(_.get(right, 'snapshot.foreignIds', {}), true),
        Navn: _.get(right, 'snapshot.name', ''),
        Titel: _.get(right, 'snapshot.aliases.title', ''),
        Beskrivelse: _.get(right, 'snapshot.description', ''),
        AntalAllokeringer: allocations.length,
        System: _.get(right, 'snapshot.system.snapshot.name', ''),
        KræverGodkendelse: _.get(right, 'snapshot.attestable', false).toString()
    };
}
