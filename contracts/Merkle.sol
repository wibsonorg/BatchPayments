pragma solidity 0.4.25;


/**
 * @title Merkle Tree's proof helper contract
 */
library Merkle {

    /**
     * @dev calculates the hash of two child nodes on the merkle tree.
     * @param a Hash of the left child node.
     * @param b Hash of the right child node.
     * @return sha3 hash of the resulting node.
     */
    function combinedHash(bytes32 a, bytes32 b) public pure returns(bytes32) {
        return keccak256(abi.encodePacked(a, b));
    }

    /**
     * @dev calculates a root hash associated with a Merkle proof
     * @param proof array of proof hashes
     * @param key index of the leaf element list.
     *        this key indicates the specific position of the leaf
     *        in the merkle tree. It will be used to know if the
     *        node that will be hashed along with the proof node
     *        is placed on the right or the left of the current
     *        tree level. That is achieved by doing the modulo of
     *        the current key/position. A new level of nodes will
     *        be evaluated after that, and the new left or right
     *        position is obtained by doing the same operation, 
     *        after dividing the key/position by two.
     * @param leaf the leaf element to verify on the set.
     * @return the hash of the Merkle proof. Should match the Merkle root
     *         if the proof is valid
     */
    function getProofRootHash(bytes32[] memory proof, uint256 key, bytes32 leaf) public pure returns(bytes32) {
        bytes32 hash = keccak256(abi.encodePacked(leaf));
        uint256 k = key;
        for(uint i = 0; i<proof.length; i++) {
            uint256 bit = k % 2;
            k = k / 2;

            if (bit == 0)
                hash = combinedHash(hash, proof[i]);
            else
                hash = combinedHash(proof[i], hash);
        }
        return hash;
    }
}
