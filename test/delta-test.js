"use strict";

/* NOTE: All test cases relying on the 'nock' library to mock services
 *       must be added to this file. This is due to a bug in nock where
 *       mocks 'spill over' between test suites
 */

var Promise = require('bluebird');
var chai = require('chai');
chai.use(require('chai-as-promised'));
var expect = chai.expect;
var nock = require('nock');
var rp = require('request-promise');
var uuid = require('uuid');

var serviceUrl = 'http://localhost:8080';
var context = '{"domain": "delta-test", "extension": "delta-test"}';
var headers = {
    'Content-type': 'application/json',
    context: context
};

describe('Delta Service', function() {
    before(_before);
    after(_after);
    beforeEach(_beforeEach);
    afterEach(_afterEach);

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

function _before() {
    this.server = require.main.require('index.js');
}

function _after() {
    this.server.close();
}

function _beforeEach() {
    this.before = {
        foo: { id: 'foo', snapshot: { name: 'fooBefore' },
               from: '2018-01-01T00:00:00.000Z' },
        bar: { id: 'bar', snapshot: { name: 'barNoChange' },
               from: '2018-01-01T00:00:00.000Z'  },
        baz: { id: 'baz', snapshot: { mapped: { do: 'C', re: 'D', mi: 'E' } },
               from: '2018-01-01T00:00:00.000Z'  }
    };
    this.after = {
        foo: { id: 'foo', snapshot: { name: 'fooAfter' },
               from: '2018-02-02T00:00:00.000Z'  },
        bar: { id: 'bar', snapshot: { name: 'barNoChange' },
               from: '2018-02-02T00:00:00.000Z'  }
    };
    this.afterAsTrace = {
        foo: { id: 'foo', registrations: [ { validity: [ {
            input: { name: 'fooAfter' },
            from: '2018-02-02T00:00:00.000Z'
        } ] } ] },
        bar: { id: 'bar', registrations: [ { validity: [ {
            input: { name: 'barNoChange' },
            from: '2018-02-02T00:00:00.000Z'
        } ] } ] },
        baz: { id: 'baz', registrations: [ { validity: [ {
            input: { mapped: { do: 'C' } },
            from: '2018-02-02T00:00:00.000Z'
        } ] } ] }
    };
    this.testExtension = 'diff-test';
    var self = this;
    nock('http://search:8080')
        .persist()
        .post('/affected')
        .reply(200, function(uri, body) {
            return { objects: [ { id: 'foo' }, { id: 'bar' } ] };
        });
    nock('http://search:8080')
        .persist()
        .post('/snapshot')
        .reply(200, function(uri, body) {
            var ctx = JSON.parse(this.req.headers.context);
            var cache = ctx.extension === self.testExtension ? self.after : self.before;
            return {
                objects: body.objects.map(function(o) { return cache[o.id]; })
            };
        });
}

function _afterEach() {
    nock.cleanAll();
}

function snap(object) {
    return {
        id: object.id,
        snapshot: ((object.registrations || [{}])[0].validity || [{}])[0] .input || {},
        from: ((object.registrations || [{}])[0].validity || [{}])[0].from
    };
}
