var lib = require('../lib')(web3, artifacts);
const BatPay = artifacts.require('./BatPay');
const StandardToken = artifacts.require('./StandardToken');
const TestHelper = artifacts.require('./TestHelper');
var utils = lib.utils;
var merkle = lib.merkle;
var sha3_1 = lib.merkle.sha3_1;

var bp,st,testhelper;
var ids = {}
var unlockBlocks, challengeBlocks, challengeStepBlocks, instantSlot;

var payments = {};
var payList = {};

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

function getChallengeData(amounts, indexes) 
{
    let data = "0x";
    for(let i = 0; i<amounts.length && i<indexes.length; i++)
        data = data + item(amounts[i], indexes[i]);

    return data;
}

async function bpAccount(id) {
    return await bp.accounts.call(id);
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
    payIndex = (await bp.paymentsLength.call()) - 1;
    payments[payIndex] =amount;
    
    list.forEach(x=>{
        if (payList[x] == undefined) {
            payList[x] = [];
        }
        payList[x].push(payIndex);
    });

    return payIndex;
}

async function bpUnlock(payIndex, unlocker, key) {
    let t = await bp.unlock(payIndex, unlocker, key);
    
}


function getCollectData(id, fromIndex, toIndex) {
    let v = payList[id];
    let w = [];
    if (v == undefined) return 0;
    let amount = 0;
    w = v.filter(x => x >= fromIndex && x < toIndex);
    
    return w;
}


function getCollectAmount(id, fromIndex, toIndex) {
    let v = payList[id];
    if (v == undefined) return 0;
    let amount = 0;
    v.forEach(x=>{
        if (x < fromIndex || x >= toIndex) return;
        amount += payments[x];
    });
    return amount;
}

async function bpCollect(delegate, slot, to, fromId, toId, amount, fee, addr) {
    let signature = utils.signCollect(ids[to], bp.address, delegate, to, fromId, toId, amount, fee, addr);

    let tx = await bp.collect(delegate, slot, to, toId, amount, fee, addr, signature);
}

async function bpFreeSlot(delegate, slot) {
    let tx = await bp.freeSlot(delegate, slot);
}

async function bpChallenge_1(delegate, slot, challenger) {
    let tx = await bp.challenge_1(delegate, slot, challenger, {from: ids[challenger]});
    return tx;
}

async function bpChallenge_2(delegate, slot, data) {
    let tx = await bp.challenge_2(delegate, slot, data, {from: ids[delegate]});
    return tx;
}

async function bpChallenge_3(delegate, slot, data, index, challenger) {
    let tx = await bp.challenge_3(delegate, slot, data, index, {from: ids[challenger]});
    return tx;
}

async function bpChallenge_4(delegate, slot, payData) {
    let tx = await bp.challenge_4(delegate, slot, payData, {from: ids[delegate]});
    return tx;
}

async function bpChallenge_failed(delegate, slot) {
    let tx = await bp.challenge_failed(delegate, slot, {from: ids[delegate]});
    return tx;
}




function findEvent(array, eventName) {
    let x = array.find(ev=>ev.event == eventName);
    if (x) return x.args;
    throw new Error(eventName+' not found');
}

async function register(addr) {
    let t = await bp.register({from: addr});
    let recp = await t.receipt;
    
    let log = findEvent(t.logs, 'Register');
    let id = log.id.toNumber();
    ids[id] = addr;

    return id;
}

async function bulkRegister(list) {
    let nbulk = list.length;
    let tree = merkle.merkle(list);
    let tx = await bp.bulkRegister(nbulk, tree.roothash);
    await tx.receipt;
    let z = findEvent(tx.logs, 'BulkRegister');

    let minId = z.minId.toNumber();
    let bulkId = z.bulkId.toNumber();
    
    return { tree, minId, bulkId } ;

}

async function claimId(bulk, addr, id) {
    let i = id - bulk.minId;
    let proof = merkle.getProof(bulk.tree, i);
    proof = proof.map(x=>x.v);
    let tx = await bp.claimId(addr, proof, id, bulk.bulkId); 
    await tx.receipt;
    findEvent(tx.logs, 'Register');
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

async function showSlot(delegate, slot) {
    let x = await bp.collects.call(delegate, slot);
    x = x.map(x=>x.toNumber?x.toNumber():x);
    console.log("state="+x[6]);
}

async function challenge(delegate, slot, challenger, list) {
    await showSlot(delegate, slot);
    let c1 = await bpChallenge_1(delegate, slot, challenger);
    await c1;
    console.log("challenge_1 "+c1.receipt.transactionHash);


    let amounts = list.map(x=>payments[x]);

    let data = getChallengeData(amounts, list);

    await showSlot(delegate, slot);
    console.log(data);

    let c2 = await bpChallenge_2(delegate, slot, data);
    await c2;
    console.log("challenge_2 "+c2.receipt.transactionHash);
    await showSlot(delegate, slot);

    let c3 = await bpChallenge_3(delegate, slot, data, 1, challenger);
    await c3;
    console.log("challenge_3 "+c3.receipt.transactionHash);
    let payData = utils.getPayData([1,2,3,4,5]);
    await showSlot(delegate, slot);

    let c4 = await bpChallenge_4(delegate, slot, payData);
    await c4;
    console.log("challenge_4 " +c4.receipt.transactionHash);
    showSlot(delegate, slot);

    console.log("delegate="+await bpBalance(delegate));
    let c5 = await bpChallenge_failed(delegate, slot);
    await c5;
    console.log("challenge_failed "+c5.receipt.transactionHash);
    showSlot(delegate, slot);
    console.log("delegate="+await bpBalance(delegate));
    

}

async function doStuff() {
    try {
        console.log("Instantiate contracts");
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

        console.log("bulkRegistering accounts");
        let list = [];
        let nbulk = 100;
        for(let i = 0; i<nbulk; i++) list.push(acc[i%10]);
        
        let bulk = await bulkRegister(list);
        console.log("claiming "+nbulk+" accounts");
        for(let i = 0; i<nbulk; i++) await claimId(bulk, list[i], i+bulk.minId);

        console.log("transfering some tokens");
        for(let i = 1; i<acc.length; i++)
            await tokenTransfer(acc[0], acc[i], 1000);
    
        await showBalance();
        
        console.log("deposit");
        await bpDeposit(10000, 0);
        await bpDeposit(500, 8);
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
        console.log("payments:");
        console.log(payments);
        console.log("payList");
        console.log(payList);
        
        await skipBlocks(unlockBlocks);

        

        let max = p[(p.length / 2) - 1]+1;

        console.log("collect without instant slot. payIndex="+max);
        let minIndex = await bpAccount(3);
        minIndex = minIndex[2].toNumber();

        for(let i = 1; i<=5; i++) {
            let [addr, b, c] = await bpAccount(i);

            c = c.toNumber();
            addr = 0;
            if (i == 5) addr = ids[6]; // #5 withdraw to #6

            let amount = getCollectAmount(i, c, max);
          

            await bpCollect(0, i, i, c, max, amount, 2, addr);
        }

        await showBalance();

        console.log("challenging #3");
     
        let data = getCollectData(3, minIndex, max);
      
        
        await challenge(0, 3, 8, data);

        await skipBlocks(challengeBlocks);
        console.log("Freeing collect slots");
        for(let i = 1; i<=5; i++) {
            await bpFreeSlot(0, i);
        }
        await showBalance();

        max = p[p.length - 1]+1;
        console.log("collect with instant slot. payIndex="+max);

        for(let i = 1; i<=5; i++) {
            let [addr, b, c] = await bpAccount(i);

            c = c.toNumber();
            addr = 0;
            if (i == 5) addr = ids[6]; // #5 withdraw to #6

            let amount = getCollectAmount(i, c, max);
            if (i == 3) amount = amount + 100;

            await bpCollect(0, i+instantSlot, i, c, max, amount, 1, addr);
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