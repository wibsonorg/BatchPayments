const lib = require('../lib')(web3, artifacts)
const BatPay = artifacts.require('./BatPay')
const StandardToken = artifacts.require('./StandardToken')
const utils = lib.utils
const merkle = lib.merkle
const BP = lib.bat.BP
const bat = lib.bat

// Globals
var accounts
var b

async function main () {
  console.log('Instantiating contracts')
  let x = await lib.newInstances(bat.prefs.testing)
  b = new BP(x.bp, x.token)
  await b.init()

  console.log('registering')
  for (let i = 0; i < 10; i++) await b.register(accounts[i])
  await b.showBalance()

  console.log('bulkRegistering accounts')
  let list = []
  let nbulk = 100
  for (let i = 0; i < nbulk; i++) list.push(accounts[i % 10])
  console.log('list', list)

  let bulk = await b.bulkRegister(list)
  console.log('claiming ' + nbulk + ' accounts')
  let w = []
  for (let i = 0; i < nbulk; i++) {
    w.push(b.claimBulkRegistrationId(bulk, list[i], i + bulk.smallestAccountId))
  }
  await Promise.all(w)

  console.log('transfering some tokens')
  for (let i = 1; i < accounts.length; i++) { await b.tokenTransfer(accounts[0], accounts[i], 1000) }

  await b.showBalance()

  console.log('deposit')
  await b.deposit(10000, 0)
  await b.deposit(500, 8)
  await b.showBalance()

  let key = 'hello world'
  let p = []
  let m = 20

  let unlocker = 9

  console.log('doing ' + m + ' transfers & unlocks')
  for (let i = 0; i < m; i++) {
    console.log('registerPayment', i)
    let [payIndex] = await b.registerPayment(0, 10, 1, [1, 2, 3, 4, 5], utils.hashLock(unlocker, key))
    p.push(payIndex)
    await b.unlock(payIndex, unlocker, key)
  }

  await b.showBalance()
  console.log('payments:')
  console.log(b.payments)
  console.log('payList')
  console.log(b.payList)

  await skipBlocks(b.unlockBlocks)

  let max = p[(p.length / 2) - 1] + 1

  console.log('collect without instant slot. payIndex=' + max)
  let minIndex = await b.getCollectedIndex(3)

  for (let i = 1; i <= 5; i++) {
    let [addr, bb, c] = await b.getAccount(i)

    c = c.toNumber()
    addr = 0
    if (i == 5) addr = b.ids[6] // #5 withdraw to #6

    let amount = await b.getCollectAmount(i, c, max)
    await b.collect(0, i, i, c, max, amount, 2, addr)
  }

  await b.showBalance()
  console.log('challenging #3')

  let data = b.getCollectData(3, minIndex, max)
  await challenge(0, 3, 8, data)

  await skipBlocks(b.challengeBlocks)
  console.log('Freeing collect slots')
  for (let i = 1; i <= 5; i++) {
    await b.freeSlot(0, i)
  }
  await b.showBalance()

  max = p[p.length - 1] + 1
  console.log('collect with instant slot. payIndex=' + max)

  for (let i = 1; i <= 5; i++) {
    let [addr, bb, c] = await b.getAccount(i)

    c = c.toNumber()
    addr = 0
    if (i == 5) addr = b.ids[6] // #5 withdraw to #6

    let amount = await b.getCollectAmount(i, c, max)
    if (i == 3) amount = amount + 100

    await b.collect(0, i + b.instantSlot, i, c, max, amount, 1, addr)
  }

  await b.showBalance()

  await skipBlocks(b.challengeBlocks)
  console.log('Freeing collect slots')
  for (let i = 1; i <= 5; i++) {
    console.log('freeSlot', i)
    await b.freeSlot(0, i + b.instantSlot)
  }
  await b.showBalance()
}

async function skipBlocks (n) {
  console.log('block number: ', web3.eth.blockNumber)
  console.log('skipping ' + n + ' blocks')
  await utils.skipBlocks(n)
  console.log('block number: ', web3.eth.blockNumber)
}

async function showSlot (delegate, slot) {
  let x = await b.bp.collects.call(delegate, slot)
  x = x.map(x => x.toNumber ? x.toNumber() : x)
  console.log('state=' + x[6])
}

async function challenge (delegate, slot, challenger, list) {
  await showSlot(delegate, slot)
  let c1 = await b.challenge_1(delegate, slot, challenger)
  await c1
  console.log('challenge_1 ' + c1.transactionHash)

  let amounts = list.map(x => b.payments[x])

  let data = lib.bat.getChallengeData(amounts, list)

  await showSlot(delegate, slot)
  console.log(data)

  let c2 = await b.challenge_2(delegate, slot, data)
  await c2
  console.log('challenge_2 ' + c2.transactionHash)
  await showSlot(delegate, slot)

  let c3 = await b.challenge_3(delegate, slot, data, 1, challenger)
  await c3
  console.log('challenge_3 ' + c3.transactionHash)
  let payData = utils.getPayData([1, 2, 3, 4, 5])
  await showSlot(delegate, slot)

  let c4 = await b.challenge_4(delegate, slot, payData)
  await c4
  console.log('challenge_4 ' + c4.transactionHash)
  showSlot(delegate, slot)

  console.log('delegate=' + await b.balanceOf(delegate))
  let c5 = await b.challenge_failed(delegate, slot)
  await c5
  console.log('challenge_failed ' + c5.transactionHash)
  showSlot(delegate, slot)
  console.log('delegate=' + await b.balanceOf(delegate))
}

function demo (callback) {
  web3.eth.getAccounts(async (error, acc) => {
    accounts = acc
    if (error) throw new Error('Could not get accounts')
    try {
      await main()
      callback()
    } catch (e) {
      callback(e)
    }
  })
}

module.exports = demo
