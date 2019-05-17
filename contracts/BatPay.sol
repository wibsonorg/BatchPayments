pragma solidity 0.5.7;


import "./IERC20.sol";
import "./Accounts.sol";
import "./Payments.sol";
import "./SafeMath.sol";


/**
 * @title BatchPayment processing
 * @notice This contract allows to scale ERC-20 token transfer for fees or
 *         micropayments on the few-buyers / many-sellers setting.
 */
contract BatPay is Payments {

    /**
     * @dev Contract constructor, sets ERC20 token this contract will use for payments
     * @param token_ ERC20 contract address
     * @param maxBulk Maximum number of users to register in a single bulkRegister
     * @param maxTransfer Maximum number of destinations on a single payment
     * @param challengeBlocks number of blocks to wait for a challenge
     * @param challengeStepBlocks number of blocks to wait for a single step on
     *        the challenge game
     * @param collectStake stake in tokens for a collect operation
     * @param challengeStake stake in tokens for the challenger of a collect operation
     * @param unlockBlocks number of blocks to wait after registering payment
     *        for an unlock operation
     * @param maxCollectAmount Maximum amount of tokens to be collected in a
     *        single transaction
     */
    constructor(
        address token_,
        uint32 maxBulk,
        uint32 maxTransfer,
        uint32 challengeBlocks,
        uint32 challengeStepBlocks,
        uint64 collectStake,
        uint64 challengeStake,
        uint32 unlockBlocks,
        uint64 maxCollectAmount
    )
        public
    {
        require(token_ != address(0), "Token address can't be zero");
        require(maxBulk > 0, "Parameter maxBulk can't be zero");
        require(maxTransfer > 0, "Parameter maxTransfer can't be zero");
        require(challengeBlocks > 0, "Parameter challengeBlocks can't be zero");
        require(challengeStepBlocks > 0, "Parameter challengeStepBlocks can't be zero");
        require(collectStake > 0, "Parameter collectStake can't be zero");
        require(challengeStake > 0, "Parameter challengeStake can't be zero");
        require(unlockBlocks > 0, "Parameter unlockBlocks can't be zero");
        require(maxCollectAmount > 0, "Parameter maxCollectAmount can't be zero");

        owner = msg.sender;
        token = IERC20(token_);
        params.maxBulk = maxBulk;
        params.maxTransfer = maxTransfer;
        params.challengeBlocks = challengeBlocks;
        params.challengeStepBlocks = challengeStepBlocks;
        params.collectStake = collectStake;
        params.challengeStake = challengeStake;
        params.unlockBlocks = unlockBlocks;
        params.maxCollectAmount = maxCollectAmount;
    }
}
