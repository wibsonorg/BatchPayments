pragma solidity ^0.4.24;

library Merkle {
    function getHash(uint256 a, uint256 b) internal pure returns(bytes32) {
        return keccak256(abi.encodePacked(a, b));
    }

    function evalProof(uint256[] proof, uint256 key, uint256 value) internal pure  returns(bytes32) {
        bytes32 hash = bytes32(value);
        uint256 k = key;
        for(uint i = 0; i<proof.length; i++) {
            uint256 bit = k % 2;
            k = k / 2;

            if (bit == 0)
                hash = getHash(uint256(hash), proof[i]);
            else
                hash = getHash(proof[i], uint256(hash));
        }
        return hash;
    }
}