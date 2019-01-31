pragma solidity ^0.4.10;

import "./Merkle.sol";

contract TestHelper  {
    constructor() public {
    }

    function skip() public {
    }

    function hash(bytes x) public pure returns(bytes32) {
        return keccak256(abi.encodePacked(x));
    }


    /**
    * @dev Recover signer address from a message by using their signature
    * @param _hash bytes32 message, the hash is the signed message. What is recovered is the signer address.
    * @param _sig bytes signature, the signature is generated using web3.eth.sign()
    */
    function recover(bytes32 _hash, bytes _sig)
        public
        pure
        returns (address)
    {
        bytes32 r;
        bytes32 s;
        uint8 v;

        // Check the signature length
        if (_sig.length != 65) {
            return (address(0));
        }

        // Divide the signature in r, s and v variables
        // ecrecover takes the signature parameters, and the only way to get them
        // currently is to use assembly.
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            r := mload(add(_sig, 32))
            s := mload(add(_sig, 64))
            v := byte(0, mload(add(_sig, 96)))
        }

        // Version of signature should be 27 or 28, but 0 and 1 are also possible versions
        if (v < 27) {
            v += 27;
        }

        // If the version is correct return the signer address
        if (v != 27 && v != 28) {
            return (address(0));
        } else {
        // solium-disable-next-line arg-overflow
            return ecrecover(_hash, v, r, s);
        }
    }

    /**
    * toEthSignedMessageHash
    * @dev prefix a bytes32 value with "\x19Ethereum Signed Message:"
    * and hash the result
    */
    function toEthSignedMessageHash(bytes32 _hash)
        public
        pure
        returns (bytes32)
    {
        // 32 is the length in bytes of hash,
        // enforced by the type signature above
        return keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash)
        );
    }
    
    function getHashForCollect(uint32 delegate, uint32 toId, uint32 fromPay, uint32 toPay, uint64 amount) public pure returns(bytes32) {
        return keccak256(abi.encodePacked(delegate, toId, fromPay, toPay, amount)); 
    }

    function recoverHelper(bytes32 hashv, uint8 v, bytes32 r, bytes32 s) public pure returns (address) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, hashv));
        address addr = ecrecover(prefixedHash, v, r, s);

        return addr;
    }

    function getHash(uint256 a, uint256 b) public pure returns (bytes32) {
        return Merkle.getHash(a,b);
    }

    function evalProof(uint256[] memory proof, uint256 key, uint256 value) public pure  returns(bytes32) {
        return Merkle.evalProof(proof, key, value);
    }

    function test(uint y, bytes memory x) public returns (uint256) {
        uint256 ret = y;
        for(uint i = 0; i<x.length && i < 32; i++) ret = ret * 256 + uint(x[i]);

        return ret;
    }

    function testlen(uint y, bytes memory x) public returns (uint256) {
        if (y==1234) return 0;
        return x.length;
    }
}