"use strict";

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;
var rp = require('request-promise');

var serviceUrl = 'http://localhost:8080';
var headers = {
    'Content-type': 'application/json',
    context: '{"domain": "base"}'
};

describe('modelapi service', function() {
    describe('modelapi', function() {
    });
});
