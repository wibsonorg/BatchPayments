pragma solidity ^0.4.10;

import "./Merkle.sol";

contract TestHelper  {
    constructor() public {
    }

    function getHash(uint256 a, uint256 b) public pure returns (bytes32) {
        return Merkle.getHash(a,b);
    }

    function evalProof(uint256[] proof, uint256 key, uint256 value) public pure  returns(bytes32) {
        return Merkle.evalProof(proof, key, value);
    }
}