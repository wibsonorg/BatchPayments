const chai = require('chai')
const { MAX_UINT32, MAX_UINT256 } = require('./constants')
const TestHelper = artifacts.require('./TestHelper')
chai.use(require('chai-bignumber')(BigNumber)).should()

async function assertFailure (promise) {
  try {
    await promise
  } catch (error) {
    // we're expecting the assert -> return
    return
  }

  // we shouldn't reach this point
  assert(false, 'operation was expected to fail but succeeded')
}

describe('SafeMath', function () {
  var testhelper

  before(async () => {
    testhelper = await TestHelper.deployed()
    return await testhelper
  })

  describe('uint64 arithmetic', () => {
    it('mul64 with trivial case (zero)', async () => {
      let x = await testhelper.mul64.call(0, 1)
      assert.equal(x.toNumber(), 0)
    })

    it('mul64 boundary for overflow', async () => {
      let a = 2 ** 32
      let b = (2 ** 32) - 1
      let x = await testhelper.mul64.call(a, b)
      // should not revert
      assert.equal(x.toNumber(), 2 ** 64 - 2 ** 32)
    })

    it('mul64 should check uint64 overflow', async () => {
      let a = 2 ** 32
      let b = 2 ** 32
      await assertFailure(testhelper.mul64.call(a, b))
    })

    it('div64 should fail when divide by zero', async () => {
      await assertFailure(testhelper.div64.call(10, 0))
    })

    it('div64 should fail with remainder larger than uint64', async () => {
      let a = 8 ** 64
      let b = 2 ** 64
      await assertFailure(testhelper.div64.call(a, b))
    })

    it('div64 happy case with reaminder = 0', async () => {
      let a = 64
      let b = 8
      let c = await testhelper.div64.call(a, b)
      assert.equal(c.toNumber(), 8)
    })

    it('div64 happy case with remainder = 1', async () => {
      let a = 65
      let b = 8
      let c = await testhelper.div64.call(a, b)
      assert.equal(c.toNumber(), 8)
    })

    it('sub64 should check uint64 overflow', async () => {
      let a = 10 ** 64
      let b = 2 ** 64
      await assertFailure(testhelper.sub64.call(a, b))
    })

    it('sub64 with positive result', async () => {
      let a = 14
      let b = 4
      let c = await testhelper.sub64.call(a, b)
      assert.equal(c.toNumber(), 10)
    })

    it('sub64 cannot produce a negative result', async () => {
      let a = 4
      let b = 14
      await assertFailure(testhelper.sub64.call(a, b))
    })

    it('sub64 with result = 0', async () => {
      let a = 14
      let b = 14
      let c = await testhelper.sub64.call(a, b)
      assert.equal(c, 0)
    })

    it('add64 should check uint64 overflow', async () => {
      let a = 10 ** 64
      let b = 10 ** 64
      await assertFailure(testhelper.add64.call(a, b))
    })

    it('add64 should happy case', async () => {
      let a = 14
      let b = 14
      let c = await testhelper.add64.call(a, b)
      assert.equal(c.toNumber(), 28)
    })
  })

  describe('uint32 arithmetic', () => {
    it('mul32 with trivial case (zero)', async () => {
      let x = await testhelper.mul32.call(0, 1)
      assert.equal(x.toNumber(), 0)
    })

    it('mul32 boundary for overflow', async () => {
      let a = 2 ** 16
      let b = (2 ** 16) - 1
      let x = await testhelper.mul32.call(a, b)
      assert.equal(x.toNumber(), 2 ** 32 - 2 ** 16)
      // should not revert
    })

    it('mul32 should check uint32 overflow', async () => {
      let a = 2 ** 16
      let b = 2 ** 16
      await assertFailure(testhelper.mul32.call(a, b))
    })

    it('div32 should fail when divide by zero', async () => {
      await assertFailure(testhelper.div32.call(10, 0))
    })

    it('div32 should fail with remainder larger than uint32', async () => {
      let a = 8 ** 32
      let b = 2 ** 32
      await assertFailure(testhelper.div32.call(a, b))
    })

    it('div32 happy case with remainder = 0', async () => {
      let a = 64
      let b = 8
      let c = await testhelper.div32.call(a, b)
      assert.equal(c.toNumber(), 8)
    })

    it('div32 happy case with remainder = 1', async () => {
      let a = 65
      let b = 8
      let c = await testhelper.div32.call(a, b)
      assert.equal(c.toNumber(), 8)
    })
    describe('sub32', () => {
      it('should check uint32 overflow', async () => {
        let a = 10 ** 32
        let b = 2 ** 32
        await assertFailure(testhelper.sub32.call(a, b))
      })

      it('with positive result', async () => {
        let a = 14
        let b = 4
        let c = await testhelper.sub32.call(a, b)
        assert.equal(c.toNumber(), 10)
      })

      it('cannot produce a negative result', async () => {
        let a = 4
        let b = 14
        await assertFailure(testhelper.sub32.call(a, b))
      })

      it('with result = 0', async () => {
        let a = 14
        let b = 14
        let c = await testhelper.sub32.call(a, b)
        assert.equal(c.toNumber(), 0)
      })
    })

    describe('add32', () => {
      it('adds correctly', async () => {
        const a = 14
        const b = 14
        const c = await testhelper.add32.call(a, b)
        assert.equal(c, 28)
      })

      it('correctly adds up to maximum value', async () => {
        const a = MAX_UINT32.minus(1)
        const b = new BigNumber('1')
        const c = await testhelper.add32.call(a, b)
        c.should.be.bignumber.equal(a.add(b))
      })

      it('fails on overflow', async () => {
        const a = MAX_UINT32
        const b = new BigNumber('1')
        await assertFailure(testhelper.add32.call(a, b))
      })
    })
  })

  describe('uint256 arithmetic', () => {
    describe('add256', function () {
      it('adds correctly', async function () {
        const a = new BigNumber('12345')
        const b = new BigNumber('85937')
        const c = a.add(b)

        c.should.be.bignumber.equal(await testhelper.add(a, b))
      })

      it('correctly adds up to maximum value', async () => {
        const a = MAX_UINT256.minus(1)
        const b = new BigNumber('1')
        const c = a.add(b)

        c.should.be.bignumber.equal(await testhelper.add(a, b))
      })

      it('reverts on overflow', async function () {
        const a = MAX_UINT256
        const b = new BigNumber('1')

        await assertFailure(testhelper.add(a, b))
      })
    })

    describe('add256', function () {
      it('subtracts correctly', async function () {
        const a = new BigNumber('12345')
        const b = new BigNumber('85937')
        const c = b.sub(a)

        c.should.be.bignumber.equal(await testhelper.sub(b, a))
      })

      it('reverts if subtrahend > minuend', async function () {
        const a = new BigNumber('12345')
        const b = new BigNumber('85937')

        await assertFailure(testhelper.sub(a, b))
      })
    })
  })
})
