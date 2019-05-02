const DeployUtils = require('../utils/DeploymentUtils');

const BatPay = artifacts.require('./BatPay');
const StandardToken = artifacts.require('./StandardToken');
const Merkle = artifacts.require('./Merkle');
const Challenge = artifacts.require('./Challenge');

module.exports = function(deployer, network) {
  const { deployedToken, batPay } = DeployUtils.getEnvConfig(network);

  deployer.link(Merkle, BatPay);
  deployer.link(Challenge, BatPay);
  deployer
    .then(() => {
      if (typeof deployedToken === 'undefined' || deployedToken === '') {
        return StandardToken.deployed();
      }
      return { address: deployedToken };
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
