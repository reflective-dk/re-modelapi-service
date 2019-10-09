"use strict";

var _ = require('lodash');
var models = require('re-models').model;
var util = require('../util');
var perspectiveUtil = require('./perspective-util');

module.exports = function(request, response, next) {
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
