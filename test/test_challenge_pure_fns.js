const { reverts, ErrorType } = require('truffle-assertions')
const Challenge = artifacts.require('Challenge')
const { getChallengeData } = require('../lib/bat')
const { getPayData } = require('../lib/utils')

const assertRevert = (promise, message) => reverts(promise, ErrorType.REVERT, message)
const itBehavesLikeAPayDataValidator = (fn) => {
  it('rejects when the payData has wrong format', async () => {
    await assertRevert(fn('0x'), 'must fail when payData has zero length')
    await assertRevert(fn('0x00040000000a00000005'), 'must fail when payData header is missing')
    await assertRevert(fn('0xfff40000000a00000005'), 'must fail when bytesPerId field is negative')
    await assertRevert(fn('0xff0400000a000005'), 'must fail when record size is lower than expected')
    await assertRevert(fn('0xff04000000000a0000000005'), 'must fail when record is greater than expected')
    await assertRevert(fn('0xff04000000a000000000005'), 'must fail when record size is inconsistent')
  })
}

let challenge

contract('Challenge', () => {
  before(async function () {
    challenge = await Challenge.new()
  })

  describe('getDataSum', () => {
    it('returns the sum of the amounts in data', async () => {
      const data = getChallengeData([10, 15, 20, 25], [0, 100, 1000, 10000])
      const result = await challenge.getDataSum(data)
      assert.equal(Number(result), 70, 'wrong summarization')
    })
    it('returns the sum of the amounts even when there is only one element in data', async () => {
      const result = await challenge.getDataSum(getChallengeData([10], [1]))
      assert.equal(Number(result), 10, 'wrong summarization')
    })
    it('rejects when the data has wrong format', async () => {
      await assertRevert(challenge.getDataSum('0x'), 'must fail when data is zero length')
      await assertRevert(
        challenge.getDataSum('0x0000000a0005'),
        'must fail when record size is lower than expected'
      )
      await assertRevert(
        challenge.getDataSum('0x0000000000000000000a000000000005'),
        'must fail when record is greater than expected'
      )
    })
    it('rejects when the summarization causes an overflow', async () => {
      await assertRevert(
        challenge.getDataSum('0xffffffffffffffff00000005000000000000000100000005')
      )
    })
  })

  describe('getDataAtIndex', () => {
    it('returns the amount and payIndex in data at the specified index', async () => {
      const data = getChallengeData([0, 10, 100, 1000], [0, 1, 2, 3])
      const [amount, payIndex] = await challenge.getDataAtIndex(data, 1)
      assert.equal(Number(amount), 10, 'wrong amount')
      assert.equal(Number(payIndex), 1, 'wrong payIndex')
    })
    it('returns the amount and payIndex even when there is only one element in data', async () => {
      const [amount, payIndex] = await challenge.getDataAtIndex(getChallengeData([10], [1]), 0)
      assert.equal(Number(amount), 10, 'wrong summarization')
      assert.equal(Number(payIndex), 1, 'wrong summarization')
    })
    it('rejects when the data has wrong format', async () => {
      await assertRevert(
        challenge.getDataAtIndex('0x', 1),
        'must fail when data is zero length'
      )
      await assertRevert(
        challenge.getDataAtIndex('0x0000000a0005', 1),
        'must fail when record size is lower than expected'
      )
      await assertRevert(
        challenge.getDataAtIndex('0x0000000000000000000a000000000005', 1),
        'must fail when record is greater than expected'
      )
    })
    it('rejects when index does not exist in data', async () => {
      const data = getChallengeData([10, 15], [0, 100])
      await assertRevert(challenge.getDataAtIndex(data, 2))
    })
  })

  describe('getPayDataSum', () => {
    const payData = getPayData([10, 10, 30, 30, 40])
    const amount = 10

    it('returns the sum when the id is present in payData', async () => {
      const result = await challenge.getPayDataSum(payData, 30, amount)
      assert.equal(Number(result), 20, 'wrong summarization')
    })
    it('returns zero when the id is not present in payData', async () => {
      const result = await challenge.getPayDataSum(payData, 20, amount)
      assert.equal(Number(result), 0, 'wrong summarization')
    })
    itBehavesLikeAPayDataValidator(pd => challenge.getPayDataSum(pd, 30, amount))
  })

  describe('getPayDataCount', () => {
    it('returns the record count', async () => {
      const result = await challenge.getPayDataCount(getPayData([5, 15, 25]))
      assert.equal(Number(result), 3, 'wrong payData count')
    })
    it('returns zero when there are no records present in payData', async () => {
      const result = await challenge.getPayDataCount('0xff04')
      assert.equal(Number(result), 0, 'wrong payData count')
    })
    itBehavesLikeAPayDataValidator(pd => challenge.getPayDataCount(pd))
  })
})
