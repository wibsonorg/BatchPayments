var StandardToken = artifacts.require('StandardToken');
var BatPay = artifacts.require('BatPay');
var catchRevert = require('./exceptions').catchRevert;


contract('BatPay', (addr)=>{
    let a0 = addr[0];
    let a1 = addr[1];

    let bp, tAddress, st;
    const newAccount = 0x100000000;

    before(async ()=> {
        bp = await BatPay.deployed();
        tAddress = await bp.token.call();
        st = await StandardToken.at(tAddress);
    });

    describe('deposits', ()=> {
        it('Deposits should fail on not enough approval', async ()=> {
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
            assert.equal(v1.toNumber() , 2*amount);
        });
    
        
        it('Should reject 0-token deposits', async ()=> {
            await catchRevert(bp.deposit(0, newAccount)); 
        });    
    });

    describe('withdraw', ()=>{
       it('Should accept withdrawals for existing accounts', async ()=> {
            const initial = await st.balanceOf.call(a0);
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
            id = id.toNumber()-1;

            let balance = await bp.balanceOf(id);
            balance = balance.toNumber();
         
            await catchRevert(bp.withdraw(amount/2, id+1));

        });
    });

    describe('registration', ()=> {
        it('Should register new accounts', async() => {
            let v0 = await bp.accountsLength.call();
            const amount = 100;
    
            await st.approve(bp.address, amount);
            await bp.deposit(1, newAccount); 
            const v1 = await bp.accountsLength.call();
            await bp.deposit(1, newAccount); 
            const v2 = await bp.accountsLength.call();
            
            assert.equal(v2.toNumber() - v0.toNumber(), 2);
            assert.equal(v1.toNumber() - v0.toNumber(), 1);
        });
    
        it('Bulk register should reserve new accounts', async()=> {
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
            const n = 65537;
            const rootHash = web3.fromUtf8("1234");
    
            await catchRevert(bp.bulkRegister(n, rootHash)); 
           
        });
    });

    
})