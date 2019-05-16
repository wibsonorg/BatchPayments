
var StandardToken = artifacts.require('StandardToken')
var BatPay = artifacts.require('BatPay')
const catchRevert = require('./exceptions').catchRevert
const truffleAssertions = require('truffle-assertions')
const assertRequire = truffleAssertions.reverts
const assertPasses = truffleAssertions.passes
const eventEmitted = truffleAssertions.eventEmitted
var BigNumber = web3.BigNumber
var lib = require('../lib')(web3, artifacts)
var { utils, Batpay } = lib
const TestHelper = artifacts.require('./TestHelper')
const merkle = lib.merkle

var test

contract('Payments', (accounts) => {
  let a0 = accounts[0]
  let a1 = accounts[1]

  let bp, tAddress, st
  const NEW_ACCOUNT_FLAG = new BigNumber(2).pow(256).minus(1)

  before(async function () {
    await utils.skipBlocks(1)
    let ret = await utils.newInstances()
    bp = ret.bp
    st = ret.token

    test = await TestHelper.new()
  })

  describe('registerPayment', () => {
    const rootHash = web3.fromUtf8('1234');
    const new_count = 0
    const metadata = 0
    const fee = 10
    let unlocker_id = 0
    const amount_each = 1
    let list
    let pay_data
    let total_amount
    let v0
    let from_id
    let t0
    let key
    let lockingKeyHash
    let b0
    let unlockBlocks

    beforeEach(async () => {
      // create a list of 100 random ids
      list = utils.randomIds(100, 50000, 'batpay tests seed')
      pay_data = utils.getPayData(list)
      total_amount = amount_each * list.length + fee

      // put enough funds to transfer and bulk register ids
      await st.approve(bp.address, total_amount * 2)
      t0 = await bp.deposit(total_amount * 2, NEW_ACCOUNT_FLAG)
      from_id = await bp.getAccountsLength.call() - 1
      v0 = await bp.bulkRegister(list.length, rootHash)

      // create lockingKeyHash
      key = 'this-is-the-key'
      lockingKeyHash = utils.hashLock(0, key)
      unlockBlocks = (await bp.params.call())[6].toNumber()

      // initial balance
      b0 = (await bp.balanceOf.call(from_id)).toNumber()
    })

    it('should support up 100s of ids', async () => {
      // registerPayment(fromId, amount, fee, payData, newCount, roothash, lockingKeyHash, metadata)
      await bp.registerPayment(from_id, amount_each, fee, pay_data, new_count, rootHash, lockingKeyHash, metadata)

      // check balance
      let b1 = (await bp.balanceOf.call(from_id)).toNumber()
      assert.equal(b0, b1 + total_amount)
    })

    it('should reject invalid ids', async () => {
      const from_id = await bp.getAccountsLength.call()
      await assertRequire(bp.registerPayment(from_id, amount_each, fee, pay_data, new_count, rootHash, lockingKeyHash, metadata), 'Invalid fromId')
    })

    it('should reject amount zero as payment', async () => {
      const amount_each = 0
      await assertRequire(bp.registerPayment(from_id, amount_each, fee, pay_data, new_count, rootHash, lockingKeyHash, metadata), 'Invalid amount')
      // check original balance didn't change
      const b1 = (await bp.balanceOf.call(from_id)).toNumber()
      assert.equal(b0, b1)
    })

    it('should reject rootHash zero if newCount > 0', async () => {
      const new_count = 10
      const rootHash = 0
      await assertRequire(bp.registerPayment(from_id, amount_each, fee, pay_data, new_count, rootHash, lockingKeyHash, metadata), 'Invalid root hash')
      // check original balance didn't change
      const b1 = (await bp.balanceOf.call(from_id)).toNumber()
      assert.equal(b0, b1)
    })

    it('should reject fee payment with no lock', async () => {
      const fee = 10
      const lockingKeyHash = 0
      await assertRequire(bp.registerPayment(from_id, amount_each, fee, pay_data, new_count, rootHash, lockingKeyHash, metadata), 'Invalid lock hash')
      // check original balance didn't change
      const b1 = (await bp.balanceOf.call(from_id)).toNumber()
      assert.equal(b0, b1)
    })

    it('should accept registerPayment+unlock with good key', async () => {
      let v1 = await bp.registerPayment(from_id, 1, fee, pay_data, new_count, rootHash, lockingKeyHash, metadata)
      let payId = (await bp.getPaymentsLength.call()).toNumber() - 1

      await bp.unlock(payId, unlocker_id, key)

      // check balance
      let b1 = (await bp.balanceOf.call(from_id)).toNumber()
      assert.equal(b0, b1 + total_amount)
    })

    it('should reject registerPayment+unlock with bad key', async () => {
      let v1 = await bp.registerPayment(from_id, amount_each, fee, pay_data, new_count, rootHash, lockingKeyHash, metadata)
      let payId = (await bp.getPaymentsLength.call()).toNumber() - 1

      await assertRequire(bp.unlock(payId, unlocker_id, 'not-the-key'), 'Invalid key')

      // check balance
      let b1 = (await bp.balanceOf.call(from_id)).toNumber()
      assert.equal(b0, b1 + total_amount)
    })

    it('should accept registerPayment+refund after timeout', async () => {
      let v1 = await bp.registerPayment(from_id, amount_each, fee, pay_data, new_count, rootHash, lockingKeyHash, metadata)
      let payId = (await bp.getPaymentsLength.call()).toNumber() - 1

      await utils.skipBlocks(unlockBlocks)
      let v2 = await bp.refundLockedPayment(payId)
      eventEmitted(v2, 'PaymentRefunded')

      // check original balance didn't change
      let b1 = (await bp.balanceOf.call(from_id)).toNumber()
      assert.equal(b0, b1)
    })

    it('should reject registerPayment+refund before timeout', async () => {
      let v1 = await bp.registerPayment(from_id, amount_each, fee, pay_data, new_count, rootHash, lockingKeyHash, metadata)
      let payId = (await bp.getPaymentsLength.call()).toNumber() - 1

      await assertRequire(bp.refundLockedPayment(payId), 'Hash lock has not expired yet')

      // check balance
      let b1 = (await bp.balanceOf.call(from_id)).toNumber()
      assert.equal(b0, b1 + total_amount)
    })

    it('should reject registerPayment if bytes per id is 0', async () => {
      const bytesPerId = 0
      pay_data = new web3.BigNumber('0xff' + utils.hex(bytesPerId))

      await assertRequire(bp.registerPayment(from_id, amount_each, fee, pay_data, new_count, rootHash, lockingKeyHash, metadata), 'second byte of payData should be positive')

      // check original balance didn't change
      let b1 = (await bp.balanceOf.call(from_id)).toNumber()
      assert.equal(b0, b1)
    })

    it('should reject registerPayment if bytes payData length is invalid', async () => {
      const bytesPerId = 4
      const data = '0000005'
      pay_data = new web3.BigNumber('0xff' + utils.hex(bytesPerId) + data)

      await assertRequire(bp.registerPayment(from_id, amount_each, fee, pay_data, new_count, rootHash, lockingKeyHash, metadata), 'payData length is invalid, all payees must have same amount of bytes (payData[1])')

      // check original balance didn't change
      let b1 = (await bp.balanceOf.call(from_id)).toNumber()
      assert.equal(b0, b1)
    })

    it('should reject registerPayment if there are too many payees', async () => {
      // NOTE: there are 2 checks that depend on newCount:
      //   1. (payData.length-2) / bytesPerId + newCount < maxTransfer = 100000
      //   2. accounts.length + newCount < MAX_ACCOUNT_ID = 2 ** 32
      //
      // because 100000 < 2 ** 32 we can only trigger the first condition
      let toobig_count = 100000 // this should actually be bp.maxTransfer, however it crashes

      await assertRequire(bp.registerPayment(from_id, amount_each, fee, pay_data, toobig_count, rootHash, lockingKeyHash, metadata), 'Too many payees, it should be less than config maxTransfer')

      // check original balance didn't change
      let b1 = (await bp.balanceOf.call(from_id)).toNumber()
      assert.equal(b0, b1)
    })

    it('should reject registerPayment if balance is not enough', async () => {
      let balance = await bp.balanceOf(from_id)
      let new_count = list.length
      let invalid_amount = balance + 1

      await assertRequire(bp.registerPayment(from_id, invalid_amount, fee, pay_data, new_count, rootHash, lockingKeyHash, metadata), 'not enough funds')

      // check original balance didn't change
      let b1 = (await bp.balanceOf.call(from_id)).toNumber()
      assert.equal(b0, b1)
    })

    it('should correctly substract balance on registerPayment with new-count=0', async () => {
      let balance0 = await bp.balanceOf(from_id)
      let new_count = 0

      await bp.registerPayment(from_id, amount_each, fee, pay_data, new_count, rootHash, lockingKeyHash, metadata)
      let balance1 = await bp.balanceOf(from_id)

      assert.equal(balance0 - balance1, total_amount)
    })

    it('should correctly substract balance on registerPayment with new-count=10', async () => {
      let balance0 = await bp.balanceOf(from_id)
      let new_count = 10

      await bp.registerPayment(from_id, amount_each, fee, pay_data, new_count, rootHash, lockingKeyHash, metadata)
      let balance1 = await bp.balanceOf(from_id)

      assert.equal(balance0 - balance1, total_amount + amount_each * new_count)
    })

    it('should correctly substract balance on registerPayment with new-count=1', async () => {
      let balance0 = await bp.balanceOf(from_id)
      let new_count = 1

      await bp.registerPayment(from_id, amount_each, fee, pay_data, new_count, rootHash, lockingKeyHash, metadata)
      let balance1 = await bp.balanceOf(from_id)

      assert.equal(balance0 - balance1, total_amount + amount_each * new_count)
    })

    it('should correctly substract balance on registerPayment with no payData', async () => {
      let balance0 = await bp.balanceOf(from_id)
      let new_count = 10

      let pdata = utils.getPayData([])
      await bp.registerPayment(from_id, amount_each, fee, pdata, new_count, rootHash, lockingKeyHash, metadata)
      let balance1 = await bp.balanceOf(from_id)

      assert.equal(balance0 - balance1, fee + amount_each * new_count)
    })
  })

  describe('collect', () => {
    let b, id
    let userid = []
    let payid = []
    let nUsers = 10
    let nPays = 10
    let maxPayIndex = 0

    before(async () => {
      b = new Batpay.BP(bp, st)

      await b.init()
      let [mainId, receipt] = await b.deposit(100000, -1, accounts[0])
      id = mainId

      for (let i = 0; i < nUsers; i++) {
        let [ id, t ] = await b.registerAccount(accounts[0])
        userid.push(id)
      }

      for (let i = 0; i < nPays; i++) {
        let [ pid, t ] = await b.registerPayment({
          fromAccountId: id,
          amount: 10,
          unlockerFee: 0,
          payeesAccountsIds: userid,
          lockingKeyHash: 0
        })
        payid.push(pid)
        if (pid > maxPayIndex) maxPayIndex = pid
      }

      await utils.skipBlocks(b.unlockBlocks)
    })

    it('should collect', async () => {
      let mid = userid[0]
      let amount = await b.getCollectAmount(mid, 0, maxPayIndex + 1)
      let b0 = (await b.balanceOf(mid)).toNumber()
      const txr = await b.collect({
        delegate: id,
        slot: 0,
        toAccountId: mid,
        fromPaymentId: 0,
        toPaymentId: maxPayIndex + 1,
        amount: amount,
        fee: 0,
        address: 0
      })
      await utils.skipBlocks(b.challengeBlocks)
      await b.freeSlot(id, 0)
      let b1 = (await b.balanceOf(mid)).toNumber()
      assert.equal(b0 + amount, b1)
      eventEmitted(txr, 'Collect')
    })

    it('should instant-collect', async () => {
      let mid = userid[1]
      let amount = await b.getCollectAmount(mid, 0, maxPayIndex + 1)
      let b0 = (await b.balanceOf(mid)).toNumber()
      await b.collect({
        delegate: id,
        slot: b.INSTANT_SLOT,
        toAccountId: mid,
        fromPaymentId: 0,
        toPaymentId: maxPayIndex + 1,
        amount: amount,
        fee: 0,
        address: 0
      })
      let b1 = (await b.balanceOf(mid)).toNumber()

      assert.equal(b0 + amount, b1)
    })

    it('should reuse slot', async () => {
      let mid = userid[2]
      let amount = await b.getCollectAmount(mid, 0, maxPayIndex / 2)
      let b0 = (await b.balanceOf(mid)).toNumber()
      await b.collect({
        delegate: id,
        slot: 1,
        toAccountId: mid,
        fromPaymentId: 0,
        toPaymentId: maxPayIndex / 2,
        amount: amount,
        fee: 0,
        address: 0
      })
      await utils.skipBlocks(b.challengeBlocks)
      let amount2 = await b.getCollectAmount(mid, maxPayIndex / 2, maxPayIndex + 1)
      // await b.freeSlot(id, 1);
      await b.collect({
        delegate: id,
        slot: 1,
        toAccountId: mid,
        fromPaymentId: maxPayIndex / 2,
        toPaymentId: maxPayIndex + 1,
        amount: amount2,
        fee: 0,
        address: 0
      })
      let b1 = (await b.balanceOf(mid)).toNumber()
      await utils.skipBlocks(b.challengeBlocks)
      await b.freeSlot(id, 1)
      let b2 = (await b.balanceOf(mid)).toNumber()
      assert.equal(b0 + amount, b1)
      assert.equal(b1 + amount2, b2)
    })

    it('should pay fee on instant-collect', async () => {
      let mid = userid[3]
      let slot = b.INSTANT_SLOT + 1
      let amount = await b.getCollectAmount(mid, 0, maxPayIndex + 1)
      let fee = Math.floor(amount / 3)
      let b0 = (await b.balanceOf(mid)).toNumber()
      let c0 = (await b.balanceOf(id)).toNumber()
      await b.collect({
        delegate: id,
        slot: slot,
        toAccountId: mid,
        fromPaymentId: 0,
        toPaymentId: maxPayIndex + 1,
        amount: amount,
        fee: amount / 3,
        address: 0
      })
      await utils.skipBlocks(b.challengeBlocks)
      await b.freeSlot(id, slot)

      let b1 = (await b.balanceOf(mid)).toNumber()
      let c1 = (await b.balanceOf(id)).toNumber()

      assert.equal(b0 + amount - fee, b1)
      assert.equal(c0 + fee, c1)
    })

    it('should pay fee', async () => {
      let mid = userid[4]
      let slot = 2
      let amount = await b.getCollectAmount(mid, 0, maxPayIndex + 1)
      let fee = Math.floor(amount / 3)
      let b0 = (await b.balanceOf(mid)).toNumber()
      let c0 = (await b.balanceOf(id)).toNumber()
      await b.collect({
        delegate: id,
        slot: slot,
        toAccountId: mid,
        fromPaymentId: 0,
        toPaymentId: maxPayIndex + 1,
        amount: amount,
        fee: amount / 3,
        address: 0
      })
      await utils.skipBlocks(b.challengeBlocks)
      await b.freeSlot(id, slot)

      let b1 = (await b.balanceOf(mid)).toNumber()
      let c1 = (await b.balanceOf(id)).toNumber()

      assert.equal(b0 + amount - fee, b1)
      assert.equal(c0 + fee, c1)
    })

    it('should withdraw if requested', async () => {
      let mid = userid[5]
      let slot = 3
      let amount = await b.getCollectAmount(mid, 0, maxPayIndex + 1)
      let fee = Math.floor(amount / 3)
      let b0 = (await b.balanceOf(mid)).toNumber()
      let c0 = (await b.balanceOf(id)).toNumber()
      let d0 = (await b.tokenBalance(accounts[1])).toNumber()

      await b.collect({
        delegate: id,
        slot: slot,
        toAccountId: mid,
        fromPaymentId: 0,
        toPaymentId: maxPayIndex + 1,
        amount: amount,
        fee: amount / 3,
        address: accounts[1]
      })
      await utils.skipBlocks(b.challengeBlocks)
      await b.freeSlot(id, slot)

      let b1 = (await b.balanceOf(mid)).toNumber()
      let c1 = (await b.balanceOf(id)).toNumber()
      let d1 = (await b.tokenBalance(accounts[1])).toNumber()

      assert.equal(d0 + amount - fee, d1)
      assert.equal(c0 + fee, c1)
      //  assert.equal(b1, 0);
    })

    it('should withdraw if requested instant', async () => {
      let mid = userid[6]
      let slot = b.INSTANT_SLOT + 2
      let amount = await b.getCollectAmount(mid, 0, maxPayIndex + 1)
      let fee = Math.floor(amount / 3)
      let b0 = (await b.balanceOf(mid)).toNumber()
      let c0 = (await b.balanceOf(id)).toNumber()
      let d0 = (await b.tokenBalance(accounts[1])).toNumber()

      await b.collect({
        delegate: id,
        slot: slot,
        toAccountId: mid,
        fromPaymentId: 0,
        toPaymentId: maxPayIndex + 1,
        amount: amount,
        fee: amount / 3,
        address: accounts[1]
      })
      let b1 = (await b.balanceOf(mid)).toNumber()
      let d1 = (await b.tokenBalance(accounts[1])).toNumber()

      await utils.skipBlocks(b.challengeBlocks)
      await b.freeSlot(id, slot)

      let c1 = (await b.balanceOf(id)).toNumber()

      assert.equal(d0 + amount - fee, d1)
      assert.equal(c0 + fee, c1)
      assert.equal(b1, 0)
    })

    it('should reject if payIndex is less or equal to last collected payment ID', async () => {
      let collectorAccountId = userid[6]
      let slot = b.INSTANT_SLOT
      let amount = await b.getCollectAmount(collectorAccountId, 0, maxPayIndex + 1)
      let [, , lastCollectedPaymentId] = await b.getAccount(collectorAccountId)

      await assertRequire(b.collect({
        delegate: id,
        slot: slot,
        toAccountId: collectorAccountId,
        fromPaymentId: lastCollectedPaymentId.toNumber() - 1,
        toPaymentId: maxPayIndex + 1,
        amount: amount,
        fee: amount / 3,
        address: accounts[1]
      }))
    })

    it('should reject if payIndex is invalid', async () => {
      let collectorId = userid[6]
      let slot = b.INSTANT_SLOT + 2
      let amount = await b.getCollectAmount(collectorId, 0, maxPayIndex + 1)
      let [, , lastCollectedPaymentId] = await b.getAccount(collectorId)
      const tooHighPayIndex = (await b.getPaymentsLength()) + 1

      await assertRequire(
        b.collect({
          delegate: id,
          slot: slot,
          toAccountId: collectorId,
          fromPaymentId: lastCollectedPaymentId.toNumber(),
          toPaymentId: tooHighPayIndex,
          amount: amount,
          fee: amount / 3,
          address: accounts[1]
        }),
        'invalid maxPayIndex, payments is not that long yet'
      )
    })

    it('should reject if invalid toAccountId', async () => {
      let mid = userid[6]
      let slot = b.INSTANT_SLOT + 2
      let amount = await b.getCollectAmount(mid, 0, maxPayIndex + 1)
      const invalidCollectorId = 123454321
      // We need a valid address to sign the collect transaction.
      b.ids[invalidCollectorId] = accounts[0]

      await assertRequire(
        b.collect({
          delegate: id,
          slot: slot,
          toAccountId: invalidCollectorId,
          fromPaymentId: 0,
          toPaymentId: 1,
          amount: amount,
          fee: amount / 3,
          address: accounts[1]
        }),
        'toAccountId must be a valid account id'
      )
    })

    it('should reject wrong fromPayIndex / Invalid Signature', async () => {
      let collectorId = userid[7]
      let slot = b.INSTANT_SLOT + 2
      let amount = await b.getCollectAmount(collectorId, 0, maxPayIndex + 1)
      const invalidFromPayIndex = 123454321

      await assertRequire(
        b.collect({
          delegate: id,
          slot: slot,
          toAccountId: collectorId,
          fromPaymentId: invalidFromPayIndex,
          toPaymentId: maxPayIndex,
          amount: amount,
          fee: amount / 3,
          address: 0
        }),
        'Bad user signature'
      )
    })

      it('Should not allow race condition on collect', async () => {
        let stake = b.collectStake
        let [id, r0] = await b.deposit(2*stake+1, -1, a0)
        let [pid, r1] = await b.registerPayment({
          fromAccountId: id,
          amount: 1,
          unlockerFee: 0,
          payeesAccountsIds: [id],
          lockingKeyHash: 0
        })
        utils.skipBlocks(b.unlockBlocks)

        let b0 = (await b.balanceOf(id)).toNumber()
        await b.collect({
          delegate: id,
          slot: b.INSTANT_SLOT,
          toAccountId: id,
          fromPaymentId: 0,
          toPaymentId: pid+1,
          amount: stake,
          fee: 0,
          address: 0
        })
        let b1 = (await b.balanceOf(id)).toNumber()

        assert.isBelow(b1, b0)

    })

    it('Should reject collects over maxCollectAmount', async () => {
      let stake = b.collectStake
      let [id, r0] = await b.deposit(2*stake+1, -1, a0)
      let [pid, r1] = await b.registerPayment({
        fromAccountId: id,
        amount: 1,
        unlockerFee: 0,
        payeesAccountsIds: [id],
        lockingKeyHash: 0
      })
      utils.skipBlocks(b.unlockBlocks)

       let b0 = (await b.balanceOf(id)).toNumber()
      await assertRequire(b.collect({
        delegate: id,
        slot: 0,
        toAccountId: id,
        fromPaymentId: 0,
        toPaymentId: pid+1,
        amount: b.maxCollectAmount+1,
        fee: 0,
        address: 0
      }),
        "declaredAmount is too big")
    })

    it('Should accept collects with just maxCollectAmount', async () => {
      let stake = b.collectStake
      let [id, r0] = await b.deposit(2*stake+1, -1, a0)
      let [pid, r1] = await b.registerPayment({
        fromAccountId: id,
        amount: 1,
        unlockerFee: 0,
        payeesAccountsIds: [id],
        lockingKeyHash: 0
      })
      utils.skipBlocks(b.unlockBlocks)

      let b0 = (await b.balanceOf(id)).toNumber()
      await b.collect({
        delegate: id,
        slot: 0,
        toAccountId: id,
        fromPaymentId: 0,
        toPaymentId: pid+1,
        amount: b.maxCollectAmount,
        fee: 0,
        address: 0
      })
    })


  })

})
