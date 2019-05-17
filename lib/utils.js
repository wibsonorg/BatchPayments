// usage
// const utils = require('../lib/utils.js')(artifacts, web3);
//
var abi = require('ethereumjs-abi')
var StandardToken = artifacts.require('StandardToken')
var BatPay = artifacts.require('BatPay')
var Merkle = artifacts.require('Merkle')
var Challenge = artifacts.require('Challenge')
var MassExitLib = artifacts.require('MassExitLib')
var seedRandom = require('seedrandom')

var bat = require('../lib/Batpay.js')
const EthClient = require('./eth-client.js')

const bytesPerId = 4

async function getInstances () {
  let bp = await BatPay.deployed()
  const tAddress = await bp.token.call()
  let token = await StandardToken.at(tAddress)

  return { bp, token }
}

async function newInstances (params = {}, tokenAddress) {
  const batPayParams = {
    ...bat.prefs.default,
    ...params,
  };

  let batPayTokenAddress;
  let stdToken
  if (typeof tokenAddress !== 'undefined') {
    batPayTokenAddress = tokenAddress;
    // we delay instanciating the token to test batpay with token address at 0x0.
  } else {
    stdToken = await StandardToken.new('Token', 'TOK', 2, 100000000);
    batPayTokenAddress = stdToken.address;
  }
  const merkle = await Merkle.new();
  const challenge = await Challenge.new();
  const massExitLib = await MassExitLib.new();

  BatPay.link('MassExitLib', massExitLib.address);
  BatPay.link('Merkle', merkle.address);
  BatPay.link('Challenge', challenge.address);
  const bp = await BatPay.new(
    batPayTokenAddress,
    batPayParams.maxBulk,
    batPayParams.maxTransfer,
    batPayParams.challengeBlocks,
    batPayParams.challengeStepBlocks,
    batPayParams.collectStake,
    batPayParams.challengeStake,
    batPayParams.unlockBlocks,
    batPayParams.maxCollectAmount
  );
  let token = stdToken
  return { bp, token, merkle, challenge, massExitLib };
}

async function skipGanacheBlocks (n) {
  let v = [...Array(n)].map(advanceGanacheBlock);

  await Promise.all(v)
}

function advanceGanacheBlock () {
  return new Promise((resolve, reject) => {
    // web3.currentProvider.sendAsync({
    web3.currentProvider.send({
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

  return new web3.utils.BN('0xff' + hex(bytesPerId) + data)
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

async function waitBlocks (blocksToWait) {
  const initialBlockNumber = web3.eth.blockNumber
  while (true) {
    if (web3.eth.blockNumber >= initialBlockNumber + blocksToWait) break
    await sleep(5)
  }
}

async function skipBlocks (numberOfBlocks) {
  const clientName = await EthClient.nickname()

  if (clientName === 'ganache') {
    await skipGanacheBlocks(numberOfBlocks)
  } else if (clientName === 'geth') {
    await waitBlocks(numberOfBlocks)
  } else {
    throw new Error('Not implemented')
  }
}

module.exports = {
  getInstances,
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
