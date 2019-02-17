 pragma solidity ^0.4.24;
/// @title Data Structures for BatPay: Accounts, Payments & Challenge


contract Data {
    struct Account {
        address addr;
        uint64  balance;
        uint32  collected;
    }

    struct BulkRecord {
        bytes32 rootHash;
        uint32  n;
        uint32  minId;
    }

    struct Payment {
        uint32  from;
        uint64  amount;
        uint64  fee;
        uint32  minId;  
        uint32  maxId;
        uint32  totalCount;
        uint64  block;
        bytes32 hash;
        bytes32 lock;
        bytes32 metadata;
    }

    struct CollectSlot {
        uint32  minPayIndex;
        uint32  maxPayIndex;
        uint64  amount;
        uint64  delegateAmount;
        uint32  to;
        uint64  block;
        uint8   status;
        uint32  delegate;
        uint32  challenger;
        uint32  index;
        uint64  challengeAmount;
        address addr;
        bytes32 data;
    }

    struct Params {
        uint32 maxBulk;                   //  2**16;  Maximum number of accounts that can be reserved simultaneously
        uint64 maxBalance;                //  2**64-1 Maximum supported token balance
        uint32 maxTransfer;               //  100000  Maximum number of destination accounts per transfer
        uint32 challengeBlocks;           //  30     
        uint32 challengeStepBlocks;       //  10
        uint64 collectStake;              // 100
        uint64 challengeStake;            // 100
        uint32 unlockBlocks;              //  10
    }

    Params public params;

    uint public constant maxAccount = 2**32-1;      // Maximum account id (32-bits)
    uint public constant newAccount = 2**256-1;     // Request registration of new account
    uint public constant instantSlot = 32768;
}
