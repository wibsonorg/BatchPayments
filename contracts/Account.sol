pragma solidity ^0.4.24;

library Account {
    struct Record {
        address addr;
        uint64  balance;
        uint32  collected;
    }

    struct BulkRecord {
        bytes32 rootHash;
        uint32  n;
        uint32  minId;
    }
 
}
