var BigNumber = global.web3.BigNumber;
var merkle = require('../lib/merkle');
var abi = require('ethereumjs-abi');


const bytesPerId = 4;

var newAccountFlag = new BigNumber(2).pow(256).minus(1);

const prefs = { 
    default: {
        maxBulk: 5000, 
        maxTransfer: 5000, 
        challengeBlocks: 5,    
        challengeStepBlocks: 5,    
        collectStake: 500,  
        challengeStake: 100,  
        unlockBlocks: 5    
    },
    testing: {
        maxBulk: 5000, 
        maxTransfer: 5000, 
        challengeBlocks: 5,    
        challengeStepBlocks: 5,    
        collectStake: 500,  
        challengeStake: 100,  
        unlockBlocks: 5   
    },
    recommended: {
        maxBulk: 5000, 
        maxTransfer: 5000, 
        challengeBlocks: 240,     
        challengeStepBlocks: 40,     
        collectStake: 1000000,  
        challengeStake: 100000,  
        unlockBlocks: 60    
    },
}

function findEvent(array, eventName) {
    let x = array.find(ev=>ev.event == eventName);
    if (x) return x.args;
    throw new Error(eventName+' not found');
}

function hex(x) {
    return ("00"+x.toString(16)).substr(-2);
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


function getPayData(list) {
    list.sort((a,b)=>a-b);

    var last = 0;
    var data = "";

    for(let i = 0; i<list.length; i++) {
        let delta = list[i] - last;

        let number = "";       
        for (let j = 0; j<bytesPerId; j++)
        {
            number = hex(delta%256) + number;
            delta = Math.trunc(delta/256);
        }

        data = data + number;
        last = list[i];
    }

    return new web3.BigNumber("0xff"+hex(bytesPerId)+data);
}

function hashLock(unlocker, key) {
    let hash = abi.soliditySHA3(['uint32', 'bytes'], [unlocker, Buffer.from(key, 'utf8')]).toString("hex");
    return "0x"+hash;   
}

function hashCollect(instance, delegate, toId, fromPayIndex, toPayIndex, amount, fee, addr) {
    let hash = abi.soliditySHA3(
            ['address', 'uint32', 'uint32', 'uint32', 'uint32', 'uint64', 'uint64', 'address'], 
            [instance, delegate, toId, fromPayIndex, toPayIndex, amount, fee, addr]).toString("hex");

    return "0x"+hash;
}

function signCollect(account, instance, delegate, toId, fromPayIndex, toPayIndex, amount, fee, addr) {
    let hash = hashCollect(instance, delegate, toId, fromPayIndex, toPayIndex, amount, fee, addr);
    let sign = web3.eth.sign(account, hash);

    return sign;
}

class BP {
    constructor (bp, token) {
        this.bp = bp;
        this.st = token;
        this.ids = {};
        this.payments = {};
        this.payList = {};
        this.accountList = {};
    }

    async init() {
        let params = await this.bp.params.call();
        this.maxBulk = params[0].toNumber();                                
        this.maxTransfer = params[1].toNumber();              
        this.challengeBlocks = params[2].toNumber();               
        this.challengeStepBlocks = params[3].toNumber();     
        this.collectStake = params[4].toNumber();
        this.challengeStake = params[5].toNumber();     
        this.unlockBlocks = params[6].toNumber();

        this.instantSlot = (await this.bp.instantSlot.call()).toNumber();
     }

     async register(addr) {
        let t = await this.bp.register({from: addr});
        let recp = await t.receipt;
        
        let log = findEvent(t.logs, 'AccountRegistered');
        let id = log.accountId.toNumber();
        this.ids[id] = addr;
    
        return [ id, recp ];
    }

    async bulkRegister(list) {
        let nbulk = list.length;
        let tree = merkle.merkle(list);
        let tx = await this.bp.bulkRegister(nbulk, tree.roothash);
        let recp = await tx.receipt;
        let z = findEvent(tx.logs, 'BulkRegister');
    
        let lowestAccountId = z.lowestAccountId.toNumber();
        let bulkId = z.bulkId.toNumber();

        for(let i = 0; i<list.length; i++) {
            this.ids[lowestAccountId+i] = list[i];
        }
        
        return { tree, lowestAccountId, bulkId, recp } ;
    }

    async claimBulkRegistrationId(bulk, addr, id) {
        let i = id - bulk.lowestAccountId;
        let proof = merkle.getProof(bulk.tree, i);
        proof = proof.map(x=>x.v);
        let tx = await this.bp.claimBulkRegistrationId(addr, proof, id, bulk.bulkId); 
        let recp = await tx.receipt;
        let log = findEvent(tx.logs, 'AccountRegistered');

        return [log.accountId, log.addr, recp ];
    }

    async deposit(amount, id, from) {
        let addr = from ? from : this.ids[id];
        let nid = id;

        let t1 = await this.st.approve(this.bp.address, amount, {from: addr});
        await t1.receipt;

        let t2 = await this.bp.deposit(amount, id, {from: addr});
        await t2.receipt;

        if (id == -1) {
            let log = findEvent(t2.logs, 'AccountRegistered');
            nid = log.accountId.toNumber();
            this.ids[nid] = from;
        }
        return [nid, t1.receipt, t2.receipt];
    }   


    async transfer(from, amount, fee, list, lock) {
        let data = getPayData(list);
        let tx = await this.bp.transfer(from, amount, fee, data, 0, 0, lock, 0);
        await tx.receipt;

        let payIndex = (await this.bp.paymentsLength.call()) - 1;
        this.payments[payIndex] =amount;
        this.payList[payIndex] = list;
        list.forEach(x=>{
            if (this.accountList[x] == undefined) {
                this.accountList[x] = [];
            }
            this.accountList[x].push(payIndex);
        });

        return [payIndex, tx.receipt];
    }

    async  unlock(payIndex, unlocker, key) {
        let t = await this.bp.unlock(payIndex, unlocker, key);
        return await t.receipt;
    }

    async refund(payIndex) {
        let t = await this.bp.refund(payIndex);
        return await t.receipt;
    }

    async collect(delegate, slot, to, fromId, toId, amount, fee, addr) {
        let signature = signCollect(this.ids[to], this.bp.address, delegate, to, fromId, toId, amount, fee, addr);

        let tx = await this.bp.collect(delegate, slot, to, toId, amount, fee, addr, signature);
        return await tx.receipt;
    }

    async freeSlot(delegate, slot) {
        let tx = await this.bp.freeSlot(delegate, slot);
        return await tx.receipt;
    }
    
    async challenge_1(delegate, slot, challenger) {
        let tx = await this.bp.challenge_1(delegate, slot, challenger, {from: this.ids[challenger]});
        return await tx.receipt;
    }
    
    async challenge_2(delegate, slot, data) {
        let tx = await this.bp.challenge_2(delegate, slot, data, {from: this.ids[delegate]});
        return await tx.receipt;
    }
    
    async challenge_3(delegate, slot, data, index, challenger) {
        let tx = await this.bp.challenge_3(delegate, slot, data, index, {from: this.ids[challenger]});
        return await tx.receipt;
    }
    
    async challenge_4(delegate, slot, payData) {
        let tx = await this.bp.challenge_4(delegate, slot, payData, {from: this.ids[delegate]});
        return await tx.receipt;
    }
    
    async challenge_failed(delegate, slot) {
        let tx = await this.bp.challenge_failed(delegate, slot, {from: this.ids[delegate]});
        return await tx.receipt;
    }

    async challenge_success(delegate, slot, challenger) {
        let tx = await this.bp.challenge_success(delegate, slot, {from: this.ids[challenger]});
        return await tx.receipt;
    }


    async  balanceOf(id) {
        let balance = await this.bp.balanceOf.call(id);
        return balance;
    }
    
    async tokenBalance(addr) {
        let balance = await this.st.balanceOf.call(addr);
        return balance;
    }

    async tokenTransfer(from, to, amount) {
        let tx = await this.st.transfer(to, amount, {from: from});
        let recp = await tx.receipt;

        return recp;
    }

    async  getAccount(id) {
        return await this.bp.accounts.call(id);
    }

    async getCollectedIndex(id) {
        let x = await this.getAccount(id);
        return x[2].toNumber();
    }

    async getCollectAmount(id, fromIndex, toIndex) {
        let v = this.accountList[id];
        if (v == undefined) return 0;
        let amount = 0;
        v.forEach(x=>{
            if (x < fromIndex || x >= toIndex) return;
            amount += this.payments[x];
        });
        return amount;
    }

    getCollectData(id, fromIndex, toIndex) {
        let v = this.accountList[id];
        let w = [];
        if (v == undefined) return 0;
        let amount = 0;
        w = v.filter(x => x >= fromIndex && x < toIndex);
        
        return w;
    }

    getPayList(payIndex) {
        return this.payList[payIndex];
    }

    async paymentsLength() {
        return (await this.bp.paymentsLength.call());
    }

    async showBalance() {
        for(let i = 0; i<10; i++) {
            let [addr,balance,collected] = await this.getAccount(i);
            let tb = await this.tokenBalance(this.ids[i]);
            tb = tb.toString(10).padStart(9, " ");
            balance = balance.toString(10).padStart(6, " ");
            console.log(i+":"+tb+" "+balance+" "+collected+"\t"+addr);
        }
        console.log("----------------");
    }
}


module.exports = { 
    newAccountFlag,
    BP,
    findEvent,
    getChallengeData,
    prefs
};
