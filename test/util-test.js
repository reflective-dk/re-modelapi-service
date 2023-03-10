"use strict";
const bunyan = require('bunyan');
global.global_logger = bunyan.createLogger({
  name: 're-modelapi-service',
  serializers: bunyan.stdSerializers,
  level: 'error'
});

var chai = require('chai');
chai.use(require('chai-iso8601')());
chai.use(require('chai-as-promised'));
var expect = chai.expect;
var util = require('../lib/util');

describe('Util', function() {
    describe('resolveValidityParameters', function() {
        var invalid = 'not a valid date string';
        var now = new Date().toISOString();
        var later = new Date(3000, 0, 1).toISOString();
        var beginning = new Date('0001-01-01').toISOString();
        var end = new Date('9999-12-31').toISOString();

        it('should accept context with validOn parameter', function(done) {
            expect(util.resolveValidityParameters({ validOn: now }))
                .to.eventually.deep.equal({ validOn: now })
                .notify(done);
        });

        it('should accept context with just validFrom parameter', function(done) {
            expect(util.resolveValidityParameters({ validFrom: now }))
                .to.eventually.deep.equal({ validFrom: now, validTo: end })
                .notify(done);
        });

        it('should accept context with just validTo parameter', function(done) {
            expect(util.resolveValidityParameters({ validTo: now }))
                .to.eventually.deep.equal({ validFrom: beginning, validTo: now })
                .notify(done);
        });

        it('should accept context with validFrom and validTo parameters', function(done) {
            expect(util.resolveValidityParameters({ validFrom: now, validTo: later }))
                .to.eventually.deep.equal({ validFrom: now, validTo: later })
                .notify(done);
        });

        it('should accept context with no validity parameters and default to validOn=\'now\'', function(done) {
            expect(util.resolveValidityParameters({}))
                .to.eventually.have.property('validOn')
                .that.is.a('string')
                // Should work! (promise problem)
                // .that.is.iso8601('eq', now, 1000) // Within one second
                .notify(done);
        });

        it('should reject context with invalid validOn parameter', function(done) {
            expect(util.resolveValidityParameters({ validOn: invalid }))
                .to.eventually.be.rejectedWith('invalid validOn parameter in context')
                .notify(done);
        });

        it('should reject context with invalid validFrom parameter', function(done) {
            expect(util.resolveValidityParameters({ validFrom: invalid, validTo: later }))
                .to.eventually.be.rejectedWith('invalid validFrom parameter in context')
                .notify(done);
        });

        it('should reject context with invalid validTo parameter', function(done) {
            expect(util.resolveValidityParameters({ validFrom: now, validTo: invalid }))
                .to.eventually.be.rejectedWith('invalid validTo parameter in context')
                .notify(done);
        });

        it('should reject context with validOn and validFrom parameters', function(done) {
            expect(util.resolveValidityParameters({ validOn: now, validFrom: later }))
                .to.eventually.be.rejectedWith('both validOn and validFrom/validTo specified')
                .notify(done);
        });

        it('should reject context with validOn and validTo parameters', function(done) {
            expect(util.resolveValidityParameters({ validOn: now, validTo: later }))
                .to.eventually.be.rejectedWith('both validOn and validFrom/validTo specified')
                .notify(done);
        });

        it('should reject context with validFrom > validTo', function(done) {
            expect(util.resolveValidityParameters({ validFrom: later, validTo: now }))
                .to.eventually.be.rejectedWith('validFrom > validTo in context')
                .notify(done);
        });
    });
});
