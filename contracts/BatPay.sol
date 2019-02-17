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