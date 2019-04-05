pragma solidity ^0.4.25;

/// @title math operations that returns specific size reults (32, 64 and 256 bits)

library SafeMath {

    /// @dev Multiplies two numbers and returns a uint64
    /// @param a A number
    /// @param b A number
    /// @return a * b as a uint64

    function mul64(uint256 a, uint256 b) internal pure returns (uint64) {
        if (a == 0) {
            return 0;
        }
        uint256 c = a * b;
        assert(c / a == b);
        assert(c < 2**64);
        return uint64(c);
    }

    /// @dev Divides two numbers and returns a uint64
    /// @param a A number
    /// @param b A number
    /// @return a / b as a uint64

    function div64(uint256 a, uint256 b) internal pure returns (uint64) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        uint256 c = a / b;
        assert(c < 2**64);
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return uint64(c);
    }

    /// @dev Substracts two numbers and returns a uint64
    /// @param a A number
    /// @param b A number
    /// @return a - b as a uint64

    function sub64(uint256 a, uint256 b) internal pure returns (uint64) {
        uint256 c = a - b;
        assert(b <= a);
        assert(c < 2**64);

        return uint64(c);
    }

    /// @dev Adds two numbers and returns a uint64
    /// @param a A number
    /// @param b A number
    /// @return a + b as a uint64

    function add64(uint256 a, uint256 b) internal pure returns (uint64) {
        uint256 c = a+b;
        assert(c >= a && c < 2**64);
        return uint64(c);
    }

    /// @dev Multiplies two numbers and returns a uint32
    /// @param a A number
    /// @param b A number
    /// @return a * b as a uint32

    function mul32(uint256 a, uint256 b) internal pure returns (uint32) {
        if (a == 0) {
            return 0;
        }
        uint256 c = a * b;
        assert(c / a == b);
        assert(c < 2**32);
        return uint32(c);
    }

    /// @dev Divides two numbers and returns a uint32
    /// @param a A number
    /// @param b A number
    /// @return a / b as a uint32

    function div32(uint256 a, uint256 b) internal pure returns (uint32) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        uint256 c = a / b;
        assert(c < 2**32);
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return uint32(c);
    }

    /// @dev Substracts two numbers and returns a uint32
    /// @param a A number
    /// @param b A number
    /// @return a - b as a uint32

    function sub32(uint256 a, uint256 b) internal pure returns (uint32) {
        uint256 c = a - b;
        assert(b <= a);
        assert(c < 2**32);

        return uint32(c);
    }

    /// @dev Adds two numbers and returns a uint32
    /// @param a A number
    /// @param b A number
    /// @return a + b as a uint32

    function add32(uint256 a, uint256 b) internal pure returns (uint32) {
        uint256 c = a + b;
        assert(c >= a && c < 2**32);
        return uint32(c);
    }

    /// @dev Multiplies two numbers and returns a uint256
    /// @param a A number
    /// @param b A number
    /// @return a * b as a uint256

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }
        uint256 c = a * b;
        assert(c / a == b);
        return c;
    }

    /// @dev Divides two numbers and returns a uint256
    /// @param a A number
    /// @param b A number
    /// @return a / b as a uint256

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return c;
    }

    /// @dev Substracts two numbers and returns a uint256
    /// @param a A number
    /// @param b A number
    /// @return a - b as a uint256

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        assert(b <= a);
        return a - b;
    }

    /// @dev Adds two numbers and returns a uint256
    /// @param a A number
    /// @param b A number
    /// @return a + b as a uint256

    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        assert(c >= a);
        return c;
    }
}
