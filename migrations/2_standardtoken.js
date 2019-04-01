const StandardToken = artifacts.require('./StandardToken')

module.exports = function (deployer) {
  return deployer.deploy(StandardToken, 'Token', 'TOK', 2, 1000000)
}
