const DeployUtils = require('../utils/DeploymentUtils');

const StandardToken = artifacts.require('./StandardToken');

module.exports = function(deployer, network) {
  const { deployedToken } = DeployUtils.getEnvConfig(network);
  if (typeof deployedToken === 'undefined' || deployedToken === '') {
    return deployer.deploy(StandardToken, 'Token', 'TOK', 2, 1000000);
  }
};
