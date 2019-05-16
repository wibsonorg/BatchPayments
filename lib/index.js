module.exports = function (web3, artifacts) {
  // truffle seems to require injecting these globals
  global.web3 = web3
  global.artifacts = artifacts

  var utils = require('../lib/utils')
  var { getInstances, newInstances } = utils
  var Batpay = require('../lib/Batpay')
  var merkle = require('../lib/merkle')

  return {
    Batpay,
    merkle,
    utils,
    getInstances,
    newInstances
  }
}
