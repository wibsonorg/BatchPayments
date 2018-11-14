var lib = require('../lib')(web3, artifacts);
var bat = lib.bat;

var StandardToken = artifacts.require('StandardToken');
var BatPay = artifacts.require('BatPay');

var bp,st,id;

const depositAmount = 1000;

var stats = {};


function addStat(what, gas) {
    stats[what] = gas;
}

async function init() {
        let ins = await lib.newInstances();

        st = ins.token;
        bp = ins.bp;
}

async function deposit(amount) {
        let tx1 = await st.approve(bp.address, amount);
        let tx2 = await bp.deposit(amount, bat.newAccount);
        id = (await bp.accountsLength.call()).toNumber()-1;

        addStat("deposit", tx1.receipt.gasUsed + tx2.receipt.gasUsed);
        addStat("deposit.token.approve", tx1.receipt.gasUsed);
        addStat("deposit.batpay.deposit", tx2.receipt.gasUsed);  
}

async function depositE(amount) {
    let tx1 = await st.approve(bp.address, amount);
    let tx2 = await bp.deposit(amount, id);
 
    addStat("deposit-existing", tx1.receipt.gasUsed + tx2.receipt.gasUsed);
    addStat("deposit-existing.token.approve", tx1.receipt.gasUsed);
    addStat("deposit-existing.batpay.deposit", tx2.receipt.gasUsed);
}

async function bulkReg(count) {
    let tx1 = await bp.bulkRegister(count, 0x1234);
    addStat("bulkRegister", tx1.receipt.gasUsed);
}

async function withdraw(amount) {
        let tx1 = await bp.withdraw(amount, id);
        addStat("withdraw", tx1.receipt.gasUsed);
}

async function doStuff() {
    try {
        await init();
        await deposit(depositAmount);
        await depositE(depositAmount);
        await bulkReg(1000);
        await withdraw(10);
        console.log(stats);
    } catch (e) {
        console.log(e);
    }
}

module.exports = function() {
    doStuff();
}
