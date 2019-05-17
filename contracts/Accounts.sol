pragma solidity 0.5.7;

import "./IERC20.sol";
import "./SafeMath.sol";
import "./Merkle.sol";
import "./Data.sol";

/**
  * @title Accounts, methods to manage accounts and balances
  */

contract Accounts is Data {
    event BulkRegister(uint bulkSize, uint smallestAccountId, uint bulkId );
    event AccountRegistered(uint accountId, address accountAddress);

    IERC20 public token;
    Account[] public accounts;
    BulkRegistration[] public bulkRegistrations;

    /**
      * @dev determines whether accountId is valid
      * @param accountId an account id
      * @return boolean
      */
    function isValidId(uint accountId) public view returns (bool) {
        return (accountId < accounts.length);
    }

    /**
      * @dev determines whether accountId is the owner of the account
      * @param accountId an account id
      * @return boolean
      */
    function isAccountOwner(uint accountId) public view returns (bool) {
        return isValidId(accountId) && msg.sender == accounts[accountId].owner;
    }

    /**
      * @dev modifier to restrict that accountId is valid
      * @param accountId an account id
      */
    modifier validId(uint accountId) {
        require(isValidId(accountId), "accountId is not valid");
        _;
    }

    /**
      * @dev modifier to restrict that accountId is owner
      * @param accountId an account ID
      */
    modifier onlyAccountOwner(uint accountId) {
        require(isAccountOwner(accountId), "Only account owner can invoke this method");
        _;
    }

    /**
      * @dev Reserve accounts but delay assigning addresses.
      *      Accounts will be claimed later using MerkleTree's rootHash.
      * @param bulkSize Number of accounts to reserve.
      * @param rootHash Hash of the root node of the Merkle Tree referencing the list of addresses.
      */
    function bulkRegister(uint256 bulkSize, bytes32 rootHash) public {
        require(bulkSize > 0, "Bulk size can't be zero");
        require(bulkSize < params.maxBulk, "Cannot register this number of ids simultaneously");
        require(SafeMath.add(accounts.length, bulkSize) <= MAX_ACCOUNT_ID, "Cannot register: ran out of ids");
        require(rootHash > 0, "Root hash can't be zero");

        emit BulkRegister(bulkSize, accounts.length, bulkRegistrations.length);
        bulkRegistrations.push(BulkRegistration(rootHash, uint32(bulkSize), uint32(accounts.length)));
        accounts.length = SafeMath.add(accounts.length, bulkSize);
    }

    /** @dev Complete registration for a reserved account by showing the
      *     bulkRegistration-id and Merkle proof associated with this address
      * @param addr Address claiming this account
      * @param proof Merkle proof for address and id
      * @param accountId Id of the account to be registered.
      * @param bulkId BulkRegistration id for the transaction reserving this account
      */
    function claimBulkRegistrationId(address addr, bytes32[] memory proof, uint accountId, uint bulkId) public {
        require(bulkId < bulkRegistrations.length, "the bulkId referenced is invalid");
        uint smallestAccountId = bulkRegistrations[bulkId].smallestRecordId;
        uint n = bulkRegistrations[bulkId].recordCount;
        bytes32 rootHash = bulkRegistrations[bulkId].rootHash;
        bytes32 hash = Merkle.getProofRootHash(proof, SafeMath.sub(accountId, smallestAccountId), bytes32(uint256(uint160(addr))));

        require(accountId >= smallestAccountId && accountId < smallestAccountId + n,
            "the accountId specified is not part of that bulk registration slot");
        require(hash == rootHash, "invalid Merkle proof");
        emit AccountRegistered(accountId, addr);

        accounts[accountId].owner = addr;
    }

    /**
      * @dev Register a new account
      * @return the id of the new account
      */
    function register() public returns (uint32 ret) {
        require(accounts.length < MAX_ACCOUNT_ID, "no more accounts left");
        ret = (uint32)(accounts.length);
        accounts.push(Account(msg.sender, 0, 0));
        emit AccountRegistered(ret, msg.sender);
        return ret;
    }

    /**
     * @dev withdraw tokens from the BatchPayment contract into the original address.
     * @param amount Amount of tokens to withdraw.
     * @param accountId Id of the user requesting the withdraw.
     */
    function withdraw(uint64 amount, uint256 accountId)
        external
        onlyAccountOwner(accountId)
    {
        uint64 balance = accounts[accountId].balance;

        require(balance >= amount, "insufficient funds");
        require(amount > 0, "amount should be nonzero");

        balanceSub(accountId, amount);

        require(token.transfer(msg.sender, amount), "transfer failed");
    }

    /**
     * @dev Deposit tokens into the BatchPayment contract to enable scalable payments
     * @param amount Amount of tokens to deposit on `accountId`. User should have
     *        enough balance and issue an `approve()` method prior to calling this.
     * @param accountId The id of the user account. In case `NEW_ACCOUNT_FLAG` is used,
     *        a new account will be registered and the requested amount will be
     *        deposited in a single operation.
     */
    function deposit(uint64 amount, uint256 accountId) external {
        require(accountId < accounts.length || accountId == NEW_ACCOUNT_FLAG, "invalid accountId");
        require(amount > 0, "amount should be positive");

        if (accountId == NEW_ACCOUNT_FLAG) {
            // new account
            uint newId = register();
            accounts[newId].balance = amount;
        } else {
            // existing account
            balanceAdd(accountId, amount);
        }

        require(token.transferFrom(msg.sender, address(this), amount), "transfer failed");
    }

    /**
     * @dev Increase the specified account balance by `amount` tokens.
     * @param accountId An account id
     * @param amount number of tokens
     */
    function balanceAdd(uint accountId, uint64 amount)
    internal
    validId(accountId)
    {
        accounts[accountId].balance = SafeMath.add64(accounts[accountId].balance, amount);
    }

    /**
     *  @dev Substract `amount` tokens from the specified account's balance
     *  @param accountId An account id
     *  @param amount number of tokens
     */
    function balanceSub(uint accountId, uint64 amount)
    internal
    validId(accountId)
    {
        uint64 balance = accounts[accountId].balance;
        require(balance >= amount, "not enough funds");
        accounts[accountId].balance = SafeMath.sub64(balance, amount);
    }

    /**
     *  @dev returns the balance associated with the account in tokens
     *  @param accountId account requested.
     */
    function balanceOf(uint accountId)
        external
        view
        validId(accountId)
        returns (uint64)
    {
        return accounts[accountId].balance;
    }

    /**
      * @dev gets number of accounts registered and reserved.
      * @return returns the size of the accounts array.
      */
    function getAccountsLength() external view returns (uint) {
        return accounts.length;
    }

    /**
      * @dev gets the number of bulk registrations performed
      * @return the size of the bulkRegistrations array.
      */
    function getBulkLength() external view returns (uint) {
        return bulkRegistrations.length;
    }
}
