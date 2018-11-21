var lib = require('../lib')(web3, artifacts);
const BatPay = artifacts.require('./BatPay');
const StandardToken = artifacts.require('./StandardToken');
const TestHelper = artifacts.require('./TestHelper');
var utils = lib.utils;


async function doStuff() {
    try {
    console.log("?");
    let x = await lib.newInstances();
    console.log(x);

    let st = x.token;
    let bp = x.bp;

    let list = utils.randomIds(10, 50000);
    let data = utils.getPayData(list);
    console.log("length = "+data.length)

    const amount = list.length;

    await st.approve(bp.address, amount);
    let t0 = await bp.deposit(amount, -1); 
    await t0;
    let id = await bp.accountsLength.call() - 1;
    
    let v0 = await bp.bulkRegister(100, 0);
    await v0;

    let v1 = await bp.transfer(id, 1, data, 0, 0x1234);

    await v1;
    console.log(v1.receipt.gasUsed);

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