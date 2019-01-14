var lib = require('../lib')(web3, artifacts);
const BatPay = artifacts.require('./BatPay');
const StandardToken = artifacts.require('./StandardToken');
const TestHelper = artifacts.require('./TestHelper');
var utils = lib.utils;


function calcSignature() {

}

async function doStuff() {
    try {
    console.log("Instantiate contacts");
    let x = await lib.newInstances();
    let test = await TestHelper.new();
 
    let st = x.token;
    let bp = x.bp;

    const ids = 3000;
    const newIds = 50;

    const amount = ids+newIds;

    let t1 = await bp.register();
    await t1;
    let id1 = await bp.accountsLength.call() - 1;

    let t2 = await bp.register();
    await t2;
 
    let delegate = await bp.accountsLength.call() - 1;


    console.log("registered "+id1+" & "+delegate);

    console.log("Deposit initial funds");
    await st.approve(bp.address, amount);
    let t0 = await bp.deposit(amount, -1); 
    await t0;
    let id = await bp.accountsLength.call() - 1;
    
    console.log("Desposited on "+id);

    console.log("bulk registering "+(ids-1)+" accounts");

    let v0 = await bp.bulkRegister(ids-1, 0);
    await v0;

    let balance = await bp.balanceOf.call(id);
    console.log("balance="+balance);
    
    let list = utils.randomIds(ids, 500000);
    list[0] = id1;
    let data = utils.getPayData(list);
    
    console.log("Transfer from "+id);
    
    let v1 = await bp.transfer(id, 1, 0, data, newIds, 0x1234, 0, 0);
    
    await v1;
    console.log(v1.receipt.gasUsed);
    console.log(v1.receipt.gasUsed/(ids));
    console.log(v1.receipt.gasUsed/(ids+newIds));
    
    console.log("collect for "+id1);

    let sign = utils.signCollect(web3.eth.accounts[0], delegate, id1, 0, 1, 1);
    

    console.log("sign="+sign);

    console.log("topping delegate");
    let amount2 = 100000 + 100;
    await st.approve(bp.address, amount2);
    let t4 = await bp.deposit(amount2, delegate); 
    await t4;
    let b4 = await bp.balanceOf.call(delegate);
    console.log("balance="+b4);
 

    let v2 = await bp.collect(
        delegate,   // delegate 
        0,          // slot 
        id1,        // to
        1,          // toPayId
        1,          // amount
        sign     // signature
        );
    await v2;

    console.log("gas used on collect="+v2.receipt.gasUsed);
   
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