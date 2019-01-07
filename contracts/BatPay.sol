pragma solidity ^0.4.24;
import "./IERC20.sol";
import "./Merkle.sol";

contract BatPay {
    uint constant public maxAccount = 2**32-1;
    uint constant public maxBulk = 2**16;
    uint constant public newAccount = 2**256-1; // special account id. It's NOT in the range of accounts
    uint constant public maxBalance = 2**64-1;
    uint constant public maxTransfer = 100000;
    uint constant public unlockTime = 2 hours; // Should this be a parameter of transfer() ?
    uint constant public challengeTime = 2 days;
    uint64 constant public collectBond = 100000;

    struct Account {
        address addr;
        uint64  balance;
        uint32  collected;
    }

    struct Payment {
        uint32  from;
        bytes32 hash;
        uint64  amount;
        uint32  minId;  // ???: Use BulkRecordId instead??
        uint32  maxId;
        uint32  totalCount;
        bytes32 lock;
        uint64  timestamp;
        bytes32 metadata;
    }

    struct BulkRecord {
        bytes32 rootHash;
        uint32  n;
        uint32  minId;
    }

    struct CollectSlot {
        uint32  minPayId;
        uint32  maxPayId;
        uint64  amount;
        uint32  to;
        uint64  timestamp;
        uint8   status;
    }

    mapping (uint32 => mapping (uint32 => CollectSlot)) collects;

    address public owner;
    IERC20 public token;
    Account[] public accounts;
    BulkRecord[] public bulkRegistrations;
    Payment[] public payments;

    function isValidId(uint id) internal view returns (bool) {
        return (id < accounts.length);
    }

    // TODO: rename this function to something more meaningful
    function isOwnerId(uint id) internal view returns (bool) {
        return isValidId(id) && msg.sender == accounts[id].addr;
    }

    modifier validId(uint id) {
        require(isValidId(id), "id is not valid");
        _;
    }

    modifier onlyOwnerId(uint id) {
        require(isOwnerId(id), "Only owner can invoke this method");
        _;
    }
    
    constructor(address _token) public {
        owner = msg.sender;
        token = IERC20(_token);
    }

    // Reserve n accounts but delay assigning addresses
    // Accounts will be claimed later using MerkleTree's rootHash

    function bulkRegister(uint256 n, bytes32 rootHash) public {
        require(n > 0, "Cannot register 0 ids");
        require(n < maxBulk, "Cannot register this number of ids simultaneously");
        require(accounts.length + n <= maxAccount, "Cannot register: ran out of ids");

        bulkRegistrations.push(BulkRecord(rootHash, uint32(n), uint32(accounts.length)));
        accounts.length += n;
    }

    // Register a new account

    function claimId(address addr, uint256[] proof, uint id, uint bulkId) public returns (bool) {
        require(bulkId < bulkRegistrations.length, "the bulkId referenced is invalid");
        uint minId = bulkRegistrations[bulkId].minId;
        uint n = bulkRegistrations[bulkId].n;
        bytes32 rootHash = bulkRegistrations[bulkId].rootHash;

        // should be id - minId
        bytes32 hash = Merkle.evalProof(proof, id, uint256(addr));
        
        require(id >= minId && id < minId+n, "the id specified is not part of that bulk registration slot");
        require(hash == rootHash, "invalid Merkle proof");

        accounts[id].addr = addr;

        return true; // do we actually need to return a value?
    }

    function register() public returns (uint32 ret) {
        require(accounts.length < maxAccount, "no more accounts left");
        ret = (uint32)(accounts.length);
        accounts.length += 1;
        accounts[ret] = Account(msg.sender, 0, 0);

        return ret;
    } 

    // TODO: add v,r,s (signature from owner of id)
    function withdraw(uint64 amount, uint256 id) 
    public
    onlyOwnerId(id) 
    {    
        address addr = accounts[id].addr;
        uint64 balance = accounts[id].balance;

        require(addr != 0, "Id registration not completed. Use claimId() first");
        require(balance >= amount, "insufficient funds");
        require(amount > 0, "amount should be nonzero");

        require(msg.sender == addr, "only owner can withdraw");

        balance -= amount;
        accounts[id].balance = balance;

        token.transfer(addr, amount);        
    }

     // Q: is there a way to support delegates for deposit?
    function deposit(uint64 amount, uint256 id) public {
        require(id < accounts.length || id == newAccount, "invalid id");
        require(amount > 0, "amount should be positive");
        require(token.transferFrom(msg.sender, address(this), amount), "transfer failed");

        if (id == newAccount)      
        {   // new account
            uint newId = register();
            accounts[newId].balance = amount;
        } else {  
            // existing account
            uint64 balance = accounts[id].balance;
            uint64 newBalance = balance + amount;

            // checking for overflow
            require(balance <= newBalance, "arithmetic overflow"); 

            accounts[id].balance = newBalance;
       }
    }

    function transfer(
        uint32 fromId, 
        uint64 amount, 
        bytes payData, 
        uint newCount, 
        bytes32 roothash,
        bytes32 lock,
        bytes32 metadata) 
        public 
    {
        Payment memory p;
        p.from = fromId;
        p.amount = amount;
        p.lock = lock;
        p.timestamp = uint64(now);
        require(fromId < accounts.length, "invalid fromId");
        uint bytesPerId = uint(payData[1]);
        Account memory from = accounts[fromId];
    
        require(from.addr == msg.sender, "only owner of id can transfer");
        require((payData.length-2) % bytesPerId == 0, "payData length is invalid");

        p.totalCount = uint32((payData.length-2) / bytesPerId + newCount);
        require(p.totalCount < maxTransfer, "too many payees");
        
        uint64 total = uint64(amount * p.totalCount); // TODO: check for overflow
        require (total <= from.balance, "not enough funds");

        from.balance = from.balance - total;
        accounts[fromId] = from;

        p.minId = uint32(accounts.length);
        p.maxId = uint32(p.minId + newCount);
        p.metadata = metadata;
        require(p.maxId >= p.minId && p.maxId <= maxAccount, "invalid newCount");
        
        if (newCount > 0) bulkRegister(newCount, roothash);
        
        p.hash = keccak256(abi.encodePacked(payData));

        payments.push(p);
    }

    function unlock(uint32 payId, bytes32 key) public returns(bool) {
        require(payId < payments.length, "invalid payId");
        require(now < payments[payId].timestamp + unlockTime, "Hash lock expired");
        bytes32 h = keccak256(abi.encodePacked(key));
        if (h == payments[payId].hash)
        {
            payments[payId].hash = bytes32(0);
            return true;
        }
        return false;
    }

    function refund(uint payId) public returns (bool) {
        require(payId < payments.length, "invalid payment Id");
        require(payments[payId].hash != 0, "payment is already unlocked");
        require(now >= payments[payId].timestamp + unlockTime, "Hash lock has not expired yet");
        
        uint64 amount = payments[payId].amount;
        uint32 totalCount = payments[payId].totalCount;

        require(totalCount > 0, "payment already refunded");
        
        uint64 total = totalCount * amount;
        uint from = payments[payId].from;

        // Complete refund
        payments[payId].totalCount = 0;
        accounts[from].balance += total;
    }

    function recoverHelper(bytes32 hash, uint8 v, bytes32 r, bytes32 s) internal pure returns (address) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, hash));
        address addr = ecrecover(prefixedHash, v, r, s);

        return addr;
    }

    function _freeSlot(uint32 delegate, uint32 slot) internal returns(bool) {
        CollectSlot memory s = collects[delegate][slot];

        if (s.amount == 0) return true;
        require (now >= s.timestamp + challengeTime); // ???: Should we let him free this slot if it was successfully challenged?
        if (s.status == 0) {
            accounts[delegate].balance += s.amount + collectBond;
        }
        s.amount = 0;
        collects[delegate][slot] = s;
        return true;
    }

    function collect(
        uint32 delegate,
        uint32 slot,
        uint32 toId, 
        uint32 toPayId, 
        uint64 amount,
        uint8 v,
        bytes32 r,
        bytes32 s
        ) 
        public
        
    {
        Account memory acc = accounts[delegate];

        require(toId <= accounts.length, "toId must be a valid account id");
        Account memory tacc = accounts[toId];

        require(tacc.addr != 0, "account registration has to be completed");
        require(toPayId <= payments.length, "invalid toPayId");
        require(toPayId > tacc.collected, "toPayId is not a valid value");
        
        bytes32 hash = keccak256(abi.encodePacked(delegate, toId, tacc.collected, toPayId, amount)); // TODO: fee
        address addr = recoverHelper(hash, v, r, s);
        require(addr == tacc.addr, "Bad user signature");
       
       
        require(_freeSlot(delegate, slot), "slot is not available");

        tacc.balance += uint64(amount);
        require (acc.balance >= collectBond + amount, "not enough funds");
        acc.balance -= collectBond + amount;
        accounts[delegate] = acc;
   
        CollectSlot memory sl;
        sl.minPayId = tacc.collected;
        sl.maxPayId = toPayId;
        
        sl.amount = amount;
        sl.to = toId;
        sl.timestamp = uint64(now);
        sl.status = 0;
        collects[delegate][slot] = sl;
     
        tacc.collected = uint32(toPayId);
        accounts[toId] = tacc;
    }

    function balanceOf(uint id) public view validId(id) returns (uint64) {
        return accounts[id].balance;
    }

    function accountsLength() public view returns (uint) {
        return accounts.length;
    }

    function bulkLength() public view returns (uint) {
        return bulkRegistrations.length;
    }

}