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

        params.maxBulk = 2**16;
        params.maxTransfer = 100000;
        params.challengeBlocks = 30;
        params.challengeStepBlocks = 10;
        params.collectStake = 100;
        params.challengeStake = 100;
        params.unlockBlocks = 10;
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