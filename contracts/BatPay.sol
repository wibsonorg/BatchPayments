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
    uint constant public challengeStep = 30 minutes;
    uint constant public maxCollect = 1000;
    uint64 constant public collectBond = 100;
    uint64 constant public challengeBond = 100;

    struct Account {
        address addr;
        uint64  balance;
        uint32  collected;
    }

    struct Payment {
        uint32  from;
        uint64  amount;
        uint64  fee;
        uint32  minId;  // ???: Use BulkRecordId instead??
        uint32  maxId;
        uint32  totalCount;
        uint64  timestamp;
        bytes32 hash;
        bytes32 lock;
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
        uint32  challenger;
        uint32  index;
        uint64  challengeAmount;
        bytes32 data;
    }

    mapping (uint32 => mapping (uint32 => CollectSlot)) collects;

    address public owner;
    IERC20 public token;
    Account[] public accounts;
    BulkRecord[] public bulkRegistrations;
    Payment[] public payments;

    function isValidId(uint id) public view returns (bool) {
        return (id < accounts.length);
    }

    // TODO: rename this function to something more meaningful
    function isOwnerId(uint id) public view returns (bool) {
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
        uint newCount, 
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
        p.timestamp = uint64(now);
        require(fromId < accounts.length, "invalid fromId");
        uint bytesPerId = uint(payData[1]);
        Account memory from = accounts[fromId];
    
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
        
        if (newCount > 0) bulkRegister(newCount, roothash);
        
        p.hash = keccak256(abi.encodePacked(payData));

        payments.push(p);
    }

    function unlock(uint32 payId, uint32 unlockerId, bytes key) public returns(bool) {
        require(payId < payments.length, "invalid payId");
        require(isValidId(unlockerId), "Invalid unlockerId");
        require(now < payments[payId].timestamp + unlockTime, "Hash lock expired");
        bytes32 h = keccak256(abi.encodePacked(unlockerId, key));
        require(h == payments[payId].lock, "Invalid key");
        
        payments[payId].lock = bytes32(0);
        accounts[unlockerId].balance += payments[payId].fee;

        return true;
    }

    function refund(uint payId) public returns (bool) {
        require(payId < payments.length, "invalid payment Id");
        require(payments[payId].lock != 0, "payment is already unlocked");
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

    
    

    function getDataSum(bytes data) public pure returns (uint sum) {
        uint n = data.length / 12;
        uint modulus = maxBalance+1;

        sum = 0;

        // Get the sum of the stated amounts in data 
        // Each entry in data is [8-bytes amount][4-bytes payId]

        for(uint i = 0; i<n; i++) {
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                sum :=
                    add(
                        sum, 
                        mod(
                            mload(add(data, add(8, mul(i, 12)))), 
                            modulus)
                    )
            }
        }
    }

    function getDataAtIndex(bytes data, uint index) public pure returns (uint64 amount, uint32 payId) {
        uint mod1 = maxBalance+1;
        uint mod2 = maxAccount+1;
        uint i = index*12;

        require(i <= data.length-12);

        // solium-disable-next-line security/no-inline-assembly
        assembly
            {
                amount := mod(
                    mload(add(data, add(8, i))), 
                    mod1)           

                 payId := mod(
                    mload(add(data, add(12, i))),
                    mod2)
            }
    }


    function challenge_1(uint32 delegate, uint32 slot, uint32 challenger) public {
        require(isValidId(delegate), "delegate must be a valid account id");
        require(accounts[challenger].balance >= challengeBond, "not enough balance");

        CollectSlot memory s = collects[delegate][slot];
 
        require(s.status == 1, "slot is not available for challenge");      
        require (now <= s.timestamp + challengeTime, "challenge time has passed");
        s.status = 2;
        s.challenger = challenger;
        s.timestamp = uint64(now);

        accounts[challenger].balance -= challengeBond;

        collects[delegate][slot] = s;
    }

    function challenge_2(uint32 delegate, uint32 slot, bytes data) public {
        require(isOwnerId(delegate), "only delegate can call challenge_1");

        CollectSlot memory s = collects[delegate][slot];

        require(s.status == 2, "wrong slot status");
        require (now <= s.timestamp + challengeStep, "challenge time has passed");

        require(data.length % 12 == 0, "wrong data format");
        require (getDataSum(data) == s.amount, "data doesn't represent collected amount");

        s.data = keccak256(data);
        s.status = 3;
        s.timestamp = uint64(now);

        collects[delegate][slot] = s;
    }


    function challenge_3(uint32 delegate, uint32 slot, bytes data, uint32 index) public {
        require(isValidId(delegate), "delegate should be a valid id");
        CollectSlot memory s = collects[delegate][slot];
        
        require(s.status == 3);
        require (now <= s.timestamp + challengeStep, "challenge time has passed");
        require(isOwnerId(s.challenger), "only challenger can call challenge_2");
     
        
        require(s.data == keccak256(data), "data mismatch");
       
        s.index = index;
        s.status = 4;
        s.timestamp = uint64(now);

        collects[delegate][slot] = s;
    }

    function challenge_4(uint32 delegate, uint32 slot, bytes payData) public {
        require(isOwnerId(delegate), "only delegate can call challenge_3");

        CollectSlot memory s = collects[delegate][slot];
        Payment memory p = payments[s.index];

        require(s.status == 4);
        require(now <= s.timestamp + challengeStep, "challenge time has passed");
        require(s.index >= s.minPayId && s.index < s.maxPayId, "payment referenced is out of range");

        require(keccak256(payData) == p.hash, "payData is incorrect");
        
        uint bytesPerId = uint(payData[1]);
        uint modulus = 1 << (8*bytesPerId);

        uint id = 0;
        uint collected = 0;

        // Check if id is included in bulkRegistration within payment
        if (s.to >= p.minId && s.to < p.maxId) collected += p.amount;

        // Process payData, inspecting the list of ids
        // payData includes 2 header bytes, followed by n bytesPerId-bytes entries
        // [byte 0xff][byte bytesPerId][delta 0][delta 1]..[delta n-1]
        for(uint i = 2; i < payData.length; i += bytesPerId) {
            // Get next id delta from paydata 
            // id += payData[2+i*bytesPerId]

            // solium-disable-next-line security/no-inline-assembly
            assembly {
                id := add(
                    id, 
                    mod(
                        mload(add(payData,add(i,bytesPerId))),
                        modulus))
            }
            if (id == s.to) {
                collected += p.amount;
            }
        }

        require(collected == s.challengeAmount, "amount mismatch");

        s.status = 5;
        collects[delegate][slot] = s;

        challenge_failed(delegate, slot);
        
    }

    function challenge_success(uint32 delegate, uint32 slot) public {
        CollectSlot memory s = collects[delegate][slot];
        require((s.status == 2 || s.status == 4) && now > s.timestamp + challengeStep, "challenge not finished");

        accounts[s.challenger].balance += collectBond;

        collects[delegate][slot].status = 0;
        
    }

    function challenge_failed(uint32 delegate, uint32 slot) public {
        CollectSlot memory s = collects[delegate][slot];
        require(s.status == 5 || s.status == 3 && now > s.timestamp + challengeStep, "challenge not completed");

        // Challenge failed
        // delegate wins bond
        accounts[delegate].balance += challengeBond;

        // reset slot to status=1, waiting for challenges
        s.challenger = 0;
        s.status = 1;
        s.timestamp = uint64(now);
        collects[delegate][slot] = s;
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

        CollectSlot memory s = collects[delegate][slot];

        if (s.status == 0) return;

        require (s.status == 1 && now >= s.timestamp + challengeTime, "slot not available"); 
    
        // Refund bond 
        accounts[delegate].balance += s.amount + collectBond;
        
        s.status = 0;
        collects[delegate][slot] = s;
    }
    
    function collect(
        uint32 delegate,
        uint32 slot,
        uint32 toId, 
        uint32 toPayId, 
        uint64 amount,
        bytes signature
        ) 
        public
        
    {
        // Check delegate is valid
        require(delegate < accounts.length, "delegate must be a valid account id");
        Account memory acc = accounts[delegate];
        require(acc.addr != 0, "account registration has be to completed for delegate");
        require(acc.addr == msg.sender, "only delegate can initiate collect");
        
        // Check toId is valid
        require(toId <= accounts.length, "toId must be a valid account id");
        Account memory tacc = accounts[toId];
        require(tacc.addr != 0, "account registration has to be completed");

        // Check toPayId is valid
        require(toPayId <= payments.length, "invalid toPayId");
        require(toPayId > tacc.collected, "toPayId is not a valid value");
        
        // Check that toId signed this transaction
        bytes32 hash = keccak256(abi.encodePacked(delegate, toId, tacc.collected, toPayId, amount)); // TODO: fee
        address addr = recoverHelper(hash, signature);
        require(addr == tacc.addr, "Bad user signature");
       
        // free slot if necessary
        freeSlot(delegate, slot);

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

    function accountOf(uint id) public view validId(id) returns (address addr, uint64 balance, uint32 collected) {
        Account memory a = accounts[id];
        addr = a.addr;
        balance = a.balance;
        collected = a.collected;
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