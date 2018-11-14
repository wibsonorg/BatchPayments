// use 
// const utils = require('../lib/utils.js')(artifacts, web3);
//


var StandardToken = artifacts.require('StandardToken');
var BatPay = artifacts.require('BatPay');




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

module.exports = {
        getInstances,
        newInstances,
}