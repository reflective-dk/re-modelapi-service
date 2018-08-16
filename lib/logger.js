"use strict";

var bunyan = require('bunyan');
var config = require.main.require('./package.json').config;

// global global_logger
module.exports = global_logger = bunyan.createLogger({
    name: config.serviceName,
    level: config.logLevel
});
