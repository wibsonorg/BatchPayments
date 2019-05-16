var StandardToken = artifacts.require('StandardToken')
var BatPay = artifacts.require('BatPay')
const catchRevert = require('./exceptions').catchRevert
const truffleAssertions = require('truffle-assertions')
const assertRequire = truffleAssertions.reverts
const assertPasses = truffleAssertions.passes
const eventEmitted = truffleAssertions.eventEmitted
var BigNumber = web3.BigNumber
var lib = require('../lib')(web3, artifacts)
var { utils, bat } = lib
const TestHelper = artifacts.require('./TestHelper')
const merkle = lib.merkle

contract('BatPay', (addr) => {
  describe('input Validation', () => {
    it('cannot create a BatPay with token address at zero', async () => {
      await assertRequire(utils.newInstances({}, 0x0), 'Token address can\'t be zero');
    });
    it('cannot create a BatPay with maxBulk at zero', async () => {
      await assertRequire(utils.newInstances({ maxBulk: 0 }), 'Parameter maxBulk can\'t be zero');
    });
    it('cannot create a BatPay with maxTransfer at zero', async () => {
      await assertRequire(utils.newInstances({ maxTransfer: 0 }), 'Parameter maxTransfer can\'t be zero');
    });
    it('cannot create a BatPay with challengeBlocks at zero', async () => {
      await assertRequire(utils.newInstances({ challengeBlocks: 0 }), 'Parameter challengeBlocks can\'t be zero');
    });
    it('cannot create a BatPay with challengeStepBlocks at zero', async () => {
      await assertRequire(utils.newInstances({ challengeStepBlocks: 0 }), 'Parameter challengeStepBlocks can\'t be zero');
    });
    it('cannot create a BatPay with collectStake at zero', async () => {
      await assertRequire(utils.newInstances({ collectStake: 0 }), 'Parameter collectStake can\'t be zero');
    });
    it('cannot create a BatPay with challengeStake at zero', async () => {
      await assertRequire(utils.newInstances({ challengeStake: 0 }), 'Parameter challengeStake can\'t be zero');
    });
    it('cannot create a BatPay with unlockBlocks at zero', async () => {
      await assertRequire(utils.newInstances({ unlockBlocks: 0 }), 'Parameter unlockBlocks can\'t be zero');
    });
    it('cannot create a BatPay with maxCollectAmount at zero', async () => {
      await assertRequire(utils.newInstances({ maxCollectAmount: 0 }), 'Parameter maxCollectAmount can\'t be zero');
    });
  });

  describe('misc', () => {
    var test
    var unlockBlocks

    let a0 = addr[0]
    let a1 = addr[1]

    let batPay, tAddress, st
    const NEW_ACCOUNT_FLAG = new BigNumber(2).pow(256).minus(1)

    before(async () => {
      let ret = await utils.newInstances()
      batPay = ret.bp
      st = ret.token

      test = await TestHelper.new()

      let params = await batPay.params.call()

      unlockBlocks = params[7].toNumber()
      challengeBlocks = params[3].toNumber()
      challengeStepBlocks = params[4].toNumber()
      INSTANT_SLOT = (await batPay.INSTANT_SLOT.call()).toNumber()
    })

    it('cannot obtain the balance for invalid id', async () => {
      let l0 = await batPay.getAccountsLength.call()
      let invalid_id = l0.toNumber()

      await assertRequire(batPay.balanceOf(invalid_id), 'accountId is not valid')
      await assertRequire(batPay.balanceOf(invalid_id + 1), 'accountId is not valid')
    })
  })
})
