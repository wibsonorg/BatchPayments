pragma solidity ^0.4.24;
import "./Accounts.sol";
import "./SafeMath.sol";

/// @title Payments and Challenge game - Performs the operations associated with transfer and the different 
/// steps of the collect challenge game

contract Payments is Accounts {
    uint constant public challengeBlocks = 30;     
    uint constant public challengeStepBlocks = 10;
    uint64 constant public collectStake = 100;
    uint64 constant public challengeStake = 100;
    uint32 constant public instantSlot = 32768;
    uint public unlockBlocks = 10;
    
    event Transfer(uint payIndex, uint from, uint totalCount, uint amount);
    event Unlock(uint payIndex, bytes key);
    event Collect(uint delegate, uint slot, uint to, uint fromPayindex, uint toPayIndex, uint amount);
    event Challenge_1(uint delegate, uint slot, uint challenger);
    event Challenge_2(uint delegate, uint slot);
    event Challenge_3(uint delegate, uint slot, uint index);
    event Challenge_4(uint delegate, uint slot);
    event Challenge_success(uint delegate, uint slot);
    event Challenge_failed(uint delegate, uint slot);  

    struct CollectSlot {
        uint32  minPayIndex;
        uint32  maxPayIndex;
        uint64  amount;
        uint64  delegateAmount;
        uint32  to;
        uint64  block;
        uint8   status;
        uint32  delegate;
        uint32  challenger;
        uint32  index;
        uint64  challengeAmount;
        address addr;
        bytes32 data;
    }


    mapping (uint32 => mapping (uint32 => CollectSlot)) public collects;
  

    /// @dev calculates new block numbers based on the current block and a delta constant specified by the protocol policy
    /// @param delta number of blocks into the future to calculate
    /// @return future block number

    function futureBlock(uint delta) private view returns(uint64) {
        return SafeMath.add64(block.number, delta);
    }    

    /// @dev Inspects the compact payment list provided and calculates the sum of the amounts referenced
    /// @param data binary array, with 12 bytes per item. 8-bytes amount, 4-bytes payment index.
    /// @return the sum of the amounts referenced on the array.

    function getDataSum(bytes memory data) public pure returns (uint sum) {
        uint n = data.length / 12;
        uint modulus = 2**64;

        sum = 0;

        // Get the sum of the stated amounts in data 
        // Each entry in data is [8-bytes amount][4-bytes payIndex]

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


    /// @dev Helper function that obtains the amount/payIndex pair located at position index
    /// @param data binary array, with 12 bytes per item. 8-bytes amount, 4-bytes payment index.
    /// @param index Array item requested
    /// @return amount and payIndex requested 

    function getDataAtIndex(bytes memory data, uint index) public pure returns (uint64 amount, uint32 payIndex) {
        uint mod1 = 2**64;
        uint mod2 = 2**32;
        uint i = index*12;

        require(i <= data.length-12);

        // solium-disable-next-line security/no-inline-assembly
        assembly
            {
                amount := mod(
                    mload(add(data, add(8, i))), 
                    mod1)           

                 payIndex := mod(
                    mload(add(data, add(12, i))),
                    mod2)
            }
    }

    /// @dev Internal function. Phase I of the challenging game
    /// @param s Collect slot
    /// @param challenger id of the challenger user

    function challenge_1(CollectSlot storage s, uint32 challenger) internal {
        require(accounts[challenger].balance >= challengeStake, "not enough balance");
 
        require(s.status == 1, "slot is not available for challenge");      
        require (block.number < s.block, "challenge time has passed");
        s.status = 2;
        s.challenger = challenger;
        s.block = futureBlock(challengeStepBlocks);
        
        accounts[challenger].balance -= challengeStake;
    }

    /// @dev Internal function. Phase II of the challenging game
    /// @param s Collect slot
    /// @param data Binary array listing the payments in which the user was referenced.

    function challenge_2(CollectSlot storage s, bytes memory data) internal {
        require(s.status == 2, "wrong slot status");
        require (block.number < s.block, "challenge time has passed");

        require(data.length % 12 == 0, "wrong data format");
        require (getDataSum(data) == s.amount, "data doesn't represent collected amount");

        s.data = keccak256(data);
        s.status = 3;
        s.block = futureBlock(challengeStepBlocks);
    }

    /// @dev Internal function. Phase III of the challenging game
    /// @param s Collect slot
    /// @param data Binary array listing the payments in which the user was referenced.
    /// @param index selecting the disputed payment

    function challenge_3(CollectSlot storage s, bytes memory data, uint32 index) internal {  
        require(s.status == 3);
        require(index < data.length/12);
        require (block.number < s.block, "challenge time has passed");
        require(s.data == keccak256(data), "data mismatch");
        (s.challengeAmount, s.index) = getDataAtIndex(data, index);
        s.index = index;
        s.status = 4;
        s.block = futureBlock(challengeStepBlocks);
    }

    /// @dev Internal function. Phase IV of the challenging game
    /// @param s Collect slot
    /// @param payData binary data describing the list of account receiving tokens on the selected transfer
  
    function challenge_4(
        CollectSlot storage s, 
        bytes memory payData) 
        internal 
    {
        require(s.status == 4);
        require(block.number < s.block, "challenge time has passed");
        require(s.index >= s.minPayIndex && s.index < s.maxPayIndex, "payment referenced is out of range");
        Payment memory p = payments[s.index];
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
    }

    /// @dev the challenge was completed successfully, or the delegate failed to respond on time. 
    /// The challenger will collect the stake.
    /// @param s Collect slot
   
    function challenge_success(CollectSlot storage s) internal {
        require((s.status == 2 || s.status == 4) && block.number >= s.block, "challenge not finished");

        accounts[s.challenger].balance = SafeMath.add64(
            accounts[s.challenger].balance,
            collectStake);

        s.status = 0;
    }

    /// @dev Internal function. The delegate proved the challenger wrong, or the challenger failed to respond on time. The delegae collects the stake.
    /// @param s Collect slot

    
    function challenge_failed(CollectSlot storage s) internal {
        require(s.status == 5 || (s.status == 3 && block.number >= s.block), "challenge not completed");

        // Challenge failed
        // delegate wins Stake
        accounts[s.delegate].balance = SafeMath.add64(
            accounts[s.delegate].balance,
            challengeStake);

        // reset slot to status=1, waiting for challenges
        s.challenger = 0;
        s.status = 1;
        s.block = futureBlock(challengeBlocks);
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
        bytes payData, 
        uint newCount,      
        bytes32 rootHash,
        bytes32 lock,
        bytes32 metadata) 
        external 
    {
        Payment memory p;
        p.from = fromId;
        p.amount = amount;
        p.fee = fee;
        p.lock = lock;
        p.block = SafeMath.add64(block.number,unlockBlocks);

        require(isValidId(fromId), "invalid fromId");
        uint len = payData.length;
        require(len > 1, "payData length is invalid");
        uint bytesPerId = uint(payData[1]);
        Account memory from = accounts[fromId];
        
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
        Payment memory p = payments[payIndex];
        
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

    function _freeSlot(uint32 delegate, uint32 slot) private {
        CollectSlot memory s = collects[delegate][slot];

        if (s.status == 0) return;

        require (s.status == 1 && block.number >= s.block, "slot not available"); 
    
        // Refund Stake 
        balanceAdd(delegate, SafeMath.add64(s.delegateAmount, collectStake));

        uint64 balance = SafeMath.add64(
            accounts[s.to].balance, 
            SafeMath.sub64(s.amount, s.delegateAmount));
        
        uint amount = 0;

        if (s.addr != address(0)) {
            amount = balance;
            balance = 0;
        } 
        accounts[s.to].balance = balance;

        collects[delegate][slot].status = 0;

        if (amount != 0) 
            require(token.transfer(s.addr, amount), "transfer failed");
    }

    /// @dev release a slot used for the collect channel game, if the challenge game has ended.
    /// @param delegate id of the account requesting the release operation
    /// @param slot id of the slot requested for the duration of the challenge game

    function freeSlot(uint32 delegate, uint32 slot) public {
        require(isOwnerId(delegate), "only delegate can call");
        _freeSlot(delegate, slot);
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
        require(isOwnerId(delegate), "invalid delegate");
        _freeSlot(delegate, slot);
      
        Account memory acc = accounts[delegate];
        
        // Check to is valid
        require(to <= accounts.length, "to must be a valid account id");

        Account memory tacc = accounts[to];
        require(tacc.addr != 0, "account registration has to be completed");

        // Check payIndex is valid
        require(payIndex > 0 && payIndex <= payments.length, "invalid payIndex");
        require(payIndex > tacc.collected, "payIndex is not a valid value");
        require(payments[payIndex-1].block < block.number, "cannot collect payments that can be unlocked");

        // Check if fee is valid
        require (fee <= amount, "fee is too big");

        CollectSlot memory sl;
     
        sl.delegate = delegate;

        if (delegate != to) {
            // If "to" != delegate, check who signed this transaction
            bytes32 hash = keccak256(abi.encodePacked(address(this), delegate, to, tacc.collected, payIndex, amount, fee, destination)); 
            
            require(recoverHelper(hash, signature) == tacc.addr, "Bad user signature");
        }

        sl.minPayIndex = tacc.collected;
        sl.maxPayIndex = payIndex;

        uint64 needed = collectStake;

        // check if this is an instant collect
        if (slot >= instantSlot) {
            sl.delegateAmount = amount;
            tacc.balance = SafeMath.add64(
                tacc.balance,
                SafeMath.sub64(amount, fee));

            sl.addr = address(0);
            needed = SafeMath.add64(
                needed, 
                SafeMath.sub64(amount, fee));
        } else 
        {   // not instant-collect
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

        // check if the user is withdrawing its balance
        if (destination != address(0) && slot >= instantSlot) {
            accounts[to].balance = 0;
            require(token.transfer(destination, tacc.balance), "transfer failed");
        } 
    }
}