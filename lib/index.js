
module.exports = function(web3, artifacts) {
    global.web3 = web3;
    global.artifacts = artifacts;

    // truffle seems to require injecting these globals


    var utils = require('../lib/utils');
    var { getInstances, newInstances } = utils;
    var bat = require('../lib/bat');
    var merkle = require('../lib/merkle');

    return { 
    bat,
    merkle,
    utils,
    getInstances,
    newInstances,
    }
}