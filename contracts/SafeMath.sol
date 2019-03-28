pragma solidity ^0.4.24;

library SafeMath {
    function mul64(uint256 a, uint256 b) internal pure returns (uint64) {
        if (a == 0) {
            return 0;
        }
        uint256 c = a * b;
        assert(c / a == b);
        assert(c < 2**64);
        return uint64(c);
    }

    function div64(uint256 a, uint256 b) internal pure returns (uint64) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        uint256 c = a / b;
        assert(c < 2**64);
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return uint64(c);
    }

    function sub64(uint256 a, uint256 b) internal pure returns (uint64) {
        uint256 c = a - b;
        assert(b <= a);
        assert(c < 2**64);
        
        return uint64(c);
    }

    function add64(uint256 a, uint256 b) internal pure returns (uint64) {
        uint256 c = a+b;
        assert (c >= a && c < 2**64);
        return uint64(c);
    }

    function mul32(uint256 a, uint256 b) internal pure returns (uint32) {
        if (a == 0) {
            return 0;
        }
        uint256 c = a * b;
        assert(c / a == b);
        assert(c < 2**32);
        return uint32(c);
    }

    function div32(uint256 a, uint256 b) internal pure returns (uint32) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        uint256 c = a / b;
        assert(c < 2**32);
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return uint32(c);
    }

    function sub32(uint256 a, uint256 b) internal pure returns (uint32) {
        uint256 c = a - b;
        assert(b <= a);
        assert(c < 2**32);

        return uint32(c);
    }

    function add32(uint256 a, uint256 b) internal pure returns (uint32) {
        uint256 c = a + b;
        assert (c >= a && c < 2**32);
        return uint32(c);
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }
        uint256 c = a * b;
        assert(c / a == b);
        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        assert(b <= a);
        return a - b;
    }

    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        assert(c >= a);
        return c;
    }
}
