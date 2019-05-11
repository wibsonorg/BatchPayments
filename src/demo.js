const { utils, Batpay, newInstances } = require('../lib')(web3, artifacts)

// Globals
var accounts
var batpay

async function main () {
  //
  // Deploy & initialize BatPay
  //
  let instances = await newInstances(Batpay.prefs.testing)
  batpay = new Batpay.BP(instances.bp, instances.token)
  await batpay.init()

  //
  // Accounts registration
  //

  // Simple registration
  const numberOfAccounts = 10
  console.log(`Registering ${numberOfAccounts} accounts`)
  for (let i = 0; i < numberOfAccounts; i++) {
    log(`Registering account ${i + 1} of ${numberOfAccounts}\r`)
    await batpay.registerAccount(accounts[i])
  }
  await batpay.showBalance()

  // Bulk registration
  let bulkSize = 100
  console.log(`Bulk registering ${bulkSize} accounts`)
  let addressesBulk = utils.range(1, bulkSize).map((seed) => `0x${web3.sha3(seed.toString()).slice(-40)}`)
  let bulk = await batpay.bulkRegister(addressesBulk)

  // Claiming of the bulk registered accounts
  console.log(`Claiming bulk registered accounts`)
  let claimedAccountsPromises = utils.range(0, bulkSize - 1).map(
    (id) => batpay.claimBulkRegistrationId(bulk, addressesBulk[id], id + bulk.smallestAccountId)
  )
  await Promise.all(claimedAccountsPromises)

  //
  // Fund accounts with a good ol' ERC20.transfer
  //
  console.log('Funding accounts')
  for (let i = 1; i < accounts.length; i++) {
    log(`Transfering to account ${i + 1} of ${accounts.length}\r`)
    await instances.token.transfer(accounts[i], 1000, { from: accounts[0] })
  }
  await batpay.showBalance()

  //
  // Fund BatPay proxy contract to let it manage batch payments.
  //
  console.log('Funding BatPay')
  await batpay.deposit(10000, 0)
  await batpay.deposit(500, 8)
  await batpay.showBalance()

  //
  // Register payments.
  //
  const numberOfPayments = 20
  const unlockerAccountId = 9
  const secretKey = 'hello world'
  const paymentsIndexes = []

  console.log(`Registering ${numberOfPayments} payments and unlocking them.`)
  for (let i = 0; i < numberOfPayments; i++) {
    log(`Payment ${i + 1} of ${numberOfPayments}\r`)
    const [payIndex] = await batpay.registerPayment({
      fromAccountId: 0,
      amount: 10,
      unlockerFee: 1,
      payeesAccountsIds: [1, 2, 3, 4, 5],
      lockingKeyHash: utils.hashLock(unlockerAccountId, secretKey)
    })
    paymentsIndexes.push(payIndex)

    // Unlocker provides their secret to unlock the payment and collect the fee.
    await batpay.unlock(payIndex, unlockerAccountId, secretKey)
  }
  await batpay.showBalance()

  // Registered payments can timeout if no one unlocks them. This way, payers
  // can recover the funds they vouched. Collection of payments is blocked
  // until the lock timeout is over.
  // Wait for the lock timeout to end.
  await utils.skipBlocks(batpay.unlockBlocks)

  //
  // Collect a batch of registered payments.
  //

  // We must provide the index of the payments we wish to collect. BatPay will
  // transfer the tokens corresponding to all payments between those indexes.
  // Our first payment to collect will be the one right after the last previously
  // collected payment.
  const collectFromPaymentId = await batpay.getCollectedIndex(3)
  let collectUntilPaymentId = paymentsIndexes[(paymentsIndexes.length / 2) - 1] + 1
  const collectors = [1, 2, 3, 4, 5]

  console.log(`Collecting payments ${collectFromPaymentId} to ${collectUntilPaymentId}\
  for accounts ${collectors[0]} to ${collectors.slice(-1)[0]}.`)
  collectors.forEach(async (collector) => {
    let [collectorAddress, , lastCollectedPaymentId] = await batpay.getAccount(collector)
    lastCollectedPaymentId = lastCollectedPaymentId.toNumber()
    collectorAddress = 0
    // Account #5 withdraws to #6
    if (collector == 5) collectorAddress = batpay.ids[6]

    // Get the sum of tokens corresponding to the payments we chose to collect.
    const amount = await batpay.getCollectAmount(collector, lastCollectedPaymentId, collectUntilPaymentId)

    await batpay.collect({
      delegate: 0,
      slot: collector,
      toAccountId: collector,
      fromPaymentId: lastCollectedPaymentId,
      toPaymentId: collectUntilPaymentId,
      amount: amount,
      fee: 2,
      address: collectorAddress
    })
  })
  await batpay.showBalance()

  //
  // Challenges
  //

  // Scalability is also achieved through skipping some costly verifications and
  // introducing a challenge game that allows the payer to repudiate payments
  // if the `collect` amount requested is incorrect.
  //
  console.log('Challenging account #3.')
  let data = batpay.getCollectData(3, collectFromPaymentId, collectUntilPaymentId)
  await challenge(0, 3, 8, data)
  await utils.skipBlocks(batpay.challengeBlocks)

  //
  // Free slot, pay the delegate and the destination account.
  //
  console.log('Freeing collect slots.')
  for (let i = 1; i <= 5; i++) {
    await batpay.freeSlot(0, i)
  }
  await batpay.showBalance()

  //
  // Collect remaining payments.
  //
  collectUntilPaymentId = paymentsIndexes[paymentsIndexes.length - 1] + 1
  console.log(`Collecting remaining payments for accounts\
  ${collectors[0]} to ${collectors.slice(-1)[0]}.`)
  console.log('Collecting with instant slot.')
  collectors.forEach(async (accountId) => {
    let [, , lastCollectedPaymentId] = await batpay.getAccount(accountId)
    let address = 0
    let amount = await batpay.getCollectAmount(accountId, lastCollectedPaymentId, collectUntilPaymentId)

    // Account #5 withdraws to #6
    if (accountId === 5) address = batpay.ids[6]
    if (accountId === 3) amount = amount + 100

    await batpay.collect({
      delegate: 0,
      slot: accountId + batpay.instantSlot,
      toAccountId: accountId,
      fromPaymentId: lastCollectedPaymentId.toNumber(),
      toPaymentId: collectUntilPaymentId,
      amount: amount,
      fee: 1,
      address: address
    })
  })
  await batpay.showBalance()

  // In order to free the slots and forward the funds we need to wait for the
  // challenge timeout to be over.
  await utils.skipBlocks(batpay.challengeBlocks + 1)
  console.log('Freeing collect slots.')
  for (let i = 1; i <= 5; i++) {
    await batpay.freeSlot(0, i + batpay.instantSlot)
  }
  await batpay.showBalance()
}

const log = (obj) => process.stdout.write(obj)

async function showSlot (delegate, slot) {
  let x = await batpay.bp.collects.call(delegate, slot)
  x = x.map(x => x.toNumber ? x.toNumber() : x)
  console.log('state=' + x[6])
}

async function challenge (delegate, slot, challenger, list) {
  await batpay.challenge_1(delegate, slot, challenger)

  let amounts = list.map(x => batpay.payments[x])
  let data = Batpay.getChallengeData(amounts, list)

  await batpay.challenge_2(delegate, slot, data)

  await batpay.challenge_3(delegate, slot, data, 1, challenger)
  let payData = utils.getPayData([1, 2, 3, 4, 5])

  await batpay.challenge_4(delegate, slot, payData)

  await batpay.challenge_failed(delegate, slot)
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
