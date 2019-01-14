// use 
// const utils = require('../lib/utils.js')(artifacts, web3);
//
var abi = require('ethereumjs-abi');


var StandardToken = artifacts.require('StandardToken');
var BatPay = artifacts.require('BatPay');
var Merkle = artifacts.require('Merkle');
const bytesPerId = 4;



async function getInstances() {
    let bp = await BatPay.deployed();
    const tAddress = await bp.token.call();
    let token = await StandardToken.at(tAddress);

    return { bp, token }
}

async function newInstances() {
    let token = await StandardToken.new("Token", "TOK", 2, 1000000);
    let bp = await BatPay.new(token.address);
    
    return { bp, token }
}

function randomIds(n, max) {
    let res = [];
    let used = {};

    used[0] = true;

    for(let i = 0; i<n; i++) {
        let id = 0;
        while (id in used) {
            id = Math.trunc(Math.random()*max);
        }
        used[id] = true;
        res.push(id);
    }
    return res;
}

function hex(x) {
    return ("00"+x.toString(16)).substr(-2);
}

function toHex(x) {
    let ret = "";

    for(let i = 0; i<x.length; i++)
    {
        ret = ret + hex(x.charCodeAt(i));

    }

    return ret;
}

function getPayData(list) {
    list.sort((a,b)=>a-b);

    var last = 0;
    var data = "";

    for(let i = 0; i<list.length; i++) {
        let delta = list[i] - last;

        let number = "";       
        for (let j = 0; j<bytesPerId; j++)
        {
            number =  hex(delta%256) + number;
            delta = Math.trunc(delta/256);
        }

        data = data + number;
            
        last = list[i];
    }

    return new web3.BigNumber("0xff"+hex(bytesPerId)+data);
}

function hashLock(unlocker, key) {
    let hash = abi.soliditySHA3(['uint32', 'bytes'], [unlocker, Buffer.from(key, 'utf8')]).toString("hex");
    return "0x"+hash;   
}

function hashCollect(delegate, toId, fromPayId, toPayId, amount) {
    let hash = abi.soliditySHA3(
            ['uint32', 'uint32', 'uint32', 'uint32', 'uint64'], 
            [delegate, toId, fromPayId, toPayId, amount]).toString("hex");

    return "0x"+hash;
}

function signCollect(account, delegate, toId, fromPayId, toPayId, amount) {
    let hash = hashCollect(delegate, toId, fromPayId, toPayId, amount);
    let sign = web3.eth.sign(account, hash);

    return sign;
}

module.exports = {
        getInstances,
        newInstances,
        getPayData,
        randomIds,
        toHex,
        signCollect,
        hashCollect,
        hashLock
}