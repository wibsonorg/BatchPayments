var StandardToken = artifacts.require('StandardToken');


contract('StandardToken', async (accounts)=>{
    let a0 = accounts[0];
    let a1 = accounts[1];
    let instance;

    before(async ()=>{
        instance = await StandardToken.deployed();
        return await instance;
    });

    it("instance should be defined", async()=>{
        assert.notEqual(instance, undefined);
    });

    it("TotalSupply should be 10000", async ()=> {
        let value = await instance.totalSupply.call();
        assert.equal(value.toNumber(), 10000);
    });

    it("Should assign initial balance to owner", async()=>{
        let value = await instance.balanceOf.call(a0);
        assert.equal(value.toNumber(), 10000);
    });

    it("Should assign zero initial balance to non-owner", async()=>{
        let value = await instance.balanceOf.call(a1);
        assert.equal(value.toNumber(), 0);
    });

    it("Should handle simple transfers", async()=>{
        let v0 = await instance.balanceOf.call(a0);
        let v1 = await instance.balanceOf.call(a1);

        v0 = v0.toNumber();
        v1 = v1.toNumber();
        const x = 10;

        for(let i = 0; i<5; i++) {
            await instance.transfer(a1, x);
            let w0 = await instance.balanceOf.call(a0);
            let w1 = await instance.balanceOf.call(a1);
            w0 = w0.toNumber();
            w1 = w1.toNumber();
            
            assert.equal(w1-v1, (i+1)*x);
            assert.equal(v0-w0, (i+1)*x);
        }
    })
    

} );

