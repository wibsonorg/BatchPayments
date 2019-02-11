pragma solidity ^0.4.24;
import "./IERC20.sol";
import "./Merkle.sol";
import "./Challenge.sol";
import "./Account.sol";
import "./SafeMath.sol";

/// @title BatchPayment processing
/// @notice This contract allows to scale ERC-20 token transfer for fees or micropayments
/// on the few buyers - many sellers setting.


contract BatPay {

    /*
     * Constants
     */
    uint constant public maxAccount = 2**32-1;      // Maximum account id (32-bits)
    uint constant public maxBulk = 2**16;           // Maximum number of accounts that can be reserved simultaneously
    uint constant public newAccount = 2**256-1;     // Request registration of new account
    uint constant public maxBalance = 2**64-1;      // Maximum supported token balance
    uint constant public maxTransfer = 100000;      // Maximum number of destination accounts per transfer
    uint constant public unlockBlocks = 20;         // Number of blocks the contract waits for unlock
    uint32 constant public instantSlot = 32768;     // Slots reserved for Instant collect&withdraw for user
    uint constant public challengeBlocks = 300;     // Number of blocks the contracts waits for a challenge
    uint constant public challengeStepBlocks = 100; // Number of blocks the contract waits for each individual challenge step
    uint64 constant public collectStake = 100;      // Collect/delegate stake in tokens  
    uint64 constant public challengeStake = 100;    // Challenger stake in tokens.

    event Transfer(uint payIndex, uint from, uint totalCount, uint amount);
    event Unlock(uint payIndex, bytes key);
    event Collect(uint delegate, uint slot, uint to, uint fromPayindex, uint toPayIndex, uint amount);
    event BulkRegister(uint n, uint minId, uint bulkId );
    event Register(uint id, address addr);
    event Challenge_1(uint delegate, uint slot, uint challenger);
    event Challenge_2(uint delegate, uint slot);
    event Challenge_3(uint delegate, uint slot, uint index);
    event Challenge_4(uint delegate, uint slot);
    event Challenge_success(uint delegate, uint slot);
    event Challenge_failed(uint delegate, uint slot);  

    mapping (uint32 => mapping (uint32 => Challenge.CollectSlot)) public collects;

    address public owner;
    IERC20 public token;
    Account.Record[] public accounts;
    Account.BulkRecord[] public bulkRegistrations;
    Challenge.Payment[] public payments;

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

    /*
     * Public functions
     */

    /// @dev Contract constructor, sets ERC20 token this contract will use for payments
    /// @param _token ERC20 contract address
    constructor(address _token) public {
        owner = msg.sender;
        token = IERC20(_token);
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
        bulkRegistrations.push(Account.BulkRecord(rootHash, uint32(n), uint32(accounts.length)));
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
        accounts.push(Account.Record(msg.sender, 0, 0));
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
    /// @param amount Amount of tokens to deposit on account. User should have enough balance and issue an approve method prior to calling this.
    /// @param id The id of the user account. -1 will register a new account and deposit the requested amount on a single operation.
   
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

    /// @dev Transfer tokens to multiple recipients
    /// @param fromId account id for the originator of the transaction
    /// @param amount amount of tokens to pay each destination. 
    /// @param fee Fee in tokens to be payed to the party providing the unlocking service
    /// @param payData efficient representation of the destination account list
    /// @param newCount number of new destination accounts that will be reserved during the transfer transaction 
    /// @param rootHash Hash of the root hash of the Merkle tree listing the addresses reserved.
    /// @param lock hash of the key locking this payment to help in atomic data swaps.  
    /// @param metadata Application specific data to be stored associated with the payment
    
    function transfer(
        uint32 fromId, 
        uint64 amount, 
        uint64 fee,
        bytes memory payData, 
        uint newCount,      //  # of new Users included on bulkRegistration
        bytes32 rootHash,
        bytes32 lock,
        bytes32 metadata) 
        public 
    {
        Challenge.Payment memory p;
        p.from = fromId;
        p.amount = amount;
        p.fee = fee;
        p.lock = lock;
        p.block = SafeMath.add64(block.number,unlockBlocks);

        require(isValidId(fromId), "invalid fromId");
        uint len = payData.length;
        require(len > 1, "payData length is invalid");
        uint bytesPerId = uint(payData[1]);
        Account.Record memory from = accounts[fromId];
        
        require(bytesPerId > 0, "bytes per Id should be positive");
        require(from.addr == msg.sender, "only owner of id can transfer");
        require((len-2) % bytesPerId == 0, "payData length is invalid");

        p.totalCount = SafeMath.div32(len-2, SafeMath.add32(bytesPerId,newCount));
        require(p.totalCount < maxTransfer, "too many payees");
        
        uint64 total = SafeMath.add64(SafeMath.mul64(amount, p.totalCount), fee); 
        require (total <= from.balance, "not enough funds");

        from.balance = SafeMath.sub64(from.balance, total);
        accounts[fromId] = from;

        p.minId = uint32(accounts.length);
        p.maxId = SafeMath.add32(p.minId, newCount); 
        if (newCount > 0) {
            bulkRegister(newCount, rootHash);
        }

        p.metadata = metadata; 
        p.hash = keccak256(abi.encodePacked(payData));

        payments.push(p);
  
        emit Transfer(payments.length-1, p.from, p.totalCount, p.amount);
    }

    /// @dev provide the required key, releasing the payment and enabling the buyer decryption the digital content
    /// @param payIndex payment Index associated with the transfer operation.
    /// @param unlockerId id of the party providing the unlocking service. Fees wil be payed to this id
    /// @param key Cryptographic key used to encrypt traded data
   
    function unlock(uint32 payIndex, uint32 unlockerId, bytes memory key) public returns(bool) {
        require(payIndex < payments.length, "invalid payIndex");
        require(isValidId(unlockerId), "Invalid unlockerId");
        require(block.number < payments[payIndex].block, "Hash lock expired");
        bytes32 h = keccak256(abi.encodePacked(unlockerId, key));
        require(h == payments[payIndex].lock, "Invalid key");
        
        payments[payIndex].lock = bytes32(0);
        balanceAdd(unlockerId, payments[payIndex].fee);
        
        emit Unlock(payIndex, key);
        return true;
    }

    /// @dev Enables the buyer to recover funds associated with a transfer operation for which decryption keys were not provided.
    /// @param payIndex Index of the payment transaction associated with this request. 
    /// @return true if the operation succeded.

    function refund(uint payIndex) public returns (bool) {
        require(payIndex < payments.length, "invalid payment Id");
        require(payments[payIndex].lock != 0, "payment is already unlocked");
        require(block.number >= payments[payIndex].block, "Hash lock has not expired yet");
        Challenge.Payment memory p = payments[payIndex];
        
        require(p.totalCount > 0, "payment already refunded");
        
        uint64 total = SafeMath.add64(
            SafeMath.mul64(p.totalCount, p.amount),
            p.fee);

        p.totalCount = 0;
        p.fee = 0;
        p.amount = 0;
        payments[payIndex] = p;
 
        // Complete refund
        balanceAdd(p.from, total);
    }


    /// @dev Helps verify a ECDSA signature, while recovering the signing address.
    /// @param hash Hash of the signed message
    /// @param _sig binary representation of the r, s & v parameters.
    /// @return address of the signer if data provided is valid, zero oterwise.

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

    /// @dev release a slot used for the collect chanel game, if the challenge game has ended.
    /// @param delegate id of the account requesting the release operation
    /// @param slot id of the slot requested for the duration of the challenge game

    function freeSlot(uint32 delegate, uint32 slot) public {
        require(isOwnerId(delegate), "only delegate can call");

        Challenge.CollectSlot memory s = collects[delegate][slot];

        if (s.status == 0) return;

        require (s.status == 1 && block.number >= s.block, "slot not available"); 
    
        // Refund Stake 
        balanceAdd(delegate, SafeMath.add64(s.delegateAmount, collectStake));

        uint64 balance = SafeMath.add64(
            accounts[s.to].balance, 
            SafeMath.sub64(s.amount, s.delegateAmount));

        if (s.addr != address(0)) {
            token.transfer(s.addr, balance);
            balance = 0;
        } 
        accounts[s.to].balance = balance;
        s.status = 0;
        collects[delegate][slot] = s;
    }
    
    /// @dev let users claim pending balance associated with prior transactions
    /// @param delegate id of the delegate account performing the operation on the name fo the user.
    /// @param slot Individual slot used for the challenge game.
    /// @param to Destination of the collect operation. 
    /// @param payIndex payIndex of the first payment index not covered by this application. 
    /// @param amount amount of tokens owed to this user account
    /// @param fee fee in tokens to be paid for the end user help.
    /// @param destination Address to withdraw the full account balance
    /// @param signature An R,S,V  ECDS signature provided by a user

    function collect(
        uint32 delegate,
        uint32 slot,
        uint32 to, 
        uint32 payIndex,
        uint64 amount,
        uint64 fee, 
        address destination,
        bytes memory signature
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

        if (delegate != to) {
            // Check that "to" != delegate, check who signed this transaction
            bytes32 hash = keccak256(abi.encodePacked(address(this), delegate, to, tacc.collected, payIndex, amount, fee, destination)); 
            
            require(recoverHelper(hash, signature) == tacc.addr, "Bad user signature");
        }

        // free slot if necessary
        freeSlot(delegate, slot);
        
        sl.minPayIndex = tacc.collected;
        sl.maxPayIndex = payIndex;

        uint64 needed = collectStake;
        // check if this is an instant collect
        if (slot >= instantSlot) {
            sl.delegateAmount = amount;
            tacc.balance = SafeMath.add64(
                tacc.balance,
                SafeMath.sub64(amount, fee));

            // check if the user is withdrawing its balance
            if (destination != address(0)) {
                token.transfer(destination, tacc.balance);
                tacc.balance = 0;
            }

            sl.addr = address(0);
            needed = SafeMath.add64(
                needed, 
                SafeMath.sub64(amount, fee));
        } else
        {
            sl.addr = destination;
            sl.delegateAmount = fee;
        }    

        // Check amount & balance
        require (acc.balance >= needed, "not enough funds");

        balanceSub(delegate, needed);
        
        sl.amount = amount;
        sl.to = to;
        sl.block = uint64(block.number + challengeBlocks);
        sl.status = 1;
        collects[delegate][slot] = sl;
     
        tacc.collected = uint32(payIndex);
        accounts[to] = tacc;
    }

    /// @dev initiate a challenge game
    /// @param delegate id of the delegate that performed the collect operation in the name of the end-user.
    /// @param slot slot used for the challenge game. Every user has a sperate set of slots
    /// @param challenger id of the user account challenging the delegate.    
    function challenge_1(
        uint32 delegate, 
        uint32 slot, 
        uint32 challenger) 
        validId(delegate)
        public
        onlyOwnerId(challenger) 
    {
        Challenge.challenge_1(collects[delegate][slot], accounts, challenger);
        emit Challenge_1(delegate, slot, challenger);
    }

    /// @dev The delegate provides the list of payments that mentions the enduser
    /// @param delegate id of the delegate performing the collect operation
    /// @param slot slot used for the operation
    /// @param data binary list of payment indexes associated with this collect operation.

    function challenge_2(
        uint32 delegate, 
        uint32 slot, 
        bytes memory data)
        public  
        onlyOwnerId(delegate)
    {
        Challenge.challenge_2(collects[delegate][slot], data);
        emit Challenge_2(delegate, slot);
    }

    /// @dev the Challenger chooses a single index into the delegate provided data list
    /// @param delegate id of the delegate performing the collect operation
    /// @param slot slot used for the operation
    /// @param data binary list of payment indexes associated with this collect operation.
    /// @param index index into the data array for the payment id selected by the challenger

    function challenge_3(
        uint32 delegate,
        uint32 slot, 
        bytes memory data, 
        uint32 index)
        validId(delegate) 
        public 
    {
        require(isOwnerId(collects[delegate][slot].challenger), "only challenger can call challenge_2");
        
        Challenge.challenge_3(collects[delegate][slot], data, index);
        emit Challenge_3(delegate, slot, index);
    }

    /// @dev the delegate provides proof that the destination account was included on that payment, winning the game
    /// @param delegate id of the delegate performing the collect operation
    /// @param slot slot used for the operation
 
    function challenge_4(
        uint32 delegate,
        uint32 slot,
        bytes memory payData) 
        public 
        onlyOwnerId(delegate) 
    {
        Challenge.challenge_4(
            collects[delegate][slot], 
            accounts, 
            payments,
            payData
            );
  
        emit Challenge_4(delegate, slot);
    }


    /// @dev the challenge was completed successfully. The delegate stake is slahed.
    /// @param delegate id of the delegate performing the collect operation
    /// @param slot slot used for the operation
    
    function challenge_success(
        uint32 delegate,
        uint32 slot
        )
        public
        validId(delegate) 
    {
        Challenge.challenge_success(collects[delegate][slot], accounts);
        emit Challenge_success(delegate, slot);
    }


    /// @dev The delegate won the challenge game. He gets the challenge stake.
    /// @param delegate id of the delegate performing the collect operation
    /// @param slot slot used for the operation

    function challenge_failed(
        uint32 delegate,
        uint32 slot)
        public
        validId(delegate) 
    {
        Challenge.challenge_failed(collects[delegate][slot], accounts);
        emit Challenge_failed(delegate, slot);
    }


    /// @dev Increase the specified account balance by diff tokens.
    /// @param id account id, as returned by register, bulkRegister and deposit
    /// @param diff number of tokens
    
    function balanceAdd(uint id, uint64 diff) private validId(id) {
        accounts[id].balance = SafeMath.add64(accounts[id].balance, diff);
    }

    /// @dev substract diff tokens from the specified account's balance
    /// @param id account id, as returned by register, bulkRegister and deposit
    /// @param diff number of tokens

    function balanceSub(uint id, uint64 diff) private validId(id) {
        accounts[id].balance = SafeMath.sub64(accounts[id].balance, diff);
    }

    /// @dev returns the balance associated with the account in tokens
    /// @param id account requested.

    function balanceOf(uint id) public view validId(id) returns (uint64) {
        return accounts[id].balance;
    }

    /// @dev gets number of accounts registered and reserved.
    /// @return returns the size of the accounts array.

    function accountsLength() public view returns (uint) {
        return accounts.length;
    }

    /// @dev gets the number of payments issued
    /// @return returns the size of the payments array.

    function paymentsLength() public view returns (uint) {
        return payments.length;
    }

    /// @dev gets the number of bulk registrations performed
    /// @return the size of the bulkRegistrations array.

    function bulkLength() public view returns (uint) {
        return bulkRegistrations.length;
    }

}