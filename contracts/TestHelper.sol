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

    function test(uint y, bytes x) public returns (uint256) {
        uint256 ret = 0;
        for(uint i = 0; i<x.length && i < 32; i++) ret = ret * 256 + uint(x[i]);

        return ret;
    }

    function testlen(uint y, bytes x) public returns (uint256) {
        
        return x.length;
    }
}