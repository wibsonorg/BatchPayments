var StandardToken = artifacts.require('StandardToken');
var BatPay = artifacts.require('BatPay');
const catchRevert = require('./exceptions').catchRevert;
const truffleAssertions = require('truffle-assertions');
const assertRequire = truffleAssertions.reverts;
const assertPasses = truffleAssertions.passes;
const eventEmitted = truffleAssertions.eventEmitted; 
var BigNumber = web3.BigNumber;
var lib = require('../lib')(web3, artifacts);
var { utils, bat } = lib;
const TestHelper = artifacts.require('./TestHelper');
const merkle = lib.merkle;

var test;

async function skipBlocks(n) {
    let v = [];
    for(let i = 0; i<n; i++)
        v.push(test.skip());

    for(let i = 0; i<n; i++)
        await v[i];
}


contract('Payments', (addr)=> {
  
    let a0 = addr[0];
    let a1 = addr[1];


    let bp, tAddress, st;
    const newAccountFlag = new BigNumber(2).pow(256).minus(1);

    before(async function () {
        this.timeout(10000);
        await utils.skipBlocks(1);
        let ret = await utils.getInstances();
        bp = ret.bp;
        st = ret.token;

        test = await TestHelper.new();

    });


    describe("transfer", ()=> {
        const rootHash = 0x1234;
        const new_count = 0;
        const metadata = 0;
        const fee = 10;
        let unlocker_id = 0;
        const amount_each = 1;
        let list;
        let pay_data;
        let total_amount;
        let v0;
        let from_id;
        let t0;
        let key;
        let lock;
        let b0;
        let unlockBlocks;

        beforeEach(async ()=> {
            // create a list of 100 random ids
            list = utils.randomIds(100, 50000);
            pay_data = utils.getPayData(list);
            total_amount = amount_each * list.length + fee;

            // put enough funds to transfer and bulk register ids
            await st.approve(bp.address, total_amount*2);
            t0 = await bp.deposit(total_amount*2, newAccountFlag);
            from_id = await bp.getAccountsLength.call() - 1;
            v0 = await bp.bulkRegister(list.length, rootHash);

            // create lock
            key = "this-is-the-key";
            lock = utils.hashLock(0, key);
            unlockBlocks = (await bp.params.call())[6].toNumber();

            // initial balance
            b0 = (await bp.balanceOf.call(from_id)).toNumber();
        })

        it('should support up 100s of ids', async ()=> {
            // transfer(fromId, amount, fee, payData, newCount, roothash, lock, metadata)
            await bp.transfer(from_id, amount_each, fee, pay_data, new_count, rootHash, lock, metadata);

            // check balance
            let b1 = (await bp.balanceOf.call(from_id)).toNumber();
            assert.equal(b0, b1 + total_amount);
        });

        it('should accept transfer+unlock with good key', async ()=> {
            let v1 = await bp.transfer(from_id, 1, fee, pay_data, new_count, rootHash, lock, metadata);
            let payId = (await bp.paymentsLength.call()).toNumber() - 1;

            await bp.unlock(payId, unlocker_id, key);

            // check balance
            let b1 = (await bp.balanceOf.call(from_id)).toNumber();
            assert.equal(b0, b1 + total_amount);
        });

        it('should reject transfer+unlock with bad key', async ()=> {
            let v1 = await bp.transfer(from_id, amount_each, fee, pay_data, new_count, rootHash, lock, metadata);
            let payId = (await bp.paymentsLength.call()).toNumber() - 1;

            await assertRequire(bp.unlock(payId, unlocker_id, "not-the-key"), "Invalid key");

            // check balance
            let b1 = (await bp.balanceOf.call(from_id)).toNumber();
            assert.equal(b0, b1 + total_amount);
        });

        it('should accept transfer+refund after timeout', async ()=> {
            let v1 = await bp.transfer(from_id, amount_each, fee, pay_data, new_count, rootHash, lock, metadata);
            let payId = (await bp.paymentsLength.call()).toNumber() - 1;

            await utils.skipBlocks(unlockBlocks);
            let v2 = await bp.refund(payId);

            // check original balance didn't change
            let b1 = (await bp.balanceOf.call(from_id)).toNumber();
            assert.equal(b0, b1);
        });

        it('should reject transfer+refund before timeout', async ()=> {
            let v1 = await bp.transfer(from_id, amount_each, fee, pay_data, new_count, rootHash, lock, metadata);
            let payId = (await bp.paymentsLength.call()).toNumber() - 1;

            await assertRequire(bp.refund(payId), "Hash lock has not expired yet");

            // check balance
            let b1 = (await bp.balanceOf.call(from_id)).toNumber();
            assert.equal(b0, b1 + total_amount);
        });

        it('should reject transfer if bytes per id is 0', async ()=> {
            const bytesPerId = 0;
            pay_data = new web3.BigNumber("0xff" + utils.hex(bytesPerId));

            await assertRequire(bp.transfer(from_id, amount_each, fee, pay_data, new_count, rootHash, lock, metadata), "revert bytes per Id should be positive");

            // check original balance didn't change
            let b1 = (await bp.balanceOf.call(from_id)).toNumber();
            assert.equal(b0, b1);
        });

        it('should reject transfer if bytes payData length is invalid', async ()=> {
            const bytesPerId = 4;
            const data = "0000005"
            pay_data = new web3.BigNumber("0xff" + utils.hex(bytesPerId) + data);

            await assertRequire(bp.transfer(from_id, amount_each, fee, pay_data, new_count, rootHash, lock, metadata), "payData length is invalid");

            // check original balance didn't change
            let b1 = (await bp.balanceOf.call(from_id)).toNumber();
            assert.equal(b0, b1);
        });

        it('should reject transfer if there are too many payees', async ()=> {
            // NOTE: there are 2 checks that depend on newCount:
            //   1. (payData.length-2) / bytesPerId + newCount < maxTransfer = 100000
            //   2. accounts.length + newCount < maxAccountId = 2 ** 32
            //
            // because 100000 < 2 ** 32 we can only trigger the first condition
            let toobig_count = 100000; // this should actually be bp.maxTransfer, however it crashes

            await assertRequire(bp.transfer(from_id, amount_each, fee, pay_data, toobig_count, rootHash, lock, metadata), "too many payees");

            // check original balance didn't change
            let b1 = (await bp.balanceOf.call(from_id)).toNumber();
            assert.equal(b0, b1);
        });

        it('should reject transfer if balance is not enough', async ()=> {
            let balance = await bp.balanceOf(from_id);
            let new_count = list.length;
            let invalid_amount = balance + 1;

            await assertRequire(bp.transfer(from_id, invalid_amount, fee, pay_data, new_count, rootHash, lock, metadata), "not enough funds");

            // check original balance didn't change
            let b1 = (await bp.balanceOf.call(from_id)).toNumber();
            assert.equal(b0, b1);
        });

        it('should correctly substract balance on transfer with new-count=0', async()=> {
            let balance0 = await bp.balanceOf(from_id);
            let new_count = 0;

            await bp.transfer(from_id, amount_each, fee, pay_data, new_count, rootHash, lock, metadata);
            let balance1 = await bp.balanceOf(from_id);

            assert.equal(balance0 - balance1, total_amount);
        });

        
        it('should correctly substract balance on transfer with new-count=10', async()=> {
            let balance0 = await bp.balanceOf(from_id);
            let new_count = 10;

            await bp.transfer(from_id, amount_each, fee, pay_data, new_count, rootHash, lock, metadata);
            let balance1 = await bp.balanceOf(from_id);

            assert.equal(balance0 - balance1, total_amount + amount_each * new_count);
        });

        it('should correctly substract balance on transfer with new-count=1', async()=> {
            let balance0 = await bp.balanceOf(from_id);
            let new_count = 1;

            await bp.transfer(from_id, amount_each, fee, pay_data, new_count, rootHash, lock, metadata);
            let balance1 = await bp.balanceOf(from_id);

            assert.equal(balance0 - balance1, total_amount + amount_each * new_count);
        });

        
        it('should correctly substract balance on transfer with no payData', async()=> {
            let balance0 = await bp.balanceOf(from_id);
            let new_count = 10;
            
            let pdata = pay_data = utils.getPayData([]);
            await bp.transfer(from_id, amount_each, fee, pdata, new_count, rootHash, lock, metadata);
            let balance1 = await bp.balanceOf(from_id);

            assert.equal(balance0 - balance1, fee + amount_each * new_count);
        });
    });


    describe("collect", () => {
        let b,id;
        let acc;
        let userid = [];
        let payid = [];
        let nUsers = 10;
        let nPays = 10;
        let maxPayIndex = 0;


        before(async ()=> {
            b = new bat.BP(bp, st);
            acc = web3.eth.accounts;

            await b.init();
            let [mainId, receipt] = await b.deposit(100000, -1, acc[0]);
            id = mainId;

            for(let i = 0; i<nUsers; i++)
            {
                let [ id, t ] = await b.register(acc[0]);
                userid.push(id);
            }

            for(let i = 0; i<nPays; i++) 
            {
                let [ pid, t ] = await b.transfer(id, 10, 2, userid, 0);
                payid.push(pid);
                if (pid > maxPayIndex) maxPayIndex = pid;
            }

            await utils.skipBlocks(b.unlockBlocks);
        });
        it('should collect', async ()=>{
            let mid = userid[0];
            let amount = await b.getCollectAmount(mid, 0, maxPayIndex+1);
            let b0 = (await b.balanceOf(mid)).toNumber();
            await b.collect(id, 0, mid, 0, maxPayIndex+1, amount, 0, 0);
            await utils.skipBlocks(b.challengeBlocks);
            await b.freeSlot(id, 0);
            let b1 = (await b.balanceOf(mid)).toNumber();
            assert.equal(b0+amount,b1);
        });
        it('should instant-collect', async ()=>{
            let mid = userid[1];
            let amount = await b.getCollectAmount(mid, 0, maxPayIndex+1);
            let b0 = (await b.balanceOf(mid)).toNumber();
            await b.collect(id, b.instantSlot, mid, 0, maxPayIndex+1, amount, 0, 0);
            let b1 = (await b.balanceOf(mid)).toNumber();
        
            assert.equal(b0+amount,b1);
        });
        it('should reuse slot', async ()=>{
            let mid = userid[2];
            let amount = await b.getCollectAmount(mid, 0, maxPayIndex/2);
            let b0 = (await b.balanceOf(mid)).toNumber();
            await b.collect(id, 1, mid, 0, maxPayIndex/2, amount, 0, 0);
            await utils.skipBlocks(b.challengeBlocks);
            let amount2 = await b.getCollectAmount(mid, maxPayIndex/2, maxPayIndex+1);
            // await b.freeSlot(id, 1);
            let r1 = await b.collect(id, 1, mid, maxPayIndex/2, maxPayIndex+1, amount2, 0, 0);
            let b1 = (await b.balanceOf(mid)).toNumber();
            await utils.skipBlocks(b.challengeBlocks);
            await b.freeSlot(id, 1);
            let b2 = (await b.balanceOf(mid)).toNumber();  
            assert.equal(b0+amount,b1);
            assert.equal(b1+amount2, b2);
        });
        it('should pay fee on instant-collect', async ()=>{
            let mid = userid[3];
            let slot = b.instantSlot+1;
            let amount = await b.getCollectAmount(mid, 0, maxPayIndex+1);
            let fee = Math.floor(amount/3);
            let b0 = (await b.balanceOf(mid)).toNumber();
            let c0 = (await b.balanceOf(id)).toNumber();
            await b.collect(id, slot, mid, 0, maxPayIndex+1, amount, amount/3, 0);
            await utils.skipBlocks(b.challengeBlocks);
            await b.freeSlot(id, slot);

            let b1 = (await b.balanceOf(mid)).toNumber();
            let c1 = (await b.balanceOf(id)).toNumber();
           
            assert.equal(b0+amount-fee,b1);
            assert.equal(c0+fee, c1);
        });
        it('should pay fee', async ()=>{
            let mid = userid[4];
            let slot = 2;
            let amount = await b.getCollectAmount(mid, 0, maxPayIndex+1);
            let fee = Math.floor(amount/3);
            let b0 = (await b.balanceOf(mid)).toNumber();
            let c0 = (await b.balanceOf(id)).toNumber();
            await b.collect(id, slot, mid, 0, maxPayIndex+1, amount, amount/3, 0);
            await utils.skipBlocks(b.challengeBlocks);
            await b.freeSlot(id, slot);

            let b1 = (await b.balanceOf(mid)).toNumber();
            let c1 = (await b.balanceOf(id)).toNumber();
           
            assert.equal(b0+amount-fee,b1);
            assert.equal(c0+fee, c1);
        });
        it('should withdraw if requested', async ()=>{
            let mid = userid[5];
            let slot = 3;
            let amount = await b.getCollectAmount(mid, 0, maxPayIndex+1);
            let fee = Math.floor(amount/3);
            let b0 = (await b.balanceOf(mid)).toNumber();
            let c0 = (await b.balanceOf(id)).toNumber();
            let d0 = (await b.tokenBalance(acc[1])).toNumber();

            await b.collect(id, slot, mid, 0, maxPayIndex+1, amount, amount/3, acc[1]);
            await utils.skipBlocks(b.challengeBlocks);
            await b.freeSlot(id, slot);

            let b1 = (await b.balanceOf(mid)).toNumber();
            let c1 = (await b.balanceOf(id)).toNumber();
            let d1 = (await b.tokenBalance(acc[1])).toNumber();
  
            assert.equal(d0+amount-fee,d1);
            assert.equal(c0+fee, c1);
          //  assert.equal(b1, 0);

        });
        it('should withdraw if requested instant', async ()=>{
            let mid = userid[6];
            let slot = b.instantSlot+2;
            let amount = await b.getCollectAmount(mid, 0, maxPayIndex+1);
            let fee = Math.floor(amount/3);
            let b0 = (await b.balanceOf(mid)).toNumber();
            let c0 = (await b.balanceOf(id)).toNumber();
            let d0 = (await b.tokenBalance(acc[1])).toNumber();

            await b.collect(id, slot, mid, 0, maxPayIndex+1, amount, amount/3, acc[1]);
            let b1 = (await b.balanceOf(mid)).toNumber();
            let d1 = (await b.tokenBalance(acc[1])).toNumber();
  
            await utils.skipBlocks(b.challengeBlocks);
            await b.freeSlot(id, slot);

            let c1 = (await b.balanceOf(id)).toNumber();
         
            assert.equal(d0+amount-fee,d1);
            assert.equal(c0+fee, c1);
            assert.equal(b1, 0);
            
        });
        it('should reject if wrong payIndex', async ()=>{
            let mid = userid[6];
            let slot = b.instantSlot+2;
            let amount = await b.getCollectAmount(mid, 0, maxPayIndex+1);
            let [addr,balance,collected] = await b.getAccount(mid);

            let fee = Math.floor(amount/3);
            let b0 = (await b.balanceOf(mid)).toNumber();
            let c0 = (await b.balanceOf(id)).toNumber();
            let d0 = (await b.tokenBalance(acc[1])).toNumber();

            assertRequire(b.collect(id, slot, mid, collected, maxPayIndex+1, amount, amount/3, acc[1]), "payIndex is not a valid value");
    
        });
        it('should reject if invalid payIndex', async ()=>{
            let mid = userid[6];
            let slot = b.instantSlot+2;
            let amount = await b.getCollectAmount(mid, 0, maxPayIndex+1);
            let [addr,balance,collected] = await b.getAccount(mid);

            let fee = Math.floor(amount/3);
            let b0 = (await b.balanceOf(mid)).toNumber();
            let c0 = (await b.balanceOf(id)).toNumber();
            let d0 = (await b.tokenBalance(acc[1])).toNumber();

            assertRequire(b.collect(id, slot, mid, collected, (await b.paymentsLength())+100, amount, amount/3, acc[1]), "invalid payIndex");
    
        });
        
        it('should reject if invalid to-id', async ()=>{
            let mid = userid[6];
            let slot = b.instantSlot+2;
            let amount = await b.getCollectAmount(mid, 0, maxPayIndex+1);
            let [addr,balance,collected] = await b.getAccount(mid);

            let fee = Math.floor(amount/3);
            let b0 = (await b.balanceOf(mid)).toNumber();
            let c0 = (await b.balanceOf(id)).toNumber();
            let d0 = (await b.tokenBalance(acc[1])).toNumber();

            assertRequire(b.collect(id, slot, 1000000, 0, 1, amount, amount/3, acc[1]), "to must be a valid account id");
    
        });
        it('should reject invalid signature/wrong fromPayIndex', async ()=>{
            let mid = userid[7];
            let slot = b.instantSlot+2;
            let amount = await b.getCollectAmount(mid, 0, maxPayIndex+1);
            let [addr,balance,collected] = await b.getAccount(mid);

            let fee = Math.floor(amount/3);
            let b0 = (await b.balanceOf(mid)).toNumber();
            let c0 = (await b.balanceOf(id)).toNumber();
            let d0 = (await b.tokenBalance(acc[1])).toNumber();

            assertRequire(b.collect(id, slot, 1000000, collected+1, maxPayIndex, amount, amount/3, 0), "Bad user signature");
        });
    });


})
