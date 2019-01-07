var StandardToken = artifacts.require('StandardToken');
var BatPay = artifacts.require('BatPay');
const catchRevert = require('./exceptions').catchRevert;
const assertRequire = require('truffle-assertions').reverts;
const assertPasses = require('truffle-assertions').passes;
var BigNumber = web3.BigNumber;
var lib = require('../lib')(web3, artifacts);
var { utils } = lib;
const TestHelper = artifacts.require('./TestHelper');
const merkle = lib.merkle;


contract('BatPay', (addr)=> {
    let a0 = addr[0];
    let a1 = addr[1];

    let bp, tAddress, st;
    const newAccount = new BigNumber(2).pow(256).minus(1);

    before(async ()=> {
        bp = await BatPay.deployed();
        tAddress = await bp.token.call();
        st = await StandardToken.at(tAddress);
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
/*
        it('Should accept deposit with decimals', async ()=> {
            const initial = await st.balanceOf.call(a0);
            const amount = 1.1;

            let r0 = await st.approve(bp.address, amount);
            let r1 = await bp.deposit(amount, newAccount);

            let v0 = await bp.balanceOf.call(0);
            await bp.deposit(amount, 0);
            let v1 = await bp.balanceOf.call(0);

            assert.equal(v1.toNumber() - v0.toNumber(), amount);
            assert.equal(v1.toNumber(), amount);
        });
*/
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

//            let balance = await bp.balanceOf(id);
//            balance = balance.toNumber();

            await catchRevert(bp.withdraw(amount/2, id+1));
        });

        it('Should reject withdrawals for sums larger than balance', async ()=> {
            const amount = 100;

            await st.approve(bp.address, amount);
            await bp.deposit(amount, newAccount);

            let id = await bp.accountsLength.call();
            id = id.toNumber()-1;

            let balance = await bp.balanceOf.call(id);
            balance = balance.toNumber();

            await catchRevert(bp.withdraw(balance+1, id));
        });
    });

    describe('registration', ()=> {
        it('deposit() should register new accounts', async() => {
            let v0 = await bp.accountsLength.call();
            const amount = 100;
    
            await st.approve(bp.address, amount);
            await bp.deposit(1, newAccount); 
            const v1 = await bp.accountsLength.call();
            await bp.deposit(1, newAccount); 
            const v2 = await bp.accountsLength.call();
            
            assert.equal(v2.toNumber() - v0.toNumber(), 2); // shouldn't this be 1 as well?
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
        })

        // TODO: check case we registered a lot of accounts
        // accounts.length < maxAccount, "no more accounts left");
    });

    describe("transfer", ()=> {
        it('should support up to 1000 ids', async ()=> {
            let list = utils.randomIds(1000, 50000);
            let data = utils.getPayData(list);

            const amount = list.length;
    
            await st.approve(bp.address, amount);
            let t0 = await bp.deposit(amount, newAccount); 
            await t0;
            let id = await bp.accountsLength.call() - 1;
            
            let v0 = await bp.bulkRegister(100, 0);
            await v0;

            let v1 = await bp.transfer(id, 1, data, 0, 0x1234, 0, 0);

            await v1;
        })
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

    describe ("misc", ()=> {
        it('cannot obtain the balance for invalid id', async ()=> {
            let l0 = await bp.accountsLength.call();
            let invalid_id = l0.toNumber();

            await assertRequire(bp.balanceOf(invalid_id),   "id is not valid");
            await assertRequire(bp.balanceOf(invalid_id+1), "id is not valid");
        })

        // TODO: can not create test cases for isValidID() as it is declared as 'internal'
    });

})