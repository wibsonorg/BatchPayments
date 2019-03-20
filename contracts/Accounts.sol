pragma solidity ^0.4.24;
import "./IERC20.sol";
import "./SafeMath.sol";
import "./Merkle.sol";
import "./Data.sol";

contract Accounts is Data {
    event BulkRegister(uint bulkSize, uint smallestAccountId, uint bulkId );
    event AccountRegistered(uint accountId, address accountAddress);

    IERC20 public token;
    Account[] public accounts;
    BulkRegistration[] public bulkRegistrations;
 
    function isValidId(uint accountId) public view returns (bool) {
        return (accountId < accounts.length);
    }

    function isAccountOwner(uint accountId) public view returns (bool) {
        return isValidId(accountId) && msg.sender == accounts[accountId].owner;
    }

    function isClaimedAccountId(uint accountId) public view returns (bool) {
        return isValidId(accountId) && accounts[accountId].owner != 0;
    }

    modifier validId(uint accountId) {
        require(isValidId(accountId), "accountId is not valid");
        _;
    }

    modifier onlyAccountOwner(uint accountId) {
        require(isAccountOwner(accountId), "Only account owner can invoke this method");
        _;
    }
    
    modifier claimedAccountId(uint accountId) {
        require(isClaimedAccountId(accountId), "account has no associated address");
        _;
    }


    /// @dev Reserve accounts but delay assigning addresses.
    /// Accounts will be claimed later using MerkleTree's rootHash.
    /// @param bulkSize Number of accounts to reserve.
    /// @param rootHash Hash of the root node of the Merkle Tree referencing the list of addresses.
   
    function bulkRegister(uint256 bulkSize, bytes32 rootHash) public {
        require(bulkSize > 0, "Bulk size can't be zero");
        require(bulkSize < params.maxBulk, "Cannot register this number of ids simultaneously");
        require(SafeMath.add(accounts.length, bulkSize) <= maxAccountId, "Cannot register: ran out of ids");

        emit BulkRegister(bulkSize, accounts.length, bulkRegistrations.length);
        bulkRegistrations.push(BulkRegistration(rootHash, uint32(bulkSize), uint32(accounts.length)));
        accounts.length += bulkSize;
    }

    /// @dev Complete registration for a reserved account by showing the bulkRegistration-id and Merkle proof associated with this address
    /// @param addr Address claiming this account
    /// @param proof Merkle proof for address and id
    /// @param accountId Id of the account to be registered.
    /// @param bulkId BulkRegistration id for the transaction reserving this account 
    
    function claimBulkRegistrationId(address addr, uint256[] memory proof, uint accountId, uint bulkId) public {
        require(bulkId < bulkRegistrations.length, "the bulkId referenced is invalid");
        uint minId = bulkRegistrations[bulkId].smallerRecordId;
        uint n = bulkRegistrations[bulkId].recordCount;
        bytes32 rootHash = bulkRegistrations[bulkId].rootHash;
        bytes32 hash = Merkle.evalProof(proof, accountId - minId, uint256(addr));
        
        require(accountId >= minId && accountId < minId+n, "the accountId specified is not part of that bulk registration slot");
        require(hash == rootHash, "invalid Merkle proof");
        emit AccountRegistered(accountId, addr);

        accounts[accountId].owner = addr;
    }

    /// @dev Register a new account
    /// @return the id of the new account
    function register() public returns (uint32 ret) {
        require(accounts.length < maxAccountId, "no more accounts left");
        ret = (uint32)(accounts.length);
        accounts.push(Account(msg.sender, 0, 0));
        emit AccountRegistered(ret, msg.sender);
        return ret;
    } 

    /// @dev withdraw tokens from the batchpement contract into the original address
    /// @param amount Amount of tokens to withdraw
    /// @param accountId Id of the user requesting the withdraw. 

    function withdraw(uint64 amount, uint256 accountId)
    public
    onlyAccountOwner(accountId)
    {
        address addr = accounts[accountId].owner;
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
        require(accountId < accounts.length || accountId == newAccountFlag, "invalid accountId");
        require(amount > 0, "amount should be positive");
        require(token.transferFrom(msg.sender, address(this), amount), "transfer failed");

        if (accountId == newAccountFlag)      
        {               // new account
            uint newId = register();
            accounts[newId].balance = amount;
        } else {        // existing account  
            balanceAdd(accountId, amount);
        }
    }

    /// @dev Increase the specified account balance by `amount` tokens.
    /// @param accountId account id, as returned by register, bulkRegister and deposit
    /// @param amount number of tokens

    function balanceAdd(uint accountId, uint64 amount) 
    internal
    validId(accountId) 
    {
        accounts[accountId].balance = SafeMath.add64(accounts[accountId].balance, amount);
    }

    /// @dev substract `amount` tokens from the specified account's balance
    /// @param accountId account id, as returned by register, bulkRegister and deposit
    /// @param amount number of tokens

    function balanceSub(uint accountId, uint64 amount) 
    internal
    validId(accountId)
    {
        accounts[accountId].balance = SafeMath.sub64(accounts[accountId].balance, amount);
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
