pragma solidity ^0.4.24;
import "./IERC20.sol";
import "./SafeMath.sol";
import "./Merkle.sol";
import "./Data.sol";

contract Accounts is Data {
    event BulkRegister(uint n, uint minId, uint bulkId );
    event Register(uint id, address addr);

    IERC20 public token;
    Account[] public accounts;
    BulkRecord[] public bulkRegistrations;
 
    function isValidId(uint accountId) public view returns (bool) {
        return (accountId < accounts.length);
    }

    function isOwnerId(uint accountId) public view returns (bool) {
        return isValidId(accountId) && msg.sender == accounts[accountId].addr;
    }

    function isClaimedId(uint accountId) public view returns (bool) {
        return isValidId(accountId) && accounts[accountId].addr != 0;
    }

    modifier validId(uint accountId) {
        require(isValidId(accountId), "accountId is not valid");
        _;
    }

    modifier onlyOwnerId(uint accountId) {
        require(isOwnerId(accountId), "Only owner can invoke this method");
        _;
    }
    
    modifier claimedId(uint accountId) {
        require(isClaimedId(accountId), "account has no associated address");
        _;
    }


    /// @dev Reserve accounts but delay assigning addresses
    /// Accounts will be claimed later using MerkleTree's rootHash
    /// @param n Number of accounts to reserve
    /// @param rootHash Hash of the root node of the Merkle Tree referencing the list of addresses
   
    function bulkRegister(uint256 n, bytes32 rootHash) public {
        require(n > 0, "Cannot register 0 ids");
        require(n < params.maxBulk, "Cannot register this number of ids simultaneously");
        require(SafeMath.add(accounts.length, n) <= maxAccount, "Cannot register: ran out of ids");

        emit BulkRegister(n, accounts.length, bulkRegistrations.length);
        bulkRegistrations.push(BulkRecord(rootHash, uint32(n), uint32(accounts.length)));
        accounts.length += n;
    }

    /// @dev Complete registration for a reserved account by showing the bulkRegistration-id and Merkle proof associated with this address
    /// @param addr Address claiming this account
    /// @param proof Merkle proof for address and id
    /// @param accountId Id of the account to be registered.
    /// @param bulkId BulkRegistration id for the transaction reserving this account 
    
    function claimId(address addr, uint256[] memory proof, uint accountId, uint bulkId) public {
        require(bulkId < bulkRegistrations.length, "the bulkId referenced is invalid");
        uint minId = bulkRegistrations[bulkId].minId;
        uint n = bulkRegistrations[bulkId].n;
        bytes32 rootHash = bulkRegistrations[bulkId].rootHash;
        bytes32 hash = Merkle.evalProof(proof, accountId - minId, uint256(addr));
        
        require(accountId >= minId && accountId < minId+n, "the accountId specified is not part of that bulk registration slot");
        require(hash == rootHash, "invalid Merkle proof");
        emit Register(accountId, addr);

        accounts[accountId].addr = addr;
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

    /// @dev withdraw tokens from the batchpement contract into the original address
    /// @param amount Amount of tokens to withdraw
    /// @param accountId Id of the user requesting the withdraw. 

    function withdraw(uint64 amount, uint256 accountId)
    public
    onlyOwnerId(accountId)
    {
        address addr = accounts[accountId].addr;
        uint64 balance = accounts[accountId].balance;

        require(balance >= amount, "insufficient funds");
        require(amount > 0, "amount should be nonzero");
        
        balanceSub(accountId, amount);
        
        token.transfer(addr, amount);        
    }

    /// @dev Deposit tokens into the BatchPayment contract to enable scalable payments
    /// @param amount Amount of tokens to deposit on Account. User should have enough balance and issue an approve method prior to calling this.
    /// @param accountId The id of the user account -1 will register a new account and deposit the requested amount on a single operation.
   
    function deposit(uint64 amount, uint256 accountId) public {
        require(accountId < accounts.length || accountId == newAccount, "invalid accountId");
        require(amount > 0, "amount should be positive");
        require(token.transferFrom(msg.sender, address(this), amount), "transfer failed");

        if (accountId == newAccount)      
        {               // new account
            uint newId = register();
            accounts[newId].balance = amount;
        } else {        // existing account  
            balanceAdd(accountId, amount);
        }
    }

    /// @dev Increase the specified account balance by diff tokens.
    /// @param accountId account id, as returned by register, bulkRegister and deposit
    /// @param diff number of tokens
    
    function balanceAdd(uint accountId, uint64 diff) 
    internal
    validId(accountId) 
    {
        accounts[accountId].balance = SafeMath.add64(accounts[accountId].balance, diff);
    }

    /// @dev substract diff tokens from the specified account's balance
    /// @param accountId account id, as returned by register, bulkRegister and deposit
    /// @param diff number of tokens

    function balanceSub(uint accountId, uint64 diff) 
    internal
    validId(accountId)
    {
        accounts[accountId].balance = SafeMath.sub64(accounts[accountId].balance, diff);
    }

    /// @dev returns the balance associated with the account in tokens
    /// @param accountId account requested.

    function balanceOf(uint accountId)
    public view
    validId(accountId)
    returns (uint64) {
        return accounts[accountId].balance;
    }

    /// @dev gets number of accounts registered and reserved.
    /// @return returns the size of the accounts array.

    function getAccountsLength() public view returns (uint) {
        return accounts.length;
    }

    /// @dev gets the number of bulk registrations performed
    /// @return the size of the bulkRegistrations array.

    function getBulkLength() public view returns (uint) {
        return bulkRegistrations.length;
    }
}
