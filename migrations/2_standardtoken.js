const StandardToken = artifacts.require('./StandardToken')

module.exports = function (deployer, network) {
  if(network !== "remoteDevelopment"){
    return deployer.deploy(StandardToken, 'Token', 'TOK', 2, 1000000)
  }
}
