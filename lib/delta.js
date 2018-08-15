"use strict";

var Promise = require('bluebird');
var through2 = require('through2');
var pumpify = require('pumpify');
var ternary = require('ternary-stream');
var api = new (require('reflective-api'))();
var restream = require('re-stream-util');
var util = require('./util');

module.exports = delta;

function delta(request, response) {
    return util.getContextFromHeader(request)
        .then(function(ctx) {
            return request
                .pipe(restream.unwrapper())
                .pipe(through2.obj(function(obj, enc, callback) {
                    // This step tags the incoming object as the 'after' object
                    // and sets up a blank 'before' object that a snapshot will
                    // be read for later
                    this.push({ id: obj.id, before: true });
                    var validity = (((obj.registrations || [])[0] || {}).validity || [])[0] || {};
                    this.push({
                        id: obj.id,
                        snapshot: validity.input,
                        from: validity.from,
                        sticker: 'after'
                    });
                    callback();
                }))
                // This ternary step directs the blank 'before' objects through
                // a snapshot stream and just passes through the 'after' objects
                .pipe(ternary(function(o) { return o.before; },
                              util.createSnapshotStream(ctx, 'before')))
                .pipe(util.snapshotDiffer())
                .pipe(restream.wrapper())
                .pipe(response);
        })
        .catch(function(error) {
            console.log('error', error);
            response.status(400).send(JSON.stringify(error));
        });
}
