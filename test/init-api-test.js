"use strict";

var Promise = require('bluebird');
var chai = require('chai');
chai.use(require('chai-as-promised'));
var expect = chai.expect;
var uuid = require('uuid');

var initModelApi = require('../lib/init-model-api');

var context = '{"domain":"dummy-context"}';
var headers = { 'Content-type': 'application/json', context: context };

var apiSpec = {
    key: 'foo',
    types: {
        bar: {
            key: 'bar',
            singular: 'bar',
            plural: 'bars',
            classId: 'bar-class-id'
        },
        baz: {
            key: 'baz',
            singular: 'baz',
            plural: 'bazzes',
            classId: 'baz-class-id'
        }
    }
};

var dummyObject = { id: 'some-id', snapshot: { jazz: 42 } };

describe('API Initialization', function() {
    beforeEach(_beforeEach);

    describe('initModelApi', function() {
        it('should initialize operation for api spec', function(done) {
            initModelApi(apiSpec, this.initRoute, this.mockApi);
            expect(this.op('foo'))
                .to.eventually.deep.equal({ status: 200, body: apiSpec })
                .notify(done);
        });

        it('should initialize operation for single instance', function(done) {
            initModelApi(apiSpec, this.initRoute, this.mockApi);
            expect(this.op('foo/bar/:instanceId'))
                .to.eventually.deep.equal({ status: 200, body: [ dummyObject ] })
                .notify(done);
        });

        it('should initialize operation for instance collection', function(done) {
            initModelApi(apiSpec, this.initRoute, this.mockApi);
            expect(this.op('foo/bars'))
                .to.eventually.deep.equal({ status: 200, body: [ dummyObject ] })
                .notify(done);
        });
    });
});

function _beforeEach() {
    var self = this;
    var handlers = {};
    var request = {
        params: { instanceId: 'some-id', classId: 'bar-class-id' },
        header: function() { return context; }
    };
    var response = {
        status: function(status) { self.status = status; },
        send: function(result) { self.result = result; }
    };
    this.initRoute = function(route, handler) {
        handlers[route] = function(req, res) {
            return Promise.resolve(handler(req, res))
                .then(function() {
                    return {
                        status: self.status || 200,
                        body: self.result
                    };
                });
        };
    };

    this.mockApi = { promise: { index: {
        snapshot: function(args) {
            if (JSON.stringify(args.context) === context
                && args.objects[0].id === 'some-id') {
                return Promise.resolve({ objects: [ dummyObject ] });
            } else {
                return Promise.reject('invalid args');
            }
        },
        query: function(args) {
            if (JSON.stringify(args.context) === context
                && args.query.relatesTo.class === 'bar-class-id') {
                return Promise.resolve({ objects: [ dummyObject ] });
            } else {
                return Promise.reject('invalid args');
            }
        }
    } } };

    this.op = function(route) {
        return handlers[route](request, response);
    };
}
