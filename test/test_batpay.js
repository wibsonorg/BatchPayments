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
var unlockBlocks, challengeBlocks, challengeStepBlocks, instantSlot;


async function skipBlocks(n) {
    let v = [];
    for(let i = 0; i<n; i++)
        v.push(test.skip());

    for(let i = 0; i<n; i++)
        await v[i];
}


contract('BatPay', (addr)=> {
    let a0 = addr[0];
    let a1 = addr[1];

    let bp, tAddress, st;
    const newAccount = new BigNumber(2).pow(256).minus(1);

    before(async ()=> {
        bp = await BatPay.deployed();
        tAddress = await bp.token.call();
        st = await StandardToken.at(tAddress);
        test = await TestHelper.new();

        unlockBlocks = (await bp.unlockBlocks.call()).toNumber();
        challengeBlocks = (await bp.challengeBlocks.call()).toNumber();
        challengeStepBlocks = (await bp.challengeStepBlocks.call()).toNumber();
        instantSlot = (await bp.instantSlot.call()).toNumber();
    });

    describe('deposits', ()=> {
        it('Should fail on not enough approval', async ()=> {
            const amount = 100;
            await st.approve(bp.address, amount-1);
            await catchRevert(bp.deposit(amount, newAccount));

            await st.approve(bp.address, 0);
            await catchRevert(bp.deposit(amount, newAccount));
        });

        it('Should accept deposits for new accounts', async ()=> {
            const initial = await st.balanceOf.call(a0);
            const amount = 100;

            let r0 = await st.approve(bp.address, amount);
            let r1 = await bp.deposit(amount, newAccount);

            let v0 = await st.balanceOf.call(a0);
            let v1 = await st.balanceOf.call(bp.address);

            assert.equal(v0.toNumber(), initial - amount);
            assert.equal(v1.toNumber(), amount);
        });

        it('Should record deposits on account storage', async ()=> {
            const initial = await st.balanceOf.call(a0);
            const amount = 100;

            let r0 = await st.approve(bp.address, 2*amount);
            let r1 = await bp.deposit(amount, newAccount);

            let v0 = await bp.balanceOf.call(0);
            await bp.deposit(amount, 0);
            let v1 = await bp.balanceOf.call(0);

            assert.equal(v1.toNumber() - v0.toNumber(), amount);
            assert.equal(v1.toNumber(), 2*amount);
        });

        it('Should reject 0-token deposits', async ()=> {
            await assertRequire(bp.deposit(0, newAccount), "amount should be positive");
        });
    });

    describe('withdraw', ()=> {
        it('Should accept withdrawals for existing accounts', async ()=> {
            const amount = 100;

            await st.approve(bp.address, amount);
            await bp.deposit(amount, newAccount);
            let id = await bp.accountsLength.call();
            id = id.toNumber()-1;

            let x0 = await bp.balanceOf.call(id);
            let y0 = await st.balanceOf.call(a0);

            let tx = await bp.withdraw(amount/2, id);

            let x1 = await bp.balanceOf.call(id);
            let y1 = await st.balanceOf.call(a0);

            x0 = x0.toNumber();
            y0 = y0.toNumber();
            x1 = x1.toNumber();
            y1 = y1.toNumber();

            assert.equal(x0-x1, amount/2);
            assert.equal(y1-y0, amount/2);
        });

        it('Should reject withdrawals for invalid accounts', async ()=> {
            const amount = 100;

            await st.approve(bp.address, amount);
            await bp.deposit(amount, newAccount);

            let id = await bp.accountsLength.call();
            id = id.toNumber()-1;  // this is a dangerous way to obtain the ID of the newAccount, as many accounts c

            await bp.withdraw(1, id); // make sure we can actually do a withdraw using a valid id
            await catchRevert(bp.withdraw(amount/2, id+1)); // try with invalid id
        });

        it('Should reject withdrawals for sums larger than balance', async ()=> {
            const amount = 100;

            await st.approve(bp.address, amount);
            await bp.deposit(amount, newAccount);

            let id = await bp.accountsLength.call();
            id = id.toNumber()-1;

            let balance = await bp.balanceOf(id);
            balance = balance.toNumber();

            await assertRequire(bp.withdraw(balance+1, id), "insufficient funds");
        });

//        it('Should reject withdrawals for ids that have not been claimed yet', async ()=> {
//            const amount = 100;
//
//            await st.approve(bp.address, amount);
//            await bp.deposit(amount, newAccount);
//
//            let id = await bp.accountsLength.call();
//            id = id.toNumber()-1;
//
//            let balance = await bp.balanceOf(id);
//            balance = balance.toNumber();
//
//            // TODO: complete
//            invalid_addr = 0;
//            proof = [0];
//            bulkId = 1;
//            id = 1;
//            bp.claimId(invalid_addr, proof, id, bulkId);
//
//            await assertRequire(bp.withdraw(balance, id), "Id registration not completed. Use claimId() first");
//        });

        it('Should reject withdrawals for $0', async ()=> {
            const amount = 100;

            await st.approve(bp.address, amount);
            await bp.deposit(amount, newAccount);

            let id = await bp.accountsLength.call();
            id = id.toNumber()-1;

            let balance = await bp.balanceOf(id);
            balance = balance.toNumber();

            await assertRequire(bp.withdraw(0, id), "amount should be nonzero");
        });


//        require(msg.sender == addr, "only owner can withdraw");

    });


    describe('registration', ()=> {
        it('deposit() should register new accounts', async() => {
            let v0 = await bp.accountsLength.call();
            const amount = 100;

            await st.approve(bp.address, amount);
            let tx1 = await bp.deposit(1, newAccount);
            const v1 = await bp.accountsLength.call();
            let tx2 = await bp.deposit(1, newAccount);
            const v2 = await bp.accountsLength.call();

            eventEmitted(tx1, 'Register');
            eventEmitted(tx2, 'Register');
            
            assert.equal(v2.toNumber() - v0.toNumber(), 2);
            assert.equal(v1.toNumber() - v0.toNumber(), 1);
        });

        it('Bulk registration should reserve new accounts', async()=> {
            let v0 = await bp.accountsLength.call();
            const amount = 100;
            const rootHash = web3.fromUtf8("1234");

            await bp.bulkRegister(amount, rootHash);
            const v1 = await bp.accountsLength.call();
            await bp.bulkRegister(1, rootHash);
            const v2 = await bp.accountsLength.call();

            assert.equal(v2.toNumber() - v0.toNumber(), 1+amount);
            assert.equal(v1.toNumber() - v0.toNumber(), amount);
        });

        it('Bulk registration root hashes should be stored', async()=> {
            let v0 = await bp.bulkLength.call();
            const amount = 100;
            const rootHash = web3.fromUtf8("1234");

            await bp.bulkRegister(amount, rootHash);
            const v1 = await bp.bulkLength.call();
            await bp.bulkRegister(1, rootHash);
            const v2 = await bp.bulkLength.call();

            assert.equal(v2.toNumber() - v0.toNumber(), 2);
            assert.equal(v1.toNumber() - v0.toNumber(), 1);
        });

        it('Bulk registration should respect account limits', async()=> {
            let v0 = await bp.bulkLength.call();
            const rootHash = web3.fromUtf8("1234");
            const maxBulk = 2**16;

            await assertRequire(bp.bulkRegister(maxBulk,   rootHash), "Cannot register this number of ids simultaneously");
            await assertRequire(bp.bulkRegister(maxBulk+1, rootHash), "Cannot register this number of ids simultaneously");
        });

        // TODO: check case we run out of ids:
        // require(accounts.length + n <= maxAccount, "Cannot register: ran out of ids");

        it('Bulk registration should fail for n == 0', async()=> {
            let v0 = await bp.bulkLength.call();
            const n = 0;
            const rootHash = web3.fromUtf8("1234");

            await assertRequire(bp.bulkRegister(n, rootHash), "Cannot register 0 ids");
        });

        it('register() adds 1 account at a time', async ()=> {
            let l0 = await bp.accountsLength.call();
            let new_id = await bp.register();
            let l1 = await bp.accountsLength.call();
            let new_id2 = await bp.register();
            let l2 = await bp.accountsLength.call();

            assert.equal(l2 - l0, 2);
            assert.equal(l1 - l0, 1);
        });

        it('register() emits Register event', async () => {
            let tx = await await bp.register();
            let l0 = await bp.accountsLength.call();
            await eventEmitted(tx, 'Register', ev=>ev.id==l0-1);
            
        });

        // TODO: check case we registered a lot of accounts
        // accounts.length < maxAccount, "no more accounts left");
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

        beforeEach(async ()=> {
            // create a list of 100 random ids
            list = utils.randomIds(100, 50000);
            pay_data = utils.getPayData(list);
            total_amount = amount_each * list.length + fee;

            // put enough funds to transfer and bulk register ids
            await st.approve(bp.address, total_amount);
            t0 = await bp.deposit(total_amount, newAccount);
            from_id = await bp.accountsLength.call() - 1;
            v0 = await bp.bulkRegister(list.length, rootHash);

            // create lock
            key = "this-is-the-key";
            lock = utils.hashLock(0, key);

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

            await skipBlocks(unlockBlocks);
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
            //   2. accounts.length + newCount < maxAccount = 2 ** 32
            //
            // because 100000 < 2 ** 32 we can only trigger the first condition
            let toobig_count = 100000; // this should actually be bp.maxTransfer, however it crashes

            await assertRequire(bp.transfer(from_id, amount_each, fee, pay_data, toobig_count, rootHash, lock, metadata), "Cannot register this number of ids simultaneously");

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
    });

    describe ("claim", ()=> {
        const amount = 100;
        const rootHash = web3.fromUtf8("1234");
        var bulkId = 0;
        var proof = [0];
        var id = 0;

        before(async ()=> {
            await bp.bulkRegister(amount, rootHash);
            let bulkId = await bp.bulkLength.call();
            bulkId = bulkId.toNumber() -1; // last one
            let id = 0; // first one
        })

        it('claim happy case', async ()=> {
            let id = amount;
            let values=[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
                        21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
                        41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
                        61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 63, 74, 75, 76, 76, 77, 78, 79, 80,
                        81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101];
            let tree = merkle.merkle(values);
            // TODO: complete
            // let proof = merkle.getProof(tree, id);
            // await assertPasses(bp.claimId(a0, proof, id, bulkId));
        })

        it('cannot claim using an invalid bulkId', async ()=> {
            let invalid_bulkId = bulkId * 2 + 100;

            await assertRequire(bp.claimId(a0, proof, id, invalid_bulkId),   "the bulkId referenced is invalid")
            await assertRequire(bp.claimId(a0, proof, id, invalid_bulkId+1), "the bulkId referenced is invalid")
        })

        it('cannot claim using an id not in the bulk', async ()=> {
            let invalid_id = amount * 2;

            await assertRequire(bp.claimId(a0, proof, invalid_id, bulkId),   "the id specified is not part of that bulk registration slot");
            await assertRequire(bp.claimId(a0, proof, invalid_id+1, bulkId), "the id specified is not part of that bulk registration slot");

            // TODO: there may be additional negative cases
            // require(id >= minId && id < minId+n, "the id specified is not part of that bulk registration slot");
        })

        it('cannot claim using an invalid proof', async ()=> {
            let id = amount;
            let invalid_proof = [0];

            await assertRequire(bp.claimId(a0, invalid_proof, id, bulkId), "invalid Merkle proof");
        })

//        require(id >= minId && id < minId+n, "the id specified is not part of that bulk registration slot");
//        require(hash == rootHash, "Merkle proof invalid");
    });

    describe("collect", ()=> {
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
    describe ("misc", ()=> {
        it('cannot obtain the balance for invalid id', async ()=> {
            let l0 = await bp.accountsLength.call();
            let invalid_id = l0.toNumber();

            await assertRequire(bp.balanceOf(invalid_id),   "id is not valid");
            await assertRequire(bp.balanceOf(invalid_id+1), "id is not valid");
        })

    });

})
