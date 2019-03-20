 pragma solidity ^0.4.24;
/// @title Data Structures for BatPay: Accounts, Payments & Challenge

import "./IERC20.sol";

contract Data {
    struct Account {
        address owner;
        uint64  balance;
        uint32  collected;
    }

    struct BulkRegistration {
        bytes32 rootHash;
        uint32  recordCount;
        uint32  smallestRecordId;
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
        uint32  delegate;
        uint32  challenger;
        uint32  index;
        uint64  challengeAmount;
        uint8   status;
        address addr;
        bytes32 data;
    }

    struct Params {
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
    }


    Params public params;
    address public owner;
   
    uint public constant maxAccountId = 2**32-1;      // Maximum account id (32-bits)
    uint public constant newAccountFlag = 2**256-1; // Request registration of new account
    uint public constant instantSlot = 32768;

   
}
