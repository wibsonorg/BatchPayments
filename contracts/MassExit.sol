pragma solidity ^0.4.24;


import "./Payments.sol";
import "./SafeMath.sol";
import "./MassExitLib.sol";


/// @title MassExit, lets a group of users exit the contract together to minimize
/// associated transaction costs
contract MassExit is Payments {
    mapping (uint32 => mapping(uint32 => MassExitLib.ExitSlot)) exits;

    address defaultMonitor;
    mapping (uint32 => address) monitor;

    modifier enabled() {
        require(defaultMonitor != address(0), "massExit is disabled");
        _;
    }

    function setExitParams(
        uint32 massExitIdBlocks,
        uint32 massExitIdStepBlocks,
        uint32 massExitBalanceBlocks,
        uint32 massExitBalanceStepBlocks,  
        uint64 massExitStake,
        uint64 massExitChallengeStake) 
        public 
    {
        require(massExitIdBlocks != 0 && params.massExitIdBlocks == 0);

        params.massExitIdBlocks = massExitIdBlocks;
        params.massExitIdStepBlocks = massExitIdStepBlocks;
        params.massExitBalanceBlocks = massExitBalanceBlocks;
        params.massExitBalanceStepBlocks = massExitBalanceStepBlocks;
        params.massExitStake = massExitStake;
        params.massExitChallengeStake = massExitChallengeStake;
    }

    function setDefaultMonitor(address _monitor) public {
        require(msg.sender == owner);
        defaultMonitor = _monitor;
    }

    function setMonitor(uint32 id, address _monitor) public onlyAccountOwner(id) {
        monitor[id] = _monitor;
    }

    function startExit(
        uint32 delegate,
        uint32 exitId,
        bytes sellerList,
        address destination
    )
        public
        enabled()
        onlyAccountOwner(delegate) 
    {
        MassExitLib.startExit(
            exits[delegate][exitId], 
            params, 
            accounts, 
            delegate, 
            sellerList, 
            destination);
    }

    function challengeExitId_1(
        uint32 delegate,
        uint32 exitId,
        uint32 challenger,
        uint32 seller,
        bytes  sellerList
    ) 
        public
        onlyAccountOwner(challenger)
        validId(delegate)
    {
        MassExitLib.challengeExitId_1(
            exits[delegate][exitId],
            params,
            accounts,
            challenger,
            seller,
            sellerList
        );
    }

    function challengeExitId_2(
        uint32 delegate,
        uint32 exitId,
        bytes sellerSignature,
        bytes monitorSignature
    ) 
        public
        onlyAccountOwner(delegate)
    {
        uint32 seller = exits[delegate][exitId].seller;
        address mon = monitor[seller];
        if (mon == 0) mon = defaultMonitor;

        MassExitLib.challengeExitId_2(
            exits[delegate][exitId],
            params,
            accounts,
            sellerSignature,
            monitorSignature,
            mon
        );
    }

    function challengeExit_success(
        uint32 delegate,
        uint32 exitId
    ) 
        public
        validId(delegate)
    {
        MassExitLib.challengeExit_success(
            exits[delegate][exitId],
            params,
            accounts);
    }


    function challengerTimeout(
        uint32 delegate,
        uint32 exitId
    ) 
        public
        validId(delegate)
    {
        MassExitLib.challengerTimeout(
            exits[delegate][exitId],
            params,
            accounts);
    }

    function startExitBalance(
        uint32 delegate, 
        uint32 exitId) 
        public 
        validId(delegate)
    {
        MassExitLib.startExitBalance(
            exits[delegate][exitId], 
            params
        );
    }

    function challengeExitBalance_3(
        uint32 delegate,
        uint32 exitId,
        uint64 totalBalance
    ) 
        public
        onlyAccountOwner(delegate) 
    {
        MassExitLib.challengeExitBalance_3(
            exits[delegate][exitId],
            params,
            totalBalance
        );
    }

    function challengeExitBalance_4(
        uint32 delegate,
        uint32 exitId,
        uint32 challenger
    ) 
        public
        onlyAccountOwner(challenger)    
        validId(delegate)
    {
        MassExitLib.challengeExitBalance_4(
            exits[delegate][exitId],
            params,
            accounts,
            challenger
        );
    }

    function challengeExitBalance_5(
        uint32 delegate,
        uint32 exitId,
        bytes balanceList
    ) 
        public
        onlyAccountOwner(delegate)    
    {
        MassExitLib.challengeExitBalance_5(
            exits[delegate][exitId],
            params,
            balanceList
        );
    }

    function challengeExitBalance_6(
        uint32 delegate,
        uint32 exitId,
        bytes sellerList,
        bytes balanceList,
        uint32 seller
    ) 
        public
        validId(delegate)    
    {
        require(isAccountOwner(exits[delegate][exitId].challenger), "only challenger");
        MassExitLib.challengeExitBalance_6(
            exits[delegate][exitId],
            params,
            sellerList,
            balanceList,
            seller
        );
    }

    function challengeExit_collectSuccessful(
        uint32 delegate,
        uint32 slot,
        uint32 exitDelegate,
        uint32 exitId    
    )
        public 
        onlyAccountOwner(exitDelegate)
        onlyAccountOwner(delegate)
    {
        MassExitLib.challengeExit_collectSuccessful(
            collects[delegate][slot],
            exits[exitDelegate][exitId],
            params,
            accounts
        );
    }

    function challenge_accountClosed(
        uint32 delegate,
        uint32 slot,
        uint32 exitDelegate,
        uint32 exitId,
        uint32 challenger,
        bytes  sellerList
    )
        public
        validId(delegate)
        validId(exitDelegate)
        onlyAccountOwner(challenger)
    {
        MassExitLib.challenge_accountClosed(
            collects[delegate][slot],
            exits[exitDelegate][exitId],
            params,
            accounts,
            challenger,
            sellerList);
    }
}
