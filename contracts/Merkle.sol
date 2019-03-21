pragma solidity ^0.4.24;

/// @title Merkle Tree's proof helper contract

library Merkle {
    /// @dev calcultes the hash of two child nodes on the merkle tree
    /// @param a Hash of the left child node
    /// @param b Hash of the right child node
    /// @return sha3 hash of the resulting node

    function combinedHash(uint256 a, uint256 b) public pure returns(bytes32) {
        return keccak256(abi.encodePacked(a, b));
    }

    /// @dev calculates a root hash associated with a merkle proof
    /// @param proof array of proof hashes
    /// @param key index of the leaf element list
    /// @param leaf the leaf element to verify on the set.
    /// @return the hash of the merkle proof. Should match the merkle root if the proof is valid

    function getProofRootHash(uint256[] memory proof, uint256 key, uint256 leaf) public pure  returns(bytes32) {
        bytes32 hash = keccak256(abi.encodePacked(leaf));
        uint256 k = key;
        for(uint i = 0; i<proof.length; i++) {
            uint256 bit = k % 2;
            k = k / 2;

            if (bit == 0)
                hash = combinedHash(uint256(hash), proof[i]);
            else
                hash = combinedHash(proof[i], uint256(hash));
        }
        return hash;
    }
}
