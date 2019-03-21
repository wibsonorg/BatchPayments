const Challenge = artifacts.require('Challenge');

let challenge;

contract.only('Challenge', () => {
    before(async function() {
        challenge = await Challenge.new();
    });

    describe('getDataSum', () => {
        it('returns the sum of the amounts in data', async () => {
            const data = '0x000000000000000a00000005000000000000000a00000006000000000000000a00000007000000000000000a00000008';
            const result = await challenge.getDataSum(data);
            assert.equal(Number(result), 40, "wrong summarization");
        });
        it('returns the sum of the amounts even when there is only one element in data');
        it('rejects when the data has wrong format');
        it('rejects when the summarization causes an overflow');
    });

    describe('getDataAtIndex', () => {
        it('returns the amount and payIndex in data at the specified index');
        it('rejects when the data has wrong format');
        it('rejects when index does not exist in data');
    });
});