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
var unlockBlocks;

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
    const newAccountFlag = new BigNumber(2).pow(256).minus(1);

    before(async ()=> {
        let ret = await utils.getInstances();
        bp = ret.bp;
        st = ret.token;

        test = await TestHelper.new();

        let params = await bp.params.call();

        unlockBlocks = params[7].toNumber();
        challengeBlocks = params[3].toNumber();
        challengeStepBlocks = params[4].toNumber();
        instantSlot = (await bp.instantSlot.call()).toNumber();
    });

    describe ("misc", ()=> {
        it('cannot obtain the balance for invalid id', async ()=> {
            let l0 = await bp.getAccountsLength.call();
            let invalid_id = l0.toNumber();

            await assertRequire(bp.balanceOf(invalid_id),   "accountId is not valid");
            await assertRequire(bp.balanceOf(invalid_id+1), "accountId is not valid");
        })

    });

})
