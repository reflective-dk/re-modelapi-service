"use strict";

var Promise = require('bluebird');
var chai = require('chai');
chai.use(require('chai-as-promised'));
var expect = chai.expect;
var uuid = require('uuid');

var models = require('re-models').model;

var initModelApi = require('../lib/init-model-api');
var pitContext = { domain: 'some-domain' };
var now = new Date().toISOString();
var future = '2100-01-01T00:00:00.000Z';
var intervalAContext = {
    domain: 'some-domain',
    validFrom: '1950-01-01T00:00:00.000Z',
    validTo: '1980-01-01T00:00:00.000Z'
};
var intervalBContext = {
    domain: 'some-domain',
    validFrom: '2005-01-01T00:00:00.000Z',
    validTo: future
};
var intervalCContext = {
    domain: 'some-domain',
    validFrom: '1980-01-01T00:00:00.000Z',
    validTo: now
};

describe('API Initialization', function() {
    beforeEach(_beforeEach);

    describe('generic', function() {
        it('should initialize operation for api spec', function(done) {
            initModelApi('jerky', this.modelApis, this.initRoute, this.mockApi);
            expect(this.op('jerky', pitContext))
                .to.eventually.deep.equal({ status: 200, body: this.modelApis['jerky'] })
                .notify(done);
        });
    });

    describe('single object', function() {
        it('should initialize operation for single instance, point-in-time validity', function(done) {
            initModelApi('jerky', this.modelApis, this.initRoute, this.mockApi);
            expect(this.op('jerky/foos/:instanceId', pitContext))
                .to.eventually.deep.equal({ status: 200, body: [ this.hrefifiedObject ] })
                .notify(done);
        });

        it('should initialize operation for single instance, interval validity (A)', function(done) {
            initModelApi('jerky', this.modelApis, this.initRoute, this.mockApi);
            expect(this.op('jerky/foos/:instanceId', intervalAContext))
                .to.eventually.deep.equal({ status: 200, body: [] })
                .notify(done);
        });

        it('should initialize operation for single instance, interval validity (B)', function(done) {
            initModelApi('jerky', this.modelApis, this.initRoute, this.mockApi);
            expect(this.op('jerky/foos/:instanceId', intervalBContext))
                .to.eventually.deep.equal({ status: 200, body: [ this.hrefifiedObject, this.oldHrefifiedObject ] })
                .notify(done);
        });

        it('should initialize operation for single instance, interval validity (C)', function(done) {
            initModelApi('jerky', this.modelApis, this.initRoute, this.mockApi);
            expect(this.op('jerky/foos/:instanceId', intervalCContext))
                .to.eventually.deep.equal({ status: 200, body: [ this.oldHrefifiedObject ] })
                .notify(done);
        });

        it('should initialize operation that rejects id and class mismatch', function(done) {
            initModelApi('jerky', this.modelApis, this.initRoute, this.mockApi);
            expect(this.op('jerky/bar/:instanceId', intervalCContext))
                .to.eventually.deep.equal({ status: 200, body: [] })
                .notify(done);
        });
    });

    describe('object collection', function() {
        it('should initialize operation for instance collection, point-in-time validity', function(done) {
            initModelApi('jerky', this.modelApis, this.initRoute, this.mockApi);
            expect(this.op('jerky/foos', pitContext))
                .to.eventually.deep.equal({ status: 200, body: [ this.hrefifiedObject ] })
                .notify(done);
        });

        it('should initialize operation for instance collection, interval validity (A)', function(done) {
            initModelApi('jerky', this.modelApis, this.initRoute, this.mockApi);
            expect(this.op('jerky/foos', intervalAContext))
                .to.eventually.deep.equal({ status: 200, body: [] })
                .notify(done);
        });

        it('should initialize operation for instance collection, interval validity (B)', function(done) {
            initModelApi('jerky', this.modelApis, this.initRoute, this.mockApi);
            expect(this.op('jerky/foos', intervalBContext))
                .to.eventually.deep.equal({ status: 200, body: [ this.hrefifiedObject, this.oldHrefifiedObject ] })
                .notify(done);
        });

        it('should initialize operation for instance collection, interval validity (C)', function(done) {
            initModelApi('jerky', this.modelApis, this.initRoute, this.mockApi);
            expect(this.op('jerky/foos', intervalCContext))
                .to.eventually.deep.equal({ status: 200, body: [ this.oldHrefifiedObject ] })
                .notify(done);
        });
    });
});

function _beforeEach() {
    var self = this;
    var handlers = {};
    var request = {
        params: { instanceId: 'some-id', classId: 'bar-class-id' },
        header: function() { return self.context; }
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
                  },
        from: now
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
                  },
        from: now
    };

    this.oldHrefifiedObject = JSON.parse(JSON.stringify(self.hrefifiedObject));
    this.oldHrefifiedObject.from = '2000-01-01T00:00:00.000Z';
    this.oldHrefifiedObject.to = now;

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
            case args.query.relatesTo.class === 'foo-class-id':
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
        },
        snapshots: {
            list: function(args) {
                switch (true) {
                case args.id === 'some-id':
                case args.classId === 'foo-class-id':
                    return Promise.resolve({
                        objects: JSON.parse(JSON.stringify([
                            self.hrefifiedObject, self.oldHrefifiedObject,
                            /* TODO: For now we include 'barClass' in the mocked
                             * result from the 'snapshots/list' service, in order
                             * to verify that the code actually filters out
                             * irrelevant snapshots. In the future when the class
                             * id can be passed to the 'snapshots/list' operation
                             * to limit the result, the filtering and this test
                             * should be adapted
                             */
                            self.barClass
                        ]))
                    });
                default:
                    return Promise.reject('invalid args');
                }
            }
        }
    } } };

    this.op = function(route, context) {
        self.context = JSON.stringify(context);
        return handlers[route](request, response);
    };
}
