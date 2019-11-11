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
const merkle = lib.merkle
var globalDebug = false

var b, id, challenger
var userid = []
var payid = []
var nUsers = 10
var nPays = 4
var maxPayIndex = 0
var slot = 0
var mid, amount, minIndex, data, otherIndex

async function showSlot (delegate, slot) {
  let x = await b.bp.collects.call(delegate, slot)
  x = x.map(x => x.toNumber ? x.toNumber() : x)
  console.log('state=' + x[6])
}

async function challenge (delegate, slot, challenger, list, index, payList, stop, debug = globalDebug) {
  if (debug) {
    await showSlot(delegate, slot)
    console.log(challenger + ' ' + b.ids[challenger])
  }

  let c1 = await b.challenge_1(delegate, slot, challenger)
  await c1

  if (debug) console.log('challenge_1 ' + c1.transactionHash)

  let amounts = list.map(x => b.payments[x].amount)

  let data = lib.Batpay.getChallengeData(amounts, list)

  if (debug) {
    await showSlot(delegate, slot)
    console.log(data)
  }
  if (stop == 1) {
    await utils.skipBlocks(b.challengeStepBlocks)
    return await b.challenge_success(delegate, slot, challenger)
  }

  let c2 = await b.challenge_2(delegate, slot, data)
  await c2
  if (debug) {
    console.log('challenge_2 ' + c2.transactionHash)
    await showSlot(delegate, slot)
  }
  if (stop == 2) {
    await utils.skipBlocks(b.challengeStepBlocks)
    return await b.challenge_failed(delegate, slot)
  }
  let payIndex = list[index]

  let c3 = await b.challenge_3(delegate, slot, data, index, challenger)
  await c3
  if (debug) {
    console.log('challenge_3 ' + c3.transactionHash)
    await showSlot(delegate, slot)
  }
  if (stop == 3) {
    await utils.skipBlocks(b.challengeStepBlocks)
    return await b.challenge_success(delegate, slot, challenger)
  }
  let payData = utils.getPayData(payList)

  let c4 = await b.challenge_4(delegate, slot, payData)
  await c4
  if (debug) {
    console.log('challenge_4 ' + c4.transactionHash)
    showSlot(delegate, slot)
    console.log('delegate=' + await b.balanceOf(delegate))
  }

  let c5 = await b.challenge_failed(delegate, slot)
  await c5
  if (debug) {
    console.log('challenge_failed ' + c5.transactionHash)
    showSlot(delegate, slot)
    console.log('delegate=' + await b.balanceOf(delegate))
  }
}

contract('challenge', (accounts) => {
  let a0 = accounts[0]
  let a1 = accounts[1]

  before(async function () {
    await utils.skipBlocks(1)
    let ins = await utils.newInstances()

    b = new Batpay.BP(ins.bp, ins.token)

    await b.init()
    let [mainId, receipt] = await b.deposit(100000, -1, accounts[0])
    id = mainId

    await b.tokenTransfer(accounts[0], accounts[1], 1000)

    let [ch, receipt2] = await b.deposit(1000, -1, accounts[1])
    challenger = ch

    for (let i = 0; i < nUsers; i++) {
      let [ id, t ] = await b.registerAccount(accounts[0])
      userid.push(id)
    }
  })

  beforeEach(async () => {
    payid = []
    maxPayIndex = 0
    slot++
    for (let i = 0; i < nPays; i++) {
      let lockingKeyHash = 0
      if (i == 2) lockingKeyHash = 1
      let [ pid, t ] = await b.registerPayment({
        fromAccountId: id,
        amount: 10,
        unlockerFee: 0,
        payeesAccountsIds: userid,
        lockingKeyHash: lockingKeyHash
      })
      payid.push(pid)
      if (pid > maxPayIndex) maxPayIndex = pid
    }
    let [ pid, t ] = await b.registerPayment({
      fromAccountId: id,
      amount: 10,
      unlockerFee: 0,
      payeesAccountsIds: [id],
      lockingKeyHash: 0
    })
    if (pid > maxPayIndex) maxPayIndex = pid
    otherIndex = pid
    await utils.skipBlocks(b.unlockBlocks)
    mid = userid[0]
    minIndex = await b.getCollectedIndex(mid)
    amount = await b.getCollectAmount(mid, minIndex, maxPayIndex + 1)
    data = b.getCollectData(mid, minIndex, maxPayIndex + 1)

    await b.collect({
      delegate: id,
      slot: slot,
      toAccountId: mid,
      fromPaymentId: minIndex,
      toPaymentId: maxPayIndex + 1,
      amount: amount,
      fee: 0,
      address: 0
    })
  })

  it('should complete a full challenge game #0', async () => {
    let index = 0
    let payIndex = data[index]
    let payList = b.getPayList(payIndex)
    await challenge(id, slot, challenger, data, index, payList)
  })
  it('should complete a full challenge game #1', async () => {
    let index = 1
    let payIndex = data[index]
    let payList = b.getPayList(payIndex)
    await challenge(id, slot, challenger, data, index, payList)
  })
  it('should claim a success after no response for challenge_1', async () => {
    let index = 1
    let payIndex = data[index]
    let payList = b.getPayList(payIndex)
    await challenge(id, slot, challenger, data, index, payList, stop = 1)
  })
  it('should claim a failure after no response for challenge_2', async () => {
    let index = 1
    let payIndex = data[index]
    let payList = b.getPayList(payIndex)
    await challenge(id, slot, challenger, data, index, payList, stop = 2)
  })
  it('should claim a success after no response for challenge_3', async () => {
    let index = 1
    let payIndex = data[index]
    let payList = b.getPayList(payIndex)
    await challenge(id, slot, challenger, data, index, payList, stop = 3)
  })
  it('should reject an invalid index', async () => {
    let index = maxPayIndex + 1
    let payIndex = data[index]
    let payList = b.getPayList(payIndex)
    await assertRequire(
      challenge(id, slot, challenger, data, index, payList),
      'index * 12 must be less or equal than (data.length - 12)')
  })
  it('should reject an invalid payData', async () => {
    let index = 0
    let payIndex = data[index]
    let payList = b.getPayList(payIndex)
    payList.pop()
    await assertRequire(
      challenge(id, slot, challenger, data, index, payList),
      'payData mismatch, payment\'s data hash doesn\'t match provided payData hash')
  })
  it('should reject an invalid amount', async () => {
    let index = 0
    let payIndex = data[index]
    let payList = b.getPayList(payIndex)
    data.pop()
    await assertRequire(
      challenge(id, slot, challenger, data, index, payList),
      "data doesn't represent collected amount")
  })
  it('should reject an invalid payment amount', async () => {
    data.pop()
    data.push(otherIndex)
    let index = data.length - 1
    let payIndex = data[index]
    let payList = b.getPayList(payIndex)

    await assertRequire(
      challenge(id, slot, challenger, data, index, payList),
      'amount mismatch')
  })

  it('should reject a locked payment', async () => {
    data.pop()
    data.push(otherIndex)
    let index = 2
    let payIndex = data[index]
    let payList = b.getPayList(payIndex)

    await assertRequire(
      challenge(id, slot, challenger, data, index, payList),
      'payment is locked')
  })
  it('Should challenge inline bulkRegistered accounts', async () => {
    let stake = b.collectStake
    let [id, r0] = await b.deposit(2*stake+1, -1, a0)
    const delegate = id;
    let [challenger, r2] = await b.deposit(2*stake+1, -1, a0)
    let [pid, bulk, r1] = await b.registerPaymentWithBulk(id, 1, 0, [delegate], [a1, a0, a1], 0)

    let toId = 1 + bulk.smallestAccountId

    await b.claimBulkRegistrationId(bulk, a0, toId, delegate)
    await utils.skipBlocks(b.unlockBlocks)

    let amount = await b.getCollectAmount(toId, 0, pid+1)
    let data = b.getCollectData(toId, 0, pid + 1)

    await b.collect({
      delegate,
      slot: 0,
      toAccountId: toId,
      fromPaymentId: 0,
      toPaymentId: pid + 1,
      amount: amount,
      fee: 0,
      address: 0
    })

    let index = 0
    let payIndex = data[index]
    let payList = b.getPayList(payIndex)


    await challenge(id, 0, challenger, data, index, payList)

    let b1 = (await b.balanceOf(id)).toNumber()

})
it('challenger winning should get back both collectStake + challengeStake', async () => {
  let index = 1
  let payIndex = data[index]
  let payList = b.getPayList(payIndex)
  let b0 = (await b.balanceOf(challenger)).toNumber()
  await challenge(id, slot, challenger, data, index, payList, stop = 3)
  let b1 = (await b.balanceOf(challenger)).toNumber()
  assert.equal(b1-b0, b.collectStake)
})
it('delegate winning should get challengeStake', async () => {
  let index = 1
  let payIndex = data[index]
  let payList = b.getPayList(payIndex)
  let b0 = (await b.balanceOf(id)).toNumber()
  await challenge(id, slot, challenger, data, index, payList)
  let b1 = (await b.balanceOf(id)).toNumber()
  assert.equal(b1-b0, b.challengeStake)
})


})
