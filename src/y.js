var lib = require('../lib')(web3, artifacts);
const BatPay = artifacts.require('./BatPay');
const StandardToken = artifacts.require('./StandardToken');
const TestHelper = artifacts.require('./TestHelper');
var utils = lib.utils;
var sha3_1 = lib.merkle.sha3_1;



var bp,st;
var ids = {}


function hexStr(n, len) {
    let s = n.toString(16);
    while(s.length < len*2) s = "0" + s;
    return s;
}

function item(amount, index) {
    return hexStr(amount,8) + hexStr(index, 4);
}

function generateData(len) 
{
    let data = "0x";
    for(let i = 0; i<len; i++)
        data = data + item(4, i);

    return data;
}

async function tokenTransfer(from, to, amount) {
    let a = await st.transfer(to, amount, {from: from});
}

async function tokenBalance(addr) {
    let balance = await st.balanceOf.call(addr);
    return balance;
}

async function bpDeposit(amount, id) {
    let t1 = await st.approve(bp.address, amount, {from: ids[id]});
    let t2 = await bp.deposit(amount, id, {from: ids[id]});
}

async function bpBalance(id) {
    let balance = await bp.balanceOf.call(id);
    return balance;
}

async function bpTransfer(from, amount, list, lock) {
    let data = utils.getPayData(list);
    await bp.transfer(from, amount, data, 0, 0, lock, 0);
    let payId = (await bp.paymentsLength.call()) - 1;

    return payId;
}

async function bpUnlock(payId, key) {
    let t = await bp.unlock(payId, key);
    console.log(t);
}

async function bpCollect(delegate, slot, fromId, toId, amount) {
    let signature = utils.signCollect(ids[to], delegate, to, fromId, toId, amount);

    await bp.collect(delegate, slot, to, toId, amount, signature);

}

async function register(addr) {
    let t = await bp.register({from: addr});
    let id = await bp.accountsLength.call() - 1;
    ids[id] = addr;

    return id;
}

async function showBalance() {
    console.log("----------------");
    for(let i = 0; i<10; i++)
        console.log(i+":"+await tokenBalance(ids[i])+" "+await bpBalance(i));
}

async function testData() {

    let d= generateData(1000);
    console.log(d);

    let sum = await bp.getDataSum.call(d);
    console.log("Sum="+sum);

    for(let i = 990; i<1000; i++) {
        let i1 = await bp.getDataAtIndex.call(d, i);
        console.log("("+i+")="+i1);
    }
}





async function doStuff() {
    try {
    console.log("Instantiate contacts");
    let x = await lib.newInstances();

    st = x.token;
    bp = x.bp;

    let acc = web3.eth.accounts;


    for(let i=0; i<10; i++) await register(acc[i]);

    
    
    await showBalance();
    for(let i = 1; i<acc.length; i++)
        await tokenTransfer(acc[0], acc[i], 1000);
 
    await showBalance();
    
    await bpDeposit(10000, 0);

    await showBalance();
    
    let key = "hello world";
    let p = [];
    let m = 20;

    for(let i = 0; i<m; i++)
    {   
        p.push( await bpTransfer(0,  10, [1,2,3,4,5], utils.hashLock(key)));
    }

    for(let i = 0; i<m; i++)
    {
        console.log(p[i]);
        await bpUnlock(p[i], key);
    }
   // await showBalance();

  

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