"use strict";

var through2 = require('through2');
var pumpify = require('pumpify');
var ternary = require('ternary-stream');
var api = new (require('reflective-api'))();
var restream = require('re-stream-util');

module.exports = {
    getContextFromHeader: getContextFromHeader,
    createSnapshotStream: createSnapshotStream,
    snapshotDiffer: snapshotDiffer
};

function getContextFromHeader(request) {
    var contextString = request.header('context');
    if (!contextString || contextString.length == 0) {
        return Promise.reject('{"status": [{"severity": "error", "message": "missing header \'context\'"}]}');
    }
    try {
        return Promise.resolve(JSON.parse(contextString));
    } catch (error) {
        return Promise.reject('{"status": [{"severity": "error", "message": "header \'context\' should be valid JSON"}]}');
    }
}

function createSnapshotStream(context, sticker) {
    return pumpify.obj(
        restream.wrapper(),
        api.index.snapshot({ context: context }),
        restream.unwrapper(),
        through2.obj(function(obj, enc, callback) {
            obj.sticker = sticker;
            return callback(null, obj);
        })
    );
}

function snapshotDiffer() {
    var seen = {};
    return through2.obj(function(obj, enc, callback) {
        var already = seen[obj.id];
        if (!already) {
            seen[obj.id] = obj;
            return callback();
        }
        delete seen[obj.id];
        var left = already.sticker === 'before' ? already : obj;
        var right = already.sticker === 'after' ? already : obj;
        left.snapshot = left.snapshot || {};
        right.snapshot = right.snapshot || {};
        var difference = {};
        Object.keys(right.snapshot).forEach(function(k) {
            var d = diffAttrib(left.snapshot[k], right.snapshot[k]);
            if (d) {
                difference[k] = d;
            }
        });
        if (Object.keys(difference).length) {
            this.push({
                id: obj.id,
                registrations: [ { validity: [ { input: difference,
                                                 from: right.from } ] }]
            });
        } else {
            console.log('no diff detected: ' + obj.id);
        };
        return callback();
    }, function(callback) {
        if (Object.keys(seen).length) {
            // TODO: log error condition
            console.log('diffs not processed: ' + Object.keys(seen));
        }
        callback();
    });
}

function diffAttrib(left, right) {
    if (typeof left === 'object' && typeof right === 'object') {
        var d = {};
        Object.keys(right).forEach(function(k) {
            if (JSON.stringify(left[k]) !== JSON.stringify(right[k])) {
                d[k] = right[k];
            }
        });
        return Object.keys(d).length ? d : null;
    } else if (JSON.stringify(left) !== JSON.stringify(right)) {
        return right;
    }
    return null;
}
