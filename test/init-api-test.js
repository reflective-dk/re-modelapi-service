"use strict";

var chai = require('chai');
var expect = chai.expect;
var uuid = require('uuid');

describe('API Initialization', function() {

    describe('diff operation', function() {
        it('should return diff objects for a given extension', function(done) {
            expect(rp({
                uri: serviceUrl + '/diff',
                method: 'POST',
                headers: headers,
                body: { extension: this.testExtension },
                json: true
            }).then(function(result) {
                return result.objects.map(snap);
            })).to.eventually.become([
                { id: 'foo', snapshot: { name: 'fooAfter' },
                  from: '2018-02-02T00:00:00.000Z' }
            ]).notify(done);
        });

        it('should reject calls without a context', function(done) {
            expect(rp({
                uri: serviceUrl + '/diff',
                method: 'POST',
                body: { extension: this.testExtension },
                json: true
            })).to.eventually.be.rejectedWith(rp.StatusCodeError, /400 - ".*missing header.*"/)
                .notify(done);
        });
});

    describe('delta operation', function() {
        it('should create a delta based on supplied objects', function(done) {
            expect(rp({
                uri: serviceUrl + '/delta',
                method: 'POST',
                headers: headers,
                body: { objects: [ this.afterAsTrace.foo, this.afterAsTrace.bar ] },
                json: true
            }).then(function(result) {
                return result.objects.map(snap);
            })).to.eventually.become([
                { id: 'foo', snapshot: { name: 'fooAfter' },
                  from: '2018-02-02T00:00:00.000Z' }
            ]).notify(done);
        });

        it('should use \'from\' setting of \'after\' object', function(done) {
            expect(rp({
                uri: serviceUrl + '/delta',
                method: 'POST',
                headers: headers,
                body: { objects: [ this.afterAsTrace.foo ] },
                json: true
            }).then(function(result) {
                return snap(result.objects[0]).from;
            })).to.eventually.become(this.after.foo.from).notify(done);
        });

        it('should not report mapped value that\'s part of a larger group of existing values', function(done) {
            expect(rp({
                uri: serviceUrl + '/delta',
                method: 'POST',
                headers: headers,
                body: { objects: [ this.afterAsTrace.baz ] },
                json: true
            }).then(function(result) {
                return result.objects.map(snap);
            })).to.eventually.be.empty.notify(done);
        });

        it('should reject calls without a context', function(done) {
            expect(rp({
                uri: serviceUrl + '/delta',
                method: 'POST',
                body: { extension: this.testExtension },
                json: true
            })).to.eventually.be.rejectedWith(rp.StatusCodeError, /400 - ".*missing header.*"/)
                .notify(done);
        });
    });
});
