"use strict";

var Promise = require('bluebird');
var through2 = require('through2');
var pumpify = require('pumpify');
var ternary = require('ternary-stream');
var api = new (require('reflective-api'))();
var restream = require('re-stream-util');
var util = require('./util');

module.exports = diff;

function diff(request, response) {
    return util.getContextFromHeader(request)
        .then(function(ctx) {
            var extension = (request.body || {}).extension;
            if (typeof extension !== 'string') {
                return Promise.reject('no extension specified');
            }
            var ctxBefore = JSON.parse(JSON.stringify(ctx));
            var ctxAfter = JSON.parse(JSON.stringify(ctx));
            if (extension === ctxBefore.extension) {
                // If the same extension is specified in the context and as
                // argument, we remove the extension from the 'before' context.
                // Else the extension is left in place and we determine the diff
                // between two extensions
                delete ctxBefore.extension;
            }
            ctxAfter.extension = extension;
            return api.index.affected({ context: ctxAfter })
                .pipe(restream.unwrapper())
                .pipe(through2.obj(function(obj, enc, callback) {
                    // This step simply duplicates the object ids and marks them
                    // for before and after, respectively
                    this.push({ id: obj.id, after: false });
                    this.push({ id: obj.id, after: true });
                    callback();
                }))
                // This ternary step directs a complete set of objects through
                // each of the snapsBefore and snapsAfter streams, and then funnels
                // the objects back into a single stream afterwards
                .pipe(ternary(
                    function(o) { return o.after; },
                    util.createSnapshotStream(ctxAfter, 'after'),
                    util.createSnapshotStream(ctxBefore, 'before')
                ))
                .pipe(util.snapshotDiffer())
                .pipe(restream.wrapper())
                .pipe(response);
        })
        .catch(function(error) {
            console.log('error', error);
            response.status(400).send(JSON.stringify(error));
        });
}
