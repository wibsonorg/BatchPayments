pragma solidity 0.4.25;


import "./IERC20.sol";


/**
 * @title Data Structures for BatPay: Accounts, Payments & Challenge
 */
contract Data {
    struct Account {
        address owner;
        uint64  balance;
        uint32  lastCollectedPaymentId;
    }

    struct BulkRegistration {
        bytes32 rootHash;
        uint32  recordCount;
        uint32  smallestRecordId;
    }

    struct Payment {
        uint32  fromAccountId;
        uint64  amount;
        uint64  fee;
        uint32  smallestAccountId;
        uint32  greatestAccountId;
        uint32  totalNumberOfPayees;
        uint64  lockTimeoutBlockNumber;
        bytes32 paymentDataHash;
        bytes32 lockingKeyHash;
        bytes32 metadata;
    }

    struct CollectSlot {
        uint32  minPayIndex;
        uint32  maxPayIndex;
        uint64  amount;
        uint64  delegateAmount;
        uint32  to;
        uint64  block;
        uint32  delegate;
        uint32  challenger;
        uint32  index;
        uint64  challengeAmount;
        uint8   status;
        address addr;
        bytes32 data;
    }

    struct Config {
        uint32 maxBulk;
        uint32 maxTransfer;
        uint32 challengeBlocks;
        uint32 challengeStepBlocks;
        uint64 collectStake;
        uint64 challengeStake;
        uint32 unlockBlocks;
        uint32 massExitIdBlocks;
        uint32 massExitIdStepBlocks;
        uint32 massExitBalanceBlocks;
        uint32 massExitBalanceStepBlocks;
        uint64 massExitStake;
        uint64 massExitChallengeStake;
        uint64 maxCollectAmount;
    }

    Config public params;
    address public owner;

    uint public constant MAX_ACCOUNT_ID = 2**32-1;    // Maximum account id (32-bits)
    uint public constant NEW_ACCOUNT_FLAG = 2**256-1; // Request registration of new account
    uint public constant INSTANT_SLOT = 32768;

}
