pragma solidity ^0.4.24;

import "./IERC20.sol";
import "./Accounts.sol";
import "./Payments.sol";
import "./SafeMath.sol";

/// @title BatchPayment processing
/// @notice This contract allows to scale ERC-20 token transfer for fees or
///         micropayments on the few-buyers / many-sellers setting.

contract BatPay is Payments {

     /// @dev Contract constructor, sets ERC20 token this contract will use for payments
     /// @param token_ ERC20 contract address
     /// @param maxBulk Maximum number of users to register in a single bulkRegister
     /// @param maxTransfer Maximum number of destinations on a single payment
     /// @param challengeBlocks number of blocks to wait for a challenge
     /// @param challengeStepBlocks number of blocks to wait for a single step
     ///        on the challenge game
     /// @param collectStake stake in tokens for a collect operation
     /// @param challengeStake stake in tokens for the challenger of a collect operation
     /// @param unlockBlocks number of blocks to wait after registering payment
     ///        for an unlock operation

    constructor(
        IERC20 _token,
        uint32 maxBulk,
        uint32 maxTransfer,
        uint32 challengeBlocks,
        uint32 challengeStepBlocks,
        uint64 collectStake,
        uint64 challengeStake,
        uint32 unlockBlocks)
        public {
            require(_token != address(0));
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
