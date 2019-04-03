var BigNumber = global.web3.BigNumber
var sha3 = global.web3.sha3

function str (a) {
  a = a.toString(16)
  if (a.startsWith('0x')) a = a.substr(2)
  let x = ('0000000000000000000000000000000000000000000000000000000000000000' + a).substr(-64)
  return x
}

const zero = str(0)

function str32 (a) {
  a = a.toString(16)
  if (a.startsWith('0x')) a = a.substr(2)

  return ('00000000' + a).substr(-8)
}

function sha3_1 (a) {
  let aa = str(a)

  return sha3('0x' + aa, { encoding: 'hex' })
}

function sha3_2 (a, b) {
  let aa = str(a)
  let bb = str(b)

  return sha3('0x' + aa + bb, { encoding: 'hex' })
}

function sha3_uint32 (list) {
  let a = ''
  let b = ''

  for (let i = 0; i < 8; i++) {
    a = a + str32(list[i])
    b = b + str32(list[i + 8])
  }

  return sha3('0x' + a + b, { encoding: 'hex' })
}

function merkle (list) {
  let a = []
  let leaves = []

  for (let i = 0; i < list.length; i++) {
    a[i] = { v: sha3_1(list[i]) }
    leaves[i] = a[i]
  }
  let zero = { v: 0 }

  while (a.length > 1) {
    let b = []
    for (let i = 0; i < a.length; i += 2) {
      if (i == a.length - 1) {
        let l = a[i]
        let r = zero
        b.push({ l, r, v: sha3_2(l.v, r.v) })
        a[i].p = b[b.length - 1]
      } else {
        let l = a[i]
        let r = a[i + 1]
        b.push({ l, r, v: sha3_2(l.v, r.v) })
        a[i].p = a[i + 1].p = b[b.length - 1]
      }
    }
    a = b
  }

  a[0].leaves = leaves
  a[0].roothash = a[0].v
  return a[0]
}

/**
 * @typedef MerkleNode
 * @property {string} v sha3 representation of value
 * @property {?MerkleNode} p parent node (undefined in case of the root)
 * @property {?MerkleNode} l left leaf of node
 * @property {?MerkleNode} r right leaf of node
 * @property {?MerkleNode[]} leaves all the leaves of the tree
 * @property {?string} roothash root node will have roothash, which is the same as its sha3 value
 *
 * @typedef MerkleProofNode
 * @property {string} v hash value required to generate the proof array
 * @property {string} d direction of the current leaf, 'r' = right, 'l' = left
 */

/**
 * This function will return an array of nodes that works as proof for merkle validation.
 * @param  {MerkleNode[]} tree Array of nodes from where we will get the proof array
 * @param  {number} index position of specific node from which we need the proof array
 * @return {MerkleProofNode[]} Proof array
 */
function getProof (tree, index) {
  let proof = []
  let node = tree.leaves[index]

  if (node == undefined) return undefined
  // While not in the root of the merkle tree
  while (node.roothash == undefined) {
    let nodeParent = node.p
    if (node == nodeParent.l) {
      // If node is parent's left leaf, then we will need parent's right leaf value
      proof.push({ d: 'r', v: nodeParent.r.v })
    } else {
      // If node is parent's right leaf, then we will need parent's left leaf value
      proof.push({ d: 'l', v: nodeParent.l.v })
    }
    // Move up on the tree to continue the creation of the proof array from bottom to top
    node = nodeParent
  }
  return proof
}

/**
 * This function will receive an array of merkle nodes, and will calculate the
 * resulting root hash of the original merkle tree.
 * @param  {MerkleProofNode[]} proof Array of nodes that will be concatenated to
 * obtain the root hash
 * @param  {string} value Initial value that will be hashed along the remaining nodes
 * @return {string} hash of concatenated values that would ideally match a root hash
 */
function getProofRootHash (proof, value) {
  let hash = sha3_1(value)

  for (let i = 0; i < proof.length; i++) {
    let x = proof[i]
    if (x.d == 'l') {
      hash = sha3_2(x.v, hash)
    } else {
      hash = sha3_2(hash, x.v)
    }
  }

  return hash
}

module.exports = {
  sha3_2,
  sha3_uint32,
  sha3_1,
  merkle,
  getProof,
  getProofRootHash
}
