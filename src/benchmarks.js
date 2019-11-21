var lib = require('../lib')(web3, artifacts)
var bat = lib.Batpay
var utils = lib.utils
var bp, st
var b

const passcode = 'x1234'
const max = 200000 // size of the user set
const depositAmount = 900000

var stats = {}
var acc

var id, id2

function addStat (what, gas) {
  stats[what] = gas
}

async function getDeploymentGas (contract) {
  let receipt = await web3.eth.getTransactionReceipt(contract.transactionHash)
  return receipt.gasUsed
}

async function init () {
  acc = web3.eth.accounts

  let ins = await lib.newInstances(bat.prefs.testing)
  st = ins.token
  bp = ins.bp

  addStat('challenge.deployment', await getDeploymentGas(ins.challenge))
  addStat('merkle.deployment', await getDeploymentGas(ins.merkle))
  addStat('batpay.deployment', await getDeploymentGas(ins.bp))
  addStat('token.deployment', await getDeploymentGas(ins.token))
  addStat('massExitLib.deployment', await getDeploymentGas(ins.massExitLib))

  b = new bat.BP(ins.bp, ins.token)

  await b.init()
}

async function register () {
  let [i0] = await b.registerAccount(acc[0])

  let [i1, t2] = await b.registerAccount(acc[0])
  addStat('register', t2.gasUsed)

  id = i0
  id2 = i1
}

async function deposit (amount) {
  await b.deposit(amount, -1)

  let [, t1, t2] = await b.deposit(amount, -1)

  addStat('deposit', t1.gasUsed + t2.gasUsed)
  addStat('deposit.token.approve', t1.gasUsed)
  addStat('deposit.batpay.deposit', t2.gasUsed)
}

async function depositE (amount) {
  let [, t1, t2] = await b.deposit(amount, id)

  addStat('deposit-existing', t1.gasUsed + t2.gasUsed)
}

async function bulkReg (count) {
  const delegate = id;
  let list = []
  for (let i = 0; i < count; i++) list.push(acc[i % acc.length])

  await b.bulkRegister(list, delegate)

  let bulk = await b.bulkRegister(list, delegate)
  addStat('bulkRegister-' + count, bulk.recp.gasUsed)

  let [,, t] = await b.claimBulkRegistrationId(bulk, list[0], bulk.smallestAccountId, delegate)
  addStat('claimBulkRegistrationId', t.gasUsed)
}

async function registerPayment (amount, fee, count, lockingKeyHash, name) {
  let list = utils.randomIds(count, max, 'batpay tests seed')

  let [, t] = await b.registerPayment({
    fromAccountId: 0,
    amount: 10,
    unlockerFee: fee,
    payeesAccountsIds: list,
    lockingKeyHash: lockingKeyHash
  })
  addStat(name, t.gasUsed)
}

async function unlock () {
  let list = []
  for (let i = 0; i < 100; i++) list.push(i)
  let lockingKeyHash = utils.hashLock(id2, passcode)
  let [pid] = await b.registerPayment({
    fromAccountId: 0,
    amount: 10,
    unlockerFee: 1,
    payeesAccountsIds: list,
    lockingKeyHash: lockingKeyHash
  })
  let t2 = await b.unlock(pid, id2, passcode)
  addStat('unlock', t2.gasUsed)
}

async function refundLockedPayment () {
  let list = []
  for (let i = 0; i < 100; i++) list.push(i)
  let lockingKeyHash = utils.hashLock(id2, passcode)
  let [pid] = await b.registerPayment({
    fromAccountId: 0,
    amount: 10,
    unlockerFee: 1,
    payeesAccountsIds: list,
    lockingKeyHash: lockingKeyHash
  })

  await utils.skipBlocks(b.unlockBlocks)

  let t2 = await b.refundLockedPayment(pid)
  addStat('refundLockedPayment', t2.gasUsed)
}

async function withdraw (amount) {
  let tx1 = await bp.withdraw(amount, id)
  addStat('withdraw', tx1.receipt.gasUsed)
}

async function collect () {
  await b.collect({
    delegate: id,
    slot: 0,
    toAccountId: id2,
    fromPaymentId: 0,
    toPaymentId: 1,
    amount: 100,
    fee: 2,
    address: 0
  })
  let t2 = await b.collect({
    delegate: id,
    slot: 1,
    toAccountId: id2,
    fromPaymentId: 1,
    toPaymentId: 2,
    amount: 100,
    fee: 2,
    address: 0
  })
  addStat('collect-empty-nowd', t2.receipt.gasUsed)
  let t3 = await b.collect({
    delegate: id,
    slot: 2,
    toAccountId: id2,
    fromPaymentId: 2,
    toPaymentId: 3,
    amount: 100,
    fee: 2,
    address: acc[0]
  })
  addStat('collect-empty-withdraw', t3.receipt.gasUsed)

  let t7 = await b.collect({
    delegate: id,
    slot: b.INSTANT_SLOT,
    toAccountId: id2,
    fromPaymentId: 3,
    toPaymentId: 4,
    amount: 100,
    fee: 2,
    address: acc[0]
  })
  addStat('collect-empty-instant-withdraw', t7.receipt.gasUsed)

  await utils.skipBlocks(b.challengeBlocks)
  let t4 = await b.freeSlot(id, 0)
  addStat('freeSlot-nowd', t4.gasUsed)

  let t5 = await b.freeSlot(id, 2)
  addStat('freeSlot-withdraw', t5.gasUsed)

  let t6 = await b.collect({
    delegate: id,
    slot: 1,
    toAccountId: id2,
    fromPaymentId: 4,
    toPaymentId: 5,
    amount: 100,
    fee: 2,
    address: acc[0]
  })
  addStat('collect-reuse-nowd', t6.receipt.gasUsed)
}

async function challenge () {
  let t7 = await b.challenge_1(id, 1, id)
  addStat('challenge_1', t7.gasUsed)
}

async function doStuff () {
  try {
    await init()
    await register()
    await deposit(depositAmount)
    await depositE(depositAmount)
    await bulkReg(100)
    await bulkReg(1000)

    await withdraw(10)

    let lockingKeyHash = utils.hashLock(0, passcode)
    let run = [10, 50, 100, 250, 500, 1000, 2000, 3000]

    for (let i = 0; i < run.length; i++) {
      let count = run[i]
      await registerPayment(1, 0, count, 0, 'registerPayment-' + count + '-nolock')
      await registerPayment(1, 2, count, lockingKeyHash, 'registerPayment-' + count + '-lock')
      console.log(count)
    }

    await unlock()
    await refundLockedPayment()
    await collect()
    await challenge()

    console.log(stats)
  } catch (e) {
    console.log(e)
  }
}

module.exports = async function (callback) {
  await doStuff()
  callback()
}
