// use 
// const utils = require('../lib/utils.js')(artifacts, web3);
//


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

function getPayData(list) {
    list.sort((a,b)=>a-b);

    var last = 0;
    var data = "";

    for(let i = 0; i<list.length; i++) {
        let delta = list[i] - last;
        let number = "";
        for (let j = 0; j<bytesPerId; j++)
        {
            number = number + String.fromCharCode(delta%256);
            delta = Math.trunc(delta/256);
        }
        data = data + number;
        last = list[i];
    }

    return data;
}

module.exports = {
        getInstances,
        newInstances,
        getPayData,
        randomIds
}