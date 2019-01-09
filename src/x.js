var lib = require('../lib')(web3, artifacts);
const BatPay = artifacts.require('./BatPay');
const StandardToken = artifacts.require('./StandardToken');
const TestHelper = artifacts.require('./TestHelper');
var utils = lib.utils;


async function doStuff() {
    try {
  
    console.log("Instantiate contacts");
    let test = await TestHelper.new();
 
    let key = "z";
    let len = await test.testlen.call(0, key);
    let h = lib.merkle.sha3_1(key);
    let h2 = await test.hash.call(key);
    let h3 = await lib.utils.hashLock(key);
    console.log({key, h, h2, h3, len})

    let sign = utils.signCollect(web3.eth.accounts[0], 0, 0, 0, 0, 0);
    

    let hash = await test.getHashForCollect.call(0, 0, 0, 0, 0);
    let hash2 = utils.hashCollect(0, 0, 0, 0, 0);

    console.log("hashes");
    console.log(hash);
    console.log(hash2);

    let hash3 = await test.toEthSignedMessageHash.call(hash2);

    let addr = await test.recover.call(hash3, sign);

    console.log("\naddresses");

    console.log(addr);
    console.log(web3.eth.accounts[0]);

    } catch(e) {
        console.log(e);
    }
}

module.exports = function() {
    try {
        doStuff();
    } catch(e) {
        console.log(e);
    }
}