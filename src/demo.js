var lib = require('../lib')(web3, artifacts);
const BatPay = artifacts.require('./BatPay');
const StandardToken = artifacts.require('./StandardToken');
const TestHelper = artifacts.require('./TestHelper');
var utils = lib.utils;
var sha3_1 = lib.merkle.sha3_1;



var bp,st,testhelper;
var ids = {}
var unlockBlocks, challengeBlocks, challengeStepBlocks, instantSlot;


async function skipBlocks(n) {
    console.log("skipping "+n+" blocks");
    let v = [];
    for(let i = 0; i<n; i++)
        v.push(testhelper.skip());

    for(let i = 0; i<n; i++)
        await v[i];

}

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

async function bpAccount(id) {
    return await bp.accountOf.call(id);
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

async function bpTransfer(from, amount, fee, list, lock) {
    let data = utils.getPayData(list);
    await bp.transfer(from, amount, fee, data, 0, 0, lock, 0);
    let payId = (await bp.paymentsLength.call()) - 1;

    return payId;
}

async function bpUnlock(payId, unlocker, key) {
    let t = await bp.unlock(payId, unlocker, key);
    
}

async function bpCollect(delegate, slot, to, fromId, toId, amount, fee) {
    let signature = utils.signCollect(ids[to], delegate, to, fromId, toId, amount, fee);

    await bp.collect(delegate, slot, to, toId, amount, fee, signature);

}

async function bpFreeSlot(delegate, slot) {
    let tx = await bp.freeSlot(delegate, slot);

}

async function register(addr) {
    let t = await bp.register({from: addr});
    let id = await bp.accountsLength.call() - 1;
    ids[id] = addr;

    return id;
}

async function showBalance() {
    for(let i = 0; i<10; i++) {
        let [addr,balance,collected] = await bpAccount(i);
        let tb = await tokenBalance(ids[i]);
        tb = tb.toString(10).padStart(9, " ");
        balance = balance.toString(10).padStart(6, " ");
        console.log(i+":"+tb+" "+balance+" "+collected+"\t"+addr);
    }
    console.log("----------------");
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
        testhelper = await TestHelper.new();

        unlockBlocks = (await bp.unlockBlocks.call()).toNumber();
        challengeBlocks = (await bp.challengeBlocks.call()).toNumber();
        challengeStepBlocks = (await bp.challengeStepBlocks.call()).toNumber();
        instantSlot = (await bp.instantSlot.call()).toNumber();
        
        console.log({unlockBlocks, challengeBlocks, challengeStepBlocks, instantSlot});

        let acc = web3.eth.accounts;


        console.log("registering");
        for(let i=0; i<10; i++) await register(acc[i]);    
        await showBalance();

        console.log("transfering some tokens");
        for(let i = 1; i<acc.length; i++)
            await tokenTransfer(acc[0], acc[i], 1000);
    
        await showBalance();
        
        console.log("deposit");
        await bpDeposit(10000, 0);

        await showBalance();
        
        let key = "hello world";
        let p = [];
        let m = 20;

        let unlocker = 9;

        console.log("doing "+m+" transfers & unlocks");
        for(let i = 0; i<m; i++)
        {   
            p.push( await bpTransfer(0,  10, 1, [1,2,3,4,5], utils.hashLock(unlocker, key)));
            await bpUnlock(p[i], unlocker, key);
        }
    
        await showBalance();
        await skipBlocks(unlockBlocks);


        let max = p[(p.length / 2) - 1]+1;

        console.log("collect without instant slot. toPayId="+max);

        for(let i = 1; i<=5; i++) {
            let [addr, b, c] = await bpAccount(i);

            c = c.toNumber();

            await bpCollect(0, i, i, c, max, m*10/2, 2);
        }

        await showBalance();
        await skipBlocks(challengeBlocks);
        console.log("Freeing collect slots");
        for(let i = 1; i<=5; i++) {
            await bpFreeSlot(0, i);
        }
        await showBalance();


        
        max = p[p.length - 1]+1;
        console.log("collect with instant slot. toPayId="+max);

        for(let i = 1; i<=5; i++) {
            let [addr, b, c] = await bpAccount(i);

            c = c.toNumber();

            await bpCollect(0, i+instantSlot, i, c, max, m*10/2, 1);
        }

        await showBalance();
        await skipBlocks(challengeBlocks);
        console.log("Freeing collect slots");
        for(let i = 1; i<=5; i++) {
            await bpFreeSlot(0, i+instantSlot);
        }
        await showBalance();
        

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