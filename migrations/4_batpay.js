const BatPay = artifacts.require('./BatPay')
const StandardToken = artifacts.require('./StandardToken')
const Merkle = artifacts.require('./Merkle')
const Challenge = artifacts.require('./Challenge')
const MassExitLib = artifacts.require('./MassExitLib')

module.exports = function (deployer) {
  deployer.link(Merkle, BatPay)
  deployer.link(Challenge, BatPay)
  deployer.link(MassExitLib, BatPay)
  deployer.then(() => {
    return StandardToken.deployed()
  }).then(token => {
    return deployer.deploy(BatPay,
      token.address,
      5000, // maxBulk
      3000, // maxTransfer
      5, // challengeBlocks
      2, // challengeStepBlocks
      500, // collectStake
      100, // challengeStake
      5) // unlockBlocks
  })
}
