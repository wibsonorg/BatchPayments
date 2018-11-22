var lib = require('../lib')(web3, artifacts);
const BatPay = artifacts.require('./BatPay');
const StandardToken = artifacts.require('./StandardToken');
const TestHelper = artifacts.require('./TestHelper');
var utils = lib.utils;


async function doStuff() {
    try {
  
    let x = await lib.newInstances();
    let test = await TestHelper.new();
 
    let st = x.token;
    let bp = x.bp;

    const ids = 5000;
    const newIds = 500;


    let list = utils.randomIds(ids, 500000);
    let data = utils.getPayData(list);

    const amount = ids+newIds;

    await st.approve(bp.address, amount);
    let t0 = await bp.deposit(amount, -1); 
    await t0;
    let id = await bp.accountsLength.call() - 1;
    
    let v0 = await bp.bulkRegister(newIds, 0);
    await v0;

    let balance = await bp.balanceOf.call(id);
    console.log("balance="+balance);
    let v1 = await bp.transfer(id, 1, data, newIds, 0x1234, 0);

    await v1;
    console.log(v1.receipt.gasUsed);
    console.log(v1.receipt.gasUsed/(ids));
    console.log(v1.receipt.gasUsed/(ids+newIds));
    
    

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