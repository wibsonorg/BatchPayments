pragma solidity ^0.4.24;
import "./IERC20.sol";
import "./SafeMath.sol";
import "./Merkle.sol";

contract Accounts {
    uint public constant maxAccount = 2**32-1;      // Maximum account id (32-bits)
    uint public constant newAccount = 2**256-1;     // Request registration of new account
 
    uint public maxBulk  = 2**16;          // Maximum number of accounts that can be reserved simultaneously
    uint public maxBalance = 2**64-1;      // Maximum supported token balance
    uint public maxTransfer = 100000;      // Maximum number of destination accounts per transfer
 
    event BulkRegister(uint n, uint minId, uint bulkId );
    event Register(uint id, address addr);

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

    IERC20 public token;
    Account[] public accounts;
    BulkRecord[] public bulkRegistrations;
    Payment[] public payments;
 
    function isValidId(uint id) public view returns (bool) {
        return (id < accounts.length);
    }

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

 /// @dev Reserve accounts but delay assigning addresses
    /// Accounts will be claimed later using MerkleTree's rootHash
    /// @param n Number of accounts to reserve
    /// @param rootHash Hash of the root node of the Merkle Tree referencing the list of addresses
   
    function bulkRegister(uint256 n, bytes32 rootHash) public {
        require(n > 0, "Cannot register 0 ids");
        require(n < maxBulk, "Cannot register this number of ids simultaneously");
        require(SafeMath.add(accounts.length, n) <= maxAccount, "Cannot register: ran out of ids");

        emit BulkRegister(n, accounts.length, bulkRegistrations.length);
        bulkRegistrations.push(BulkRecord(rootHash, uint32(n), uint32(accounts.length)));
        accounts.length += n;
    }

    /// @dev Complete registration for a reserved account by showing the bulkRegistration-id and Merkle proof associated with this address
    /// @param addr Address claiming this account
    /// @param proof Merkle proof for address and id
    /// @param bulkId BulkRegistration id for the transaction reserving this account 
    
    function claimId(address addr, uint256[] memory proof, uint id, uint bulkId) public {
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

    /// @dev Register a new account
    /// @return the id of the new account
    function register() public returns (uint32 ret) {
        require(accounts.length < maxAccount, "no more accounts left");
        ret = (uint32)(accounts.length);
        accounts.push(Account(msg.sender, 0, 0));
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

    /// @dev withdraw tokens from the batchpement contract into the original address
    /// @param amount Amount of tokens to withdraw
    /// @param id Id of the user requesting the withdraw. 

    function withdraw(uint64 amount, uint256 id) 
    public
    onlyOwnerId(id) 
    {    
        address addr = accounts[id].addr;
        uint64 balance = accounts[id].balance;

        require(balance >= amount, "insufficient funds");
        require(amount > 0, "amount should be nonzero");
        
        balanceSub(id, amount);
        
        token.transfer(addr, amount);        
    }

    /// @dev Deposit tokens into the BatchPayment contract to enable scalable payments
    /// @param amount Amount of tokens to deposit on Account. User should have enough balance and issue an approve method prior to calling this.
    /// @param id The id of the user account -1 will register a new account and deposit the requested amount on a single operation.
   
    function deposit(uint64 amount, uint256 id) public {
        require(id < accounts.length || id == newAccount, "invalid id");
        require(amount > 0, "amount should be positive");
        require(token.transferFrom(msg.sender, address(this), amount), "transfer failed");

        if (id == newAccount)      
        {               // new account
            uint newId = register();
            accounts[newId].balance = amount;
        } else {        // existing account  
            balanceAdd(id, amount);
        }
    }

    /// @dev Increase the specified account balance by diff tokens.
    /// @param id account id, as returned by register, bulkRegister and deposit
    /// @param diff number of tokens
    
    function balanceAdd(uint id, uint64 diff) 
    internal
    validId(id) 
    {
        accounts[id].balance = SafeMath.add64(accounts[id].balance, diff);
    }

    /// @dev substract diff tokens from the specified account's balance
    /// @param id account id, as returned by register, bulkRegister and deposit
    /// @param diff number of tokens

    function balanceSub(uint id, uint64 diff) 
    internal
    validId(id) 
    {
        accounts[id].balance = SafeMath.sub64(accounts[id].balance, diff);
    }

    /// @dev returns the balance associated with the account in tokens
    /// @param id account requested.

    function balanceOf(uint id) 
    public view 
    validId(id) 
    returns (uint64) {
        return accounts[id].balance;
    }

    /// @dev gets number of accounts registered and reserved.
    /// @return returns the size of the accounts array.

    function accountsLength() public view returns (uint) {
        return accounts.length;
    }


}
