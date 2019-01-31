pragma solidity ^0.4.24;
import "./IERC20.sol";
import "./Merkle.sol";
import "./Challenge.sol";
import "./Account.sol";

contract BatPay {
    uint constant public maxAccount = 2**32-1;
    uint constant public maxBulk = 2**16;
    uint constant public newAccount = 2**256-1; // special account id. It's NOT in the range of accounts
    uint constant public maxBalance = 2**64-1;
    uint constant public maxTransfer = 100000;
    uint constant public unlockBlocks = 20; 
    uint constant public maxCollect = 1000;
    uint32 constant public instantSlot = 32768;
    uint constant public challengeBlocks = 300;     
    uint constant public challengeStepBlocks = 100;
    uint64 constant public collectStake = 100;
    uint64 constant public challengeStake = 100;


    event Transfer(uint payIndex, uint from, uint totalCount, uint amount);
    event Unlock(uint payIndex, bytes key);
    event Collect(uint delegate, uint slot, uint to, uint fromPayindex, uint toPayIndex, uint amount);
  

  
    struct Payment {
        uint32  from;
        uint64  amount;
        uint64  fee;
        uint32  minId;  // ???: Use BulkRecordId instead??
        uint32  maxId;
        uint32  totalCount;
        uint64  block;
        bytes32 hash;
        bytes32 lock;
        bytes32 metadata;
    }

    
    event BulkRegister(uint n, uint minId, uint bulkId );
    event Register(uint id, address addr);


    mapping (uint32 => mapping (uint32 => Challenge.CollectSlot)) collects;

    address public owner;
    IERC20 public token;
    Account.Record[] public accounts;
    Account.BulkRecord[] public bulkRegistrations;
    Payment[] public payments;

    function isValidId(uint id) public view returns (bool) {
        return (id < accounts.length);
    }

    // TODO: rename this function to something more meaningful
    function isOwnerId(uint id) public view returns (bool) {
        return isValidId(id) && msg.sender == accounts[id].addr;
    }

    function isClaimedId(uint id) public view returns (bool) {
        return isValidId(id) && accounts[id].addr != 0;
    }

    modifier validId(uint id) {
        require(isValidId(id), "id is not valid");
        _;
    }

    modifier onlyOwnerId(uint id) {
        require(isOwnerId(id), "Only owner can invoke this method");
        _;
    }
    
    modifier claimedId(uint id) {
        require(isClaimedId(id), "account has no associated address");
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

        emit BulkRegister(n, accounts.length, bulkRegistrations.length);
        bulkRegistrations.push(Account.BulkRecord(rootHash, uint32(n), uint32(accounts.length)));
        accounts.length += n;
        
    }

    function claimId(address addr, uint256[] proof, uint id, uint bulkId) public {
        require(bulkId < bulkRegistrations.length, "the bulkId referenced is invalid");
        uint minId = bulkRegistrations[bulkId].minId;
        uint n = bulkRegistrations[bulkId].n;
        bytes32 rootHash = bulkRegistrations[bulkId].rootHash;

        bytes32 hash = Merkle.evalProof(proof, id - minId, uint256(addr));
        
        require(id >= minId && id < minId+n, "the id specified is not part of that bulk registration slot");
        require(hash == rootHash, "invalid Merkle proof");
        emit Register(id, addr);

        accounts[id].addr = addr;
    }

    // Register a new account
 
    function register() public returns (uint32 ret) {
        require(accounts.length < maxAccount, "no more accounts left");
        ret = (uint32)(accounts.length);
        accounts.length += 1;
        accounts[ret].addr = msg.sender;
        emit Register(ret, msg.sender);
        return ret;
    } 

/*
    function withdrawTo(
        uint32 delegate,
        uint32 id,  
        uint64 amount, 
        uint64 fee,
        address destination,
        bytes signature) 
        public 
        onlyOwnerId(delegate) 
        claimedId(id)
    {
        bytes32 hash = keccak256(abi.encodePacked(delegate, id, amount, fee, destination));
        
        require(recoverHelper(hash, signature) == accounts[id].addr, "invalid signature");
        require(accounts[id].balance >= amount, "not enough founds");
        require(fee <= amount, "invalid fee");

        accounts[id].balance -= amount;
        accounts[delegate].balance += fee;
        token.transfer(destination, amount - fee);
    }

*/
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
        uint64 fee,
        bytes payData, 
        uint newCount, // futo: what is the purpose of this parameter? maybe put a more meaningful name
        bytes32 roothash,
        bytes32 lock,
        bytes32 metadata) 
        public 
    {
        Payment memory p;
        p.from = fromId;
        p.amount = amount;
        p.fee = fee;
        p.lock = lock;
        p.block = uint64(block.number + unlockBlocks);

        require(isValidId(fromId), "invalid fromId");
        uint bytesPerId = uint(payData[1]);
        Account.Record memory from = accounts[fromId];
    
        require(bytesPerId > 0, "bytes per Id should be positive");
        require(from.addr == msg.sender, "only owner of id can transfer");
        require((payData.length-2) % bytesPerId == 0, "payData length is invalid");

        p.totalCount = uint32((payData.length-2) / bytesPerId + newCount);
        require(p.totalCount < maxTransfer, "too many payees");
        
        uint64 total = uint64(amount * p.totalCount) + fee; // TODO: check for overflow
        require (total <= from.balance, "not enough funds");

        from.balance = from.balance - total;
        accounts[fromId] = from;

        p.minId = uint32(accounts.length);
        p.maxId = uint32(p.minId + newCount);
        p.metadata = metadata;
        require(p.maxId >= p.minId && p.maxId <= maxAccount, "invalid newCount");
        
        if (newCount > 0) {
            bulkRegister(newCount, roothash);
        }
        
        p.hash = keccak256(abi.encodePacked(payData));
        payments.push(p);
  
        emit Transfer(payments.length-1, p.from, p.totalCount, p.amount);
    }

    function unlock(uint32 payIndex, uint32 unlockerId, bytes key) public returns(bool) {
        require(payIndex < payments.length, "invalid payIndex");
        require(isValidId(unlockerId), "Invalid unlockerId");
        require(block.number < payments[payIndex].block, "Hash lock expired");
        bytes32 h = keccak256(abi.encodePacked(unlockerId, key));
        require(h == payments[payIndex].lock, "Invalid key");
        
        payments[payIndex].lock = bytes32(0);
        accounts[unlockerId].balance += payments[payIndex].fee;

        emit Unlock(payIndex, key);
        return true;
    }

    function refund(uint payIndex) public returns (bool) {
        require(payIndex < payments.length, "invalid payment Id");
        require(payments[payIndex].lock != 0, "payment is already unlocked");
        require(block.number >= payments[payIndex].block, "Hash lock has not expired yet");
        
        uint64 amount = payments[payIndex].amount;
        uint32 totalCount = payments[payIndex].totalCount;
        uint64 fee = payments[payIndex].fee;

        require(totalCount > 0, "payment already refunded");
        
        uint64 total = totalCount * amount + fee;
        uint from = payments[payIndex].from;

        // Complete refund
        payments[payIndex].totalCount = 0;
        payments[payIndex].fee = 0;
        accounts[from].balance += total;
    }




   
    function recoverHelper(bytes32 hash, bytes _sig) internal pure returns (address) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, hash));

        bytes32 r;
        bytes32 s;
        uint8 v;

        // Check the signature length
        if (_sig.length != 65) {
            return (address(0));
        }

        // Divide the signature in r, s and v variables
        // ecrecover takes the signature parameters, and the only way to get them
        // currently is to use assembly.
        // solium-disable-next-line security/no-inline-assembly
        assembly {
        r := mload(add(_sig, 32))
        s := mload(add(_sig, 64))
        v := byte(0, mload(add(_sig, 96)))
        }

        // Version of signature should be 27 or 28, but 0 and 1 are also possible versions
        if (v < 27) {
            v += 27;
        }

        // If the version is correct return the signer address
        if (v != 27 && v != 28) {
            return address(0);
        }

        return ecrecover(prefixedHash, v, r, s);
        
    }

    function freeSlot(uint32 delegate, uint32 slot) public {
        require(isOwnerId(delegate), "only delegate can call");

        Challenge.CollectSlot memory s = collects[delegate][slot];

        if (s.status == 0) return;

        require (s.status == 1 && block.number >= s.block, "slot not available"); 
    
        // Refund Stake 
        accounts[delegate].balance += s.delegateAmount + collectStake;
        uint64 balance = accounts[s.to].balance + s.amount - s.delegateAmount;

        if (s.addr != address(0)) {
            token.transfer(s.addr, balance);
            balance = 0;
        } 
        accounts[s.to].balance = balance;
        s.status = 0;
        collects[delegate][slot] = s;
    }
    
    function collect(
        uint32 delegate,
        uint32 slot,
        uint32 to, 
        uint32 payIndex,
        uint64 amount,
        uint64 fee, 
        address destination,
        bytes signature
        ) 
        public
        
    {
        // Check delegate is valid
        require(delegate < accounts.length, "delegate must be a valid account id");
        Account.Record memory acc = accounts[delegate];
        require(acc.addr != 0, "account registration has be to completed for delegate");
        require(acc.addr == msg.sender, "only delegate can initiate collect");
        
        // Check to is valid
        require(to <= accounts.length, "to must be a valid account id");

        Account.Record memory tacc = accounts[to];
        require(tacc.addr != 0, "account registration has to be completed");

        // Check payIndex is valid
        require(payIndex > 0 && payIndex <= payments.length, "invalid payIndex");
        require(payIndex > tacc.collected, "payIndex is not a valid value");
        require(payments[payIndex-1].block < block.number, "cannot collect payments that can be unlocked");

        // Check if fee is valid
        require (fee <= amount, "fee is too big");

        Challenge.CollectSlot memory sl;
     
        sl.delegate = delegate;
        // Check that "to" signed this transaction
        bytes32 hash = keccak256(abi.encodePacked(delegate, to, tacc.collected, payIndex, amount, fee, destination)); 
        require(recoverHelper(hash, signature) == tacc.addr, "Bad user signature");
        
        // free slot if necessary
        freeSlot(delegate, slot);
        
        sl.minPayIndex = tacc.collected;
        sl.maxPayIndex = payIndex;

        uint64 needed = collectStake;
        // check if this is an instant collect
        if (slot >= instantSlot) {
            sl.delegateAmount = amount;
            tacc.balance += uint64(amount-fee);

            // check if the user is withdrawing its balance
            if (destination != address(0)) {
                token.transfer(destination, tacc.balance);
                tacc.balance = 0;
            }

            sl.addr = address(0);
            needed += amount-fee;
        } else
        {
            sl.addr = destination;
            sl.delegateAmount = fee;
        }    

        // Check amount & balance
        require (acc.balance >= needed, "not enough funds");

        acc.balance -= needed;
        accounts[delegate] = acc;
        
        sl.amount = amount;
        sl.to = to;
        sl.block = uint64(block.number + challengeBlocks);
        sl.status = 1;
        collects[delegate][slot] = sl;
     
        
        tacc.collected = uint32(payIndex);
        accounts[to] = tacc;
    }

    function accountOf(uint id) public view validId(id) returns (address addr, uint64 balance, uint32 collected) {
        Account.Record memory a = accounts[id];
        addr = a.addr;
        balance = a.balance;
        collected = a.collected;

        // futo: are we missing a return here?
    }

    function balanceOf(uint id) public view validId(id) returns (uint64) {
        return accounts[id].balance;
    }

    function accountsLength() public view returns (uint) {
        return accounts.length;
    }

    function paymentsLength() public view returns (uint) {
        return payments.length;
    }

    function bulkLength() public view returns (uint) {
        return bulkRegistrations.length;
    }

}