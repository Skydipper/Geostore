'use strict';
//load modules

var config = require('config');
var logger = require('logger');
var mongoose = require('mongoose');
var co = require('co');
var mongoUri = process.env.MONGO_URI || 'mongodb://' + config.get('mongodb.host') + ':' + config.get('mongodb.port') + '/' + config.get('mongodb.database');
var data = require('./coverage_layers.json');

var onDbReady = function (err) {
    if (err) {
        logger.error(err);
        throw new Error(err);
    }
    var CoverageService = require('services/coverageService');
    co(function* () {
        yield CoverageService.populateCoverages(data);
    }).then(function () {
        logger.info('All correct!!!');
        process.exit(0);
    }, function (e) {
        logger.error('Error', e);
        process.exit(0);
    });


};

mongoose.connect(mongoUri, onDbReady);
