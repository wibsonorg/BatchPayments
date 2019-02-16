pragma solidity ^0.4.24;
import "./IERC20.sol";
import "./Accounts.sol";
import "./Payments.sol";
import "./SafeMath.sol";

/// @title BatchPayment processing
/// @notice This contract allows to scale ERC-20 token transfer for fees or micropayments
/// on the few-buyers / many-sellers setting.


contract BatPay is Accounts, Payments {
    address public owner;


    
    /*
     * Public functions
     */

    /// @dev Contract constructor, sets ERC20 token this contract will use for payments
    /// @param _token ERC20 contract address
    constructor(address _token) public {
        owner = msg.sender;
        token = IERC20(_token);
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
        Payments.challenge_1(collects[delegate][slot], challenger);
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
        Payments.challenge_2(collects[delegate][slot], data);
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
        
        Payments.challenge_3(collects[delegate][slot], data, index);
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
        Payments.challenge_4(
            collects[delegate][slot], 
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
        Payments.challenge_success(collects[delegate][slot]);
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
        Payments.challenge_failed(collects[delegate][slot]);
        emit Challenge_failed(delegate, slot);
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