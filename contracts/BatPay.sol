pragma solidity ^0.4.24;
import "./IERC20.sol";
import "./Accounts.sol";
import "./Payments.sol";
import "./SafeMath.sol";
import "./MassExit.sol";

/// @title BatchPayment processing
/// @notice This contract allows to scale ERC-20 token transfer for fees or micropayments
/// on the few-buyers / many-sellers setting.


contract BatPay is MassExit {
    /*
     * Public functions
     */

    /// @dev Contract constructor, sets ERC20 token this contract will use for payments
    /// @param _token ERC20 contract address
    constructor(
        IERC20 _token,
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

  
 


}