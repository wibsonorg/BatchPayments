pragma solidity ^0.4.25;


import "./Merkle.sol";
import "./SafeMath.sol";

/**
 * @title helper contract that is used from tests
 */
contract TestHelper {

    function skip() public {}

    /**
     * @dev prefix a bytes32 value with "\x19Ethereum Signed Message:"
     *      and hash the result
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

    /**
     * @dev wrapper. see `Merkle` contract
     */
    function combinedHash(bytes32 a, bytes32 b) public pure returns (bytes32) {
        return Merkle.combinedHash(a, b);
    }

    /**
     * @dev wrapper. see `Merkle` contract
     */
    function getProofRootHash(bytes32[] memory proof, uint256 key, bytes32 value) public pure returns (bytes32) {
        return Merkle.getProofRootHash(proof, key, value);
    }

    /**
     * TODO: complete this one
     * @dev TBC
     */
    function test(uint y, bytes memory x) public pure returns (uint256) {
        uint256 ret = y;
        for (uint i = 0; i < x.length && i < 32; i++) ret = ret * 256 + uint(x[i]);

        return ret;
    }

    /**
     * TODO: complete this one
     * @dev TBC
     */
    function testlen(uint y, bytes memory x) public pure returns (uint256) {
        if (y == 1234) return 0;
        return x.length;
    }

    /**
     * @dev wrapper. see `SafeMath` contract
     */
    function mul64(uint256 a, uint256 b) public pure returns (uint64) {
        return SafeMath.mul64(a, b);
    }

    /**
     * @dev wrapper. see `SafeMath` contract
     */
    function div64(uint256 a, uint256 b) public pure returns (uint64) {
        return SafeMath.div64(a, b);
    }

    /**
     * @dev wrapper. see `SafeMath` contract
     */
    function sub64(uint256 a, uint256 b) public pure returns (uint64) {
        return SafeMath.sub64(a, b);
    }

    /**
     * @dev wrapper. see `SafeMath` contract
     */
    function add64(uint256 a, uint256 b) public pure returns (uint64) {
        return SafeMath.add64(a, b);
    }

    /**
     * @dev wrapper. see `SafeMath` contract
     */
    function mul32(uint256 a, uint256 b) public pure returns (uint32) {
        return SafeMath.mul32(a, b);
    }

    /**
     * @dev wrapper. see `SafeMath` contract
     */
    function div32(uint256 a, uint256 b) public pure returns (uint32) {
        return SafeMath.div32(a, b);
    }

    /**
     * @dev wrapper. see `SafeMath` contract
     */
    function sub32(uint256 a, uint256 b) public pure returns (uint32) {
        return SafeMath.sub32(a, b);
    }

    /**
     * @dev wrapper. see `SafeMath` contract
     */
    function add32(uint256 a, uint256 b) public pure returns (uint32) {
        return SafeMath.add32(a, b);
    }

    /**
     * @dev wrapper. see `SafeMath` contract
     */
    function mul(uint256 a, uint256 b) public pure returns (uint256) {
        return SafeMath.mul(a, b);
    }

    /**
     * @dev wrapper. see `SafeMath` contract
     */
    function div(uint256 a, uint256 b) public pure returns (uint256) {
        return SafeMath.div(a, b);
    }

    /**
     * @dev wrapper. see `SafeMath` contract
     */
    function sub(uint256 a, uint256 b) public pure returns (uint256) {
        return SafeMath.sub(a, b);
    }

    /**
     * @dev wrapper. see `SafeMath` contract
     */
    function add(uint256 a, uint256 b) public pure returns (uint256) {
        return SafeMath.add(a, b);
    }
}
