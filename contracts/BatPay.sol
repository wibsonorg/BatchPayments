pragma solidity ^0.4.24;
import "./IERC20.sol";
import "./Accounts.sol";
import "./Payments.sol";
import "./SafeMath.sol";

/// @title BatchPayment processing
/// @notice This contract allows to scale ERC-20 token transfer for fees or micropayments
/// on the few-buyers / many-sellers setting.


contract BatPay is Accounts, Payments {
    address public owner;

    /*
     * Public functions
     */

    /// @dev Contract constructor, sets ERC20 token this contract will use for payments
    /// @param _token ERC20 contract address
    constructor(
        address _token, 
        uint32 maxBulk, 
        uint32 maxTransfer, 
        uint32 challengeBlocks, 
        uint32 challengeStepBlocks,
        uint64 collectStake,
        uint64 challengeStake,
        uint32 unlockBlocks) 
        public 
    {
        owner = msg.sender;
        token = IERC20(_token);

        params.maxBulk = maxBulk;
        params.maxTransfer = maxTransfer;
        params.challengeBlocks = challengeBlocks;
        params.challengeStepBlocks = challengeStepBlocks;
        params.collectStake = collectStake;
        params.challengeStake = challengeStake;
        params.unlockBlocks = unlockBlocks;
    }



 

    /// @dev gets the number of payments issued
    /// @return returns the size of the payments array.

    function paymentsLength() public view returns (uint) {
        return payments.length;
    }

    /// @dev gets the number of bulk registrations performed
    /// @return the size of the bulkRegistrations array.

    function bulkLength() public view returns (uint) {
        return bulkRegistrations.length;
    }

}