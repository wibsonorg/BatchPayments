// usage
// const utils = require('../lib/utils.js')(artifacts, web3);
//
var abi = require('ethereumjs-abi')
var StandardToken = artifacts.require('StandardToken')
var IERC20 = artifacts.require('IERC20')
var BatPay = artifacts.require('BatPay')
var Merkle = artifacts.require('Merkle')
var Challenge = artifacts.require('Challenge')
var MassExitLib = artifacts.require('MassExitLib')
var seedRandom = require('seedrandom')

var bat = require('../lib/Batpay.js')
const EthClient = require('./eth-client.js')

const bytesPerId = 4

async function getInstances ({ batpayAddress, tokenAddress } = {}) {
  let bp = batpayAddress ? BatPay.at(batpayAddress) : await BatPay.deployed();
  const tAddress = tokenAddress || await bp.token.call();
  let token = await IERC20.at(tAddress);

  return { bp, token };
}

async function newBatchPayments (params = {}, tokenAddress, log) {
  const batPayParams = {
    ...bat.prefs.default,
    ...params,
  };

  log && log('Deploying Merkle');
  const merkle = await Merkle.new();
  log && log('Deploying Challenge');
  const challenge = await Challenge.new();
  
  log && log('Deploying MassExitLib');
  MassExitLib.link('Challenge', challenge.address);
  const massExitLib = await MassExitLib.new();

  log && log('Deploying BatPay');
  BatPay.link('MassExitLib', massExitLib.address);
  BatPay.link('Merkle', merkle.address);
  BatPay.link('Challenge', challenge.address);
  const bp = await BatPay.new(
    tokenAddress,
    batPayParams.maxBulk,
    batPayParams.maxTransfer,
    batPayParams.challengeBlocks,
    batPayParams.challengeStepBlocks,
    batPayParams.collectStake,
    batPayParams.challengeStake,
    batPayParams.unlockBlocks,
    batPayParams.maxCollectAmount
  );
  return { bp, merkle, challenge, massExitLib };
}

async function newInstances (params = {}, tokenAddress, log) {
  log && log('Deploying/Getting Token');
  const token = typeof tokenAddress !== 'undefined' ?
    IERC20.at(tokenAddress) : await StandardToken.new('Token', 'TOK', 2, 100000000);
  
  const instances = await newBatchPayments(params, token.address, log);
  return { ...instances, token };
}

async function skipGanacheBlocks (n) {
  let v = [...Array(n)].map(advanceGanacheBlock);

  await Promise.all(v)
}

function advanceGanacheBlock () {
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      jsonrpc: '2.0',
      method: 'evm_mine',
      id: Date.now(),
    }, (err, res) => (err ? reject(err) : resolve(res)));
  });
}

function randomIds (n, max, seed) {
  let ret = []
  let used = {}
  let randomFunc = seed ? seedRandom(seed) : Math.random

  used[0] = true

  for (let i = 0; i < n; i++) {
    let id = 0
    while (id in used) {
      id = Math.trunc(randomFunc() * max)
    }
    used[id] = true
    ret.push(id)
  }
  return ret
}

function hex (x) {
  return ('00' + x.toString(16)).substr(-2)
}

function toHex (x) {
  let ret = ''

  for (let i = 0; i < x.length; i++) {
    ret = ret + hex(x.charCodeAt(i))
  }

  return ret
}

function getPayData (list) {
  list.sort((a, b) => a - b)

  var last = 0
  var data = ''

  for (let i = 0; i < list.length; i++) {
    let delta = list[i] - last

    let number = ''
    for (let j = 0; j < bytesPerId; j++) {
      number = hex(delta % 256) + number
      delta = Math.trunc(delta / 256)
    }

    data = data + number
    last = list[i]
  }

  return new web3.BigNumber('0xff' + hex(bytesPerId) + data)
}

function hashLock (unlocker, key) {
  let hash = abi.soliditySHA3(['uint32', 'bytes'], [unlocker, Buffer.from(key, 'utf8')]).toString('hex')
  return '0x' + hash
}

function hashCollect (instance, delegate, toId, fromPayIndex, toPayIndex, amount, fee, addr) {
  let hash = abi.soliditySHA3(
    ['address', 'uint32', 'uint32', 'uint32', 'uint32', 'uint64', 'uint64', 'address'],
    [instance, delegate, toId, fromPayIndex, toPayIndex, amount, fee, addr]).toString('hex')

  return '0x' + hash
}

function signCollect (account, instance, delegate, toId, fromPayIndex, toPayIndex, amount, fee, addr) {
  let hash = hashCollect(instance, delegate, toId, fromPayIndex, toPayIndex, amount, fee, addr)
  let sign = web3.eth.sign(account, hash)

  return sign
}

function sleep (seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000))
}

function range (start, end) {
  return Array(end - start + 1).fill().map((_, idx) => start + idx)
}

// we have to do this until we upgrade truffle to >=v5.x and web3 is >=v1.x
async function getBlockNumber() {
  return new Promise((res, rej) => {
    web3.eth.getBlockNumber((error, result) => {
      if (error) {
        rej(error);
      } else {
        res(result);
      }
    });
  });
}

async function waitBlocks (blocksToWait) {
  const initialBlockNumber = await getBlockNumber();
  while (true) {
    const blockNumber = await getBlockNumber();
    if (blockNumber >= initialBlockNumber + blocksToWait) break
    await sleep(5)
  }
}

async function skipBlocks (numberOfBlocks) {
  const clientName = await EthClient.nickname()

  if (clientName === 'ganache') {
    await skipGanacheBlocks(numberOfBlocks)
  } else {
    await waitBlocks(numberOfBlocks)
  }
}

module.exports = {
  getInstances,
  newBatchPayments,
  newInstances,
  getPayData,
  randomIds,
  hex,
  toHex,
  signCollect,
  hashCollect,
  hashLock,
  range,
  skipBlocks,
  sleep
}
