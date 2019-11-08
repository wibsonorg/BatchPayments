const { utils, Batpay, getInstances, newInstances } = require('../lib')(web3, artifacts)

const log = console.log;

async function main (config = {}) {
  const {
    accounts,
    numberOfAccounts,
    bulkSize,
    numberOfPayments,
    paymentAmount,
    unlockerFee,
    collectFee,
    contracts = {}
  } = config;

  log('Configs\n');
  log(config);
  log();

  if (numberOfAccounts < 5) {
    throw new Error('At least 5 acccounts are needed');
  }

  if (/^v[0-9]\./.test(process.version)) {
    throw new Error(`Node Version v10 or above is required. Found: ${process.version}`);
  }

  //
  // Deploy & initialize BatPay
  //
  log('Getting/Creating contracts')
  let instances = await (contracts.batpayAddress
    ? getInstances(contracts)
    : newInstances(Batpay.prefs.testing, contracts.tokenAddress, log)
  );
  let batpay = new Batpay.BP(instances.bp, instances.token)
  await batpay.init()

  log(`Token: ${instances.token.address}`);
  log(`BatPay: ${instances.bp.address}`);
  log();

  //
  // Accounts registration
  //

  // Simple registration
  log(`Registering ${numberOfAccounts} accounts`)
  const accountIds = [];
  for (let i = 0; i < numberOfAccounts; i++) {
    log(`Registering account ${i + 1} of ${numberOfAccounts}\r`)
    const [id] = await batpay.registerAccount(accounts[i]);
    accountIds.push(id);
  }
  await batpay.showBalance(accountIds, log)

  const delegate = accountIds[0];
  const payer = accountIds[1];
  const unlocker = accountIds[2];
  const challenger = accountIds[3];
  const payeesAccountsIds = accountIds.slice(4);
  const numberOfIds = accountIds.length;

  // Bulk registration
  log(`Bulk registering ${bulkSize} accounts\n`)
  let addressesBulk = utils.range(1, bulkSize).map((seed) => `0x${web3.sha3(seed.toString()).slice(-40)}`)
  let bulk = await batpay.bulkRegister(addressesBulk, delegate)

  // Claiming of the bulk registered accounts
  log(`Claiming bulk registered accounts`)
  for (let i = 0; i < bulkSize; i++) {
    log(`Claiming account ${i + 1} of ${bulkSize}\r`)
    await batpay.claimBulkRegistrationId(bulk, addressesBulk[i], i + bulk.smallestAccountId, delegate)
  }
  log();

  //
  // Fund accounts with a good ol' ERC20.transfer and then fund BatPay
  //
  log('Funding accounts')
  const amountToFund = Math.max(
    (paymentAmount * payeesAccountsIds.length + unlockerFee) * numberOfPayments,
    (batpay.collectStake + collectFee) * payeesAccountsIds.length,
    batpay.challengeStake
  );

  for (let i = 0; i < numberOfIds; i++) {
    if (i > 0) {
      log(`Transfering tokens to account ${i + 1} of ${numberOfIds}\r`)
      await instances.token.transfer(accounts[i], amountToFund, { from: accounts[0] });
    }

    log(`Depositing tokens in BatPay account ${i + 1} of ${numberOfIds}`)
    await batpay.deposit(amountToFund, accountIds[i]);
  }
  await batpay.showBalance(accountIds, log)

  //
  // Register payments.
  //
  const secretKey = 'hello world'
  const paymentsIndexes = []
  
  log(`Registering ${numberOfPayments} payments and unlocking them.`)
  for (let i = 0; i < numberOfPayments; i++) {
    log(`Payment ${i + 1} of ${numberOfPayments}\r`)
    const [payIndex] = await batpay.registerPayment({
      fromAccountId: payer,
      amount: paymentAmount,
      unlockerFee,
      payeesAccountsIds,
      lockingKeyHash: utils.hashLock(unlocker, secretKey)
    })
    paymentsIndexes.push(payIndex)

    // Unlocker provides their secret to unlock the payment and collect the fee.
    await batpay.unlock(payIndex, unlocker, secretKey)
  }
  await batpay.showBalance(accountIds, log)

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
  const collectFromPaymentId = await batpay.getCollectedIndex(payeesAccountsIds[0])
  const collectUntilPaymentId = paymentsIndexes.slice(-1)[0] + 1;
  const collectors = payeesAccountsIds

  log(`Collecting payments ${collectFromPaymentId} to ${collectUntilPaymentId} for accounts ${collectors[0]} to ${collectors.slice(-1)[0]}.`);

  for (let i = 0; i < collectors.length; i++) {
    const collector = collectors[i];
    log(`Account ${collector}`);

    let [collectorAddress, , lastCollectedPaymentId] = await batpay.getAccount(collector)
    lastCollectedPaymentId = lastCollectedPaymentId.toNumber()

    // Get the sum of tokens corresponding to the payments we chose to collect.
    const amount = await batpay.getCollectAmount(collector, lastCollectedPaymentId, collectUntilPaymentId)

    await batpay.collect({
      delegate,
      slot: collector,
      toAccountId: collector,
      fromPaymentId: lastCollectedPaymentId,
      toPaymentId: collectUntilPaymentId,
      amount,
      fee: collectFee,
      address: collectorAddress
    })
  }
  await batpay.showBalance(accountIds, log)

  //
  // Challenges
  //

  // Scalability is also achieved through skipping some costly verifications and
  // introducing a challenge game that allows the payer to repudiate payments
  // if the `collect` amount requested is incorrect.
  //
  const challengee = collectors[0];
  const challengedSlot = challengee; // we are using challengees ids as slots as well
  const data = batpay.getCollectData(challengee, collectFromPaymentId, collectUntilPaymentId);

  log(`Challenging account #${challengee}\n`)
  await challenge(batpay, delegate, challengedSlot, challenger, data);
  await utils.skipBlocks(batpay.challengeBlocks);

  //
  // Free slot, pay the delegate and the destination account.
  //
  log('Freeing collect slots.')
  for (let i = 0; i < collectors.length; i++) {
    const slot = collectors[i];
    await batpay.freeSlot(delegate, slot);
  }
  await batpay.showBalance(accountIds, log)
}

async function showSlot(batpay, delegate, slot) {
  let x = await batpay.bp.collects.call(delegate, slot)
  x = x.map(x => x.toNumber ? x.toNumber() : x)
  log('state=' + x[6])
}

async function challenge(batpay, delegate, slot, challenger, list) {
  const disputedPaymentIndex = 0;
  const challengedPayment = list[disputedPaymentIndex];
  const amounts = list.map(x => batpay.payments[x].amount);
  const data = Batpay.getChallengeData(amounts, list);
  const payData = batpay.getPayData(challengedPayment);

  log(`Delegate: ${delegate}`);
  log(`Challenged Slot: ${slot}`);
  log(`Challenger: ${challenger}`);
  log(`Collected Payments: ${list}`);
  log(`Collected Amounts: ${amounts}`);
  log(`Challenged Payment Index: ${challengedPayment}`);

  log('\nPerforming challenge step #1');
  await batpay.challenge_1(delegate, slot, challenger)

  log('Performing challenge step #2'); 
  await batpay.challenge_2(delegate, slot, data)

  log('Performing challenge step #3');
  await batpay.challenge_3(delegate, slot, data, disputedPaymentIndex, challenger)

  log('Performing challenge step #4');
  await batpay.challenge_4(delegate, slot, payData)

  log('Finishing Challenge');
  await batpay.challenge_failed(delegate, slot)

  log('Challenge Finished!\n');
}

function demo (callback) {
  web3.eth.getAccounts(async (error, accounts) => {
    if (error) throw new Error('Could not get accounts')
    try {
      // TODO: This parameters were hardcoded in logic, now taken out, but we still need to improve this.
      await main({
        accounts,
        numberOfAccounts: Math.min(accounts.length, 10),
        bulkSize: 5,
        numberOfPayments: 4,
        paymentAmount: 100,
        unlockerFee: 1,
        collectFee: 1,
        contracts: {
          tokenAddress: '0x1bd7adf34f1ab0cd62bb3722b9462d30cf91c8f4',
          batpayAddress: '0x975394d3eef7f6fe14057cb78249c8a1223c5cb4'
        }
      })
      callback()
    } catch (e) {
      callback(e)
    }
  })
}

module.exports = demo
