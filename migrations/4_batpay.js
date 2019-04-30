const DeployUtils = require('../utils/DeploymentUtils');

const BatPay = artifacts.require('./BatPay');
const StandardToken = artifacts.require('./StandardToken');
const Merkle = artifacts.require('./Merkle');
const Challenge = artifacts.require('./Challenge');

module.exports = function(deployer, network) {
  const { deployedToken, batPay } = DeployUtils.getEnvConfig(network);

  return deployer.link(Merkle, BatPay);
  deployer.link(Challenge, BatPay);
  deployer
    .then(() => {
      if (typeof deployedToken === 'undefined' || deployedToken === '') {
        return { address: deployedToken };
      }
      return StandardToken.deployed();
    })
    .then(token =>
      deployer.deploy(
        BatPay,
        token.address,
        batPay.maxBulk,
        batPay.maxTransfer,
        batPay.challengeBlocks,
        batPay.challengeStepBlocks,
        batPay.collectStake,
        batPay.challengeStake,
        batPay.unlockBlocks,
        batPay.maxCollectAmount,
      ),
    );
};
