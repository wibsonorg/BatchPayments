const { merkle, Batpay: { toLeftPaddedBytes32 } } = require('../lib')(web3, artifacts)
const { sha3_1 } = merkle;

var BigNumber = web3.BigNumber

var TestHelper = artifacts.require('./TestHelper')

describe('merkle lib', () => {
  var testhelper

  before(async () => {
    testhelper = await TestHelper.deployed()
    return await testhelper
  })

  describe('sha3', () => {
    it('should pass test vectors with uint256', async () => {
      let v0 = merkle.sha3_2(
        '0xebe9dbca91a953d23b97064bcb43745fc1ddcd8d527f16bc04abe5151e45d504',
        '0x656e12c23977562f7e6d670a904415c6624227a00805bc9be064529a9f3d3a99')

      let v1 = merkle.sha3_2(
        '0x18b1894d6fbc6b3c6000bd16384f86be0e27f078dd6022c23ae4bac5292011ad',
        '0xc6564273d2fde1741bd00076de69436536bd1dbca8edd3d7cae231e0c6296e9a')

      assert.equal(v0, '0x58b5bcd0d8dfbbb799ed26f5fe41f0610020440add55dba37ac4a0965004f08a')
      assert.equal(v1, '0x0f2b81d13198e6f462303a1d1074bd4c4fe2780b7a37b909a240cbb9316ab69b')
    })

    it('should match solidity\'s sha3', async () => {
      let a = new BigNumber('0xebe9dbca91a953d23b97064bcb43745fc1ddcd8d527f16bc04abe5151e45d504')
      let b = new BigNumber('0x656e12c23977562f7e6d670a904415c6624227a00805bc9be064529a9f3d3a99')

      let v0 = merkle.sha3_2(a, b)
      let v1 = await testhelper.combinedHash(a, b)

      assert.equal(v0, v1)
    })

    it('should pass test vectors with BigNumbers', async () => {
      let v0 = merkle.sha3_2(
        new BigNumber('0xebe9dbca91a953d23b97064bcb43745fc1ddcd8d527f16bc04abe5151e45d504'),
        new BigNumber('0x656e12c23977562f7e6d670a904415c6624227a00805bc9be064529a9f3d3a99'))

      let v1 = merkle.sha3_2(
        new BigNumber('0x18b1894d6fbc6b3c6000bd16384f86be0e27f078dd6022c23ae4bac5292011ad'),
        new BigNumber('0xc6564273d2fde1741bd00076de69436536bd1dbca8edd3d7cae231e0c6296e9a'))

      assert.equal(v0, '0x58b5bcd0d8dfbbb799ed26f5fe41f0610020440add55dba37ac4a0965004f08a')
      assert.equal(v1, '0x0f2b81d13198e6f462303a1d1074bd4c4fe2780b7a37b909a240cbb9316ab69b')
    })

    it('should pass test vectors with uint32', async () => {
      let v0 = merkle.sha3_2(
        '0x0000000100000002000000030000000400000005000000060000000700000008',
        '0x000000090000000a0000000b0000000c0000000d0000000e0000000f00000010')

      let v1 = merkle.sha3_uint32(
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
      )

      assert.equal(v0, v1)
    })
  })

  describe('merkle tree', () => {
    it('should calculate root hash', async () => {
      let v = [1, 2, 3, 4]
      v = merkle.merkle(v)
      let w = merkle.sha3_2(
        merkle.sha3_2(sha3_1(1), sha3_1(2)),
        merkle.sha3_2(sha3_1(3), sha3_1(4)))

      assert.equal(v.roothash, w)
    })

    it('should calculate root hash for odd number of elements', async () => {
      let v = [1, 2, 3]
      v = merkle.merkle(v)
      let w = merkle.sha3_2(
        merkle.sha3_2(sha3_1(1), sha3_1(2)),
        merkle.sha3_2(sha3_1(3), 0))

      assert.equal(v.roothash, w)
    })

    it('should generate proper proofs', async () => {
      let v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
      let tree = merkle.merkle(v)

      for (let i = 0; i < v.length; i++) {
        let proof = merkle.getProof(tree, i)
        let x = merkle.getProofRootHash(proof, v[i])
        assert.equal(tree.roothash, x)
      }
    })

    it('should match solidity\'s eval proofs', async function () {
      let v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
      let tree = merkle.merkle(v)

      for (let i = 0; i < v.length; i++) {
        let proof = merkle.getProof(tree, i)
        let key = 0
        let pp = proof.map(x => { return x.v })

        for (let j = proof.length - 1; j >= 0; j--) {
          key = key * 2
          if (proof[j].d == 'l') key = key + 1
        }

        let x = await testhelper.getProofRootHash.call(pp, key, toLeftPaddedBytes32(v[i]))
        assert.equal(tree.roothash, x)

        x = await testhelper.getProofRootHash.call(pp, key, v[i])
        assert.notEqual(tree.roothash, x, "should fail when not encoded correctly")
      }
    })
  })
})
