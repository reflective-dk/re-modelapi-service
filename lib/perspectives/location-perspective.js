"use strict";

var Promise = require('bluebird');
var _ = require('lodash');
var models = require('re-models').model;
var util = require('../util');
var perspectiveUtil = require('./perspective-util');

module.exports = function(request, response, next) {
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