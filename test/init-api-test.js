"use strict";

var Promise = require('bluebird');
var chai = require('chai');
chai.use(require('chai-as-promised'));
var expect = chai.expect;
var uuid = require('uuid');

var models = require('re-models').model;

var initModelApi = require('../lib/init-model-api');

var context = '{"domain":"dummy-context"}';
var headers = { 'Content-type': 'application/json', context: context };

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
                .to.eventually.deep.equal({ status: 200, body: [ this.hrefifiedObject ] })
                .notify(done);
        });

        it('should initialize operation for instance collection', function(done) {
            initModelApi('jerky', this.modelApis, this.initRoute, this.mockApi);
            expect(this.op('jerky/bars'))
                .to.eventually.deep.equal({ status: 200, body: [ this.hrefifiedObject ] })
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

    this.dummyObject = {
        id: 'some-id',
        snapshot: { class: { id: 'foo-class-id' },
                    jazz: 42,
                    funk: { id: 'funky-object' },
                    rock: { plif: { id: 'rock-object' } }
                  }
    };

    this.hrefifiedObject = {
        id: 'some-id',
        href: 'jerky/foos/some-id',
        snapshot: { class: { id: 'foo-class-id' },
                    jazz: 42,
                    funk: {
                        id: 'funky-object',
                        href: 'jerky/bars/funky-object'
                    },
                    rock: { plif: { id: 'rock-object',
                                    href: 'jerky/bars/rock-object' } }
                  }
    };

    this.motherFooClass = { id: 'mother-foo-class-id', snapshot: {
        class: { id: 'class-class-id' },
        properties: {
            rock: { type: 'map', dataType: {
                type: 'relation', target: { id: 'bar-class-id' } } }
        }
    } };

    this.fooClass = { id: 'foo-class-id', snapshot: {
        class: { id: 'class-class-id' },
        extends: { id: this.motherFooClass.id },
        properties: {
            jazz: { type: 'simple', dataType: 'string' },
            funk: { type: 'simple', dataType: {
                type: 'relation', target: { id: 'bar-class-id' } } },
            pop: { type: 'map', dataType: {
                type: 'relation', target: { id: 'foo-class-id' } } }
        }
    } };

    this.barClass = { id: 'bar-class-id', snapshot: {
        class: { id: 'class-class-id' },
        properties: { bebop: { type: 'simple', dataType: 'string' } }
    } };

    this.modelApis = {
        jerky: {
            key: 'jerky',
            types: {
                foo: {
                    key: 'foo',
                    singular: 'foo',
                    plural: 'foos',
                    classId: 'foo-class-id'
                },
                bar: {
                    key: 'bar',
                    singular: 'bar',
                    plural: 'bars',
                    classId: 'bar-class-id'
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
            case args.objects[0].id === 'some-id':
                return Promise.resolve({
                    objects: JSON.parse(JSON.stringify([ self.dummyObject ]))
                });
            default:
                return Promise.reject('invalid args');
            }
        },
        query: function(args) {
            switch (true) {
            case args.query.relatesTo.class === 'bar-class-id':
                return Promise.resolve({
                    objects: JSON.parse(JSON.stringify([ self.dummyObject ])) });
            case args.query.relatesTo.class === models.metamodel.classes.class.id:
                return Promise.resolve({
                    objects: JSON.parse(JSON.stringify([
                        self.fooClass, self.barClass, self.motherFooClass
                    ]))
                });
            default:
                return Promise.reject('invalid args');
            }
        }
    } } };

    this.op = function(route) {
        return handlers[route](request, response);
    };
}
