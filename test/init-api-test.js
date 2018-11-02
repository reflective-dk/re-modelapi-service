"use strict";

var Promise = require('bluebird');
var chai = require('chai');
chai.use(require('chai-as-promised'));
var expect = chai.expect;
var uuid = require('uuid');

var initModelApi = require('../lib/init-model-api');

var context = '{"domain":"dummy-context"}';
var headers = { 'Content-type': 'application/json', context: context };

var dummyObject = { id: 'some-id', snapshot: {
    class: { id: 'primary-class-id' },
    jazz: 42, funk: { id: 'funky-object' }
} };
var primaryClass = { id: 'primary-class-id', snapshot: {
    class: { id: 'class-class-id' },
    properties: {
        jazz: { type: 'simple', dataType: 'string' },
        funk: { type: 'simple', dataType: {
            type: 'relation', target: { id: 'secondary-class-id' } } }
    }
} };
var secondaryClass = { id: 'secondary-class-id', snapshot: {
    class: { id: 'class-class-id' },
    properties: { bebop: { type: 'simple', dataType: 'string' } }
} };

describe('API Initialization', function() {
    beforeEach(_beforeEach);

    describe('initModelApi', function() {
        it('should initialize operation for api spec', function(done) {
            initModelApi('jerky', this.modelApis, this.initRoute, this.mockApi);
            expect(this.op('jerky'))
                .to.eventually.deep.equal({ status: 200, body: this.modelApis['jerky'] })
                .notify(done);
        });

        it('should initialize operation for single instance', function(done) {
            initModelApi('jerky', this.modelApis, this.initRoute, this.mockApi);
            expect(this.op('jerky/bar/:instanceId'))
                .to.eventually.deep.equal({ status: 200, body: [ dummyObject ] })
                .notify(done);
        });

        it('should initialize operation for instance collection', function(done) {
            initModelApi('jerky', this.modelApis, this.initRoute, this.mockApi);
            expect(this.op('jerky/bars'))
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

    this.modelApis = {
        jerky: {
            key: 'jerky',
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
        }
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
            switch (true) {
            case JSON.stringify(args.context) === context
                    && args.objects[0].id === 'some-id':
                return Promise.resolve({ objects: [ dummyObject ] });
            case JSON.stringify(args.context) === context
                    && args.objects[0].id === 'primary-class-id':
                return Promise.resolve({ objects: [ primaryClass ] });
            case JSON.stringify(args.context) === context
                    && args.objects[0].id === 'secondary-class-id':
                return Promise.resolve({ objects: [ secondaryClass ] });
            default:
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
