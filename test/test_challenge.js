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
const merkle = lib.merkle
var globalDebug = false

var b, id, challenger
var acc
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

  let amounts = list.map(x => b.payments[x])

  let data = lib.bat.getChallengeData(amounts, list)

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

before(async function () {

})

contract('challenge', () => {
  before(async function () {
    this.timeout(10000)
    await utils.skipBlocks(1)
    let ins = await utils.getInstances()

    b = new bat.BP(ins.bp, ins.token)
    acc = web3.eth.accounts

    await b.init()
    let [mainId, receipt] = await b.deposit(100000, -1, acc[0])
    id = mainId

    await b.tokenTransfer(acc[0], acc[1], 1000)

    let [ch, receipt2] = await b.deposit(1000, -1, acc[1])
    challenger = ch

    for (let i = 0; i < nUsers; i++) {
      let [ id, t ] = await b.register(acc[0])
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
      let [ pid, t ] = await b.registerPayment(id, 10, 2, userid, lockingKeyHash)
      payid.push(pid)
      if (pid > maxPayIndex) maxPayIndex = pid
    }
    let [ pid, t ] = await b.registerPayment(id, 10, 2, [id], 0)
    if (pid > maxPayIndex) maxPayIndex = pid
    otherIndex = pid
    await utils.skipBlocks(b.unlockBlocks)
    mid = userid[0]
    minIndex = await b.getCollectedIndex(mid)
    amount = await b.getCollectAmount(mid, minIndex, maxPayIndex + 1)
    data = b.getCollectData(mid, minIndex, maxPayIndex + 1)

    await b.collect(id, slot, mid, minIndex, maxPayIndex + 1, amount, 0, 0)
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
      'invalid index')
  })
  it('should reject an invalid payData', async () => {
    let index = 0
    let payIndex = data[index]
    let payList = b.getPayList(payIndex)
    payList.pop()
    await assertRequire(
      challenge(id, slot, challenger, data, index, payList),
      'payData is incorrect')
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
})
