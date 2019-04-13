pragma solidity ^0.4.25;

import "./Accounts.sol";
import "./SafeMath.sol";
import "./Data.sol";
import "./Challenge.sol";

/// @title MassExit helper functions

library MassExitLib {
    struct ExitSlot {
        bytes32 hashSellerList;
        bytes32 hashBalanceList;
        uint32  listLength;
        uint32  challenger;
        uint32  delegate;
        uint32  seller;
        uint32  index;
        uint64  totalBalance;
        uint64  sellerBalance;
        address destination;
        uint8   status;
        uint64  block;
    }

    /// @dev Gets balance at `index`
    /// @param data binary array of balances.
    /// @param index of the element we are looking for
    /// @return balance (as a uint64)

    function getBalanceAtIndex(bytes memory data, uint index) public pure returns (uint64 amount) {
        uint mod1 = 2**64;
        uint i = SafeMath.mul(index, 8);

        require(i <= SafeMath.sub(data.length, 8));

        // solium-disable-next-line security/no-inline-assembly
        assembly
            {
                amount := mod(
                    mload(add(data, add(8, i))),
                    mod1)
            }
    }

    /// @dev Looks for an id in a list
    /// @param data binary array, 4-bytes id delta.
    /// @param id the id we are looking for
    /// @return index of the `id` in the array. reverts if not present

    function indexOf(bytes memory data, uint id) public pure returns (uint32) {
        require(data.length % 4 == 0, "invalid data length");

        uint n = SafeMath.div(data.length, 4);
        uint modulus = 2**32;

        uint sum = 0;

        for(uint32 i = 0; i<n; i++) {
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                sum :=
                    add(
                        sum,
                        mod(
                            mload(add(data, add(4, mul(i, 4)))),
                            modulus)
                    )
            }
            if (sum == id) return i;
        }
        revert("id not found");
    }

    /// TODO: complete this one
    /// @dev begin the mass exit process
    /// @param slot TBC
    /// @param params TBC
    /// @param accounts TBC
    /// @param delegate TBC
    /// @param sellerList TBC
    /// @param destination TBC

    function startExit(
        ExitSlot storage slot,
        Data.Config storage params,
        Data.Account[] storage accounts,
        uint32  delegate,
        bytes sellerList,
        address destination)
        public
    {
        require(accounts[delegate].balance >= params.massExitStake, "not enough funds");
        require(slot.status == 0, "Slot is not empty");
        require(sellerList.length % 4 == 0, "invalid list");
        require(sellerList.length < 2**32, "invalid list length");

        slot.delegate = delegate;
        slot.listLength = SafeMath.div32(sellerList.length, 4);
        slot.hashSellerList = keccak256(sellerList);
        slot.destination = destination;
        accounts[delegate].balance = SafeMath.sub64(
            accounts[delegate].balance,
            params.massExitStake);

        slot.block = Challenge.getFutureBlock(params.massExitIdBlocks);
        slot.status = 1;
    }

    function challengeExitId_1(
        ExitSlot storage slot,
        Data.Config storage params,
        Data.Account[] storage accounts,
        uint32 challenger,
        uint32 seller,
        bytes  sellerList
        )
        public
    {
        require(accounts[challenger].balance >= params.massExitChallengeStake, "not enough funds");
        require(slot.status == 1, "invalid status");
        require(block.number < slot.block, "challenge time has passed");
        require(keccak256(sellerList) == slot.hashSellerList, "sellerList mismatch");

        accounts[challenger].balance = SafeMath.sub64(
            accounts[challenger].balance,
            params.massExitChallengeStake);

        slot.challenger = challenger;
        slot.index = indexOf(sellerList, seller);
        slot.seller = seller;
        slot.block = Challenge.getFutureBlock(params.massExitIdStepBlocks);
        slot.status = 2;
    }

    function challengeExitId_2(
        ExitSlot storage slot,
        Data.Config storage params,
        Data.Account[] storage accounts,
        bytes sellerSignature,
        bytes monitorSignature,
        address monitorAddress
    )
        public
    {
        require(slot.status == 2, "invalid status");
        require(block.number < slot.block, "challenge time has passed");
        bytes32 hash = keccak256(
            abi.encodePacked(address(this),
            slot.seller,
            slot.delegate,
            slot.destination
            ));

        require(Challenge.recoverHelper(hash, sellerSignature) == accounts[slot.seller].owner,
            "invalid seller signature");
        require(Challenge.recoverHelper(hash, monitorSignature) == monitorAddress,
            "invalid monitor address");

        // Challenge Failed.
        accounts[slot.delegate].balance = SafeMath.add64(
            accounts[slot.delegate].balance,
            params.massExitChallengeStake);

        slot.challenger = 0;
        slot.block = Challenge.getFutureBlock(params.massExitIdBlocks);
        slot.status = 1;
    }

    function challengeExit_success(
        ExitSlot storage slot,
        Data.Config storage params,
        Data.Account[] storage accounts)
        public
    {
        require(
            slot.status == 2 || slot.status == 3 || slot.status == 5 || slot.status == 7,
            "invalid status");

        require(block.number >= slot.block, "challenge is still possible");

        // Challenge success
        accounts[slot.challenger].balance = SafeMath.add64(
            accounts[slot.challenger].balance,
            params.massExitStake);

        slot.hashSellerList = bytes32(0);
        slot.hashBalanceList = bytes32(0);
        slot.challenger = 0;
        slot.seller = 0;
        slot.index = 0;
        slot.delegate = 0;
        slot.totalBalance = 0;
        slot.sellerBalance = 0;
        slot.destination = address(0);
        slot.status = 0;
        slot.delegate = 0;
        slot.block = 0;
    }

    function startExitBalance(
        ExitSlot storage slot, 
        Data.Config storage params  
    )
        public
    {
        require(slot.status == 1, "invalid status");
        require(block.number >= slot.block, "challenge is still possible");

        // give the delegate the oportunity to finish pending collects.
        slot.status = 3;
        slot.block = Challenge.getFutureBlock(2*params.challengeBlocks);
    }

    function challengeExitBalance_3(
        ExitSlot storage slot,
        Data.Config storage params,
        uint64 totalBalance
    ) 
        public 
    {
        require(slot.status == 3, "invalid status");
        require(block.number < slot.block, "challenge time has passed");

        slot.totalBalance = totalBalance;
        slot.block = Challenge.getFutureBlock(params.massExitBalanceBlocks);
        slot.status = 4;
    }

    function challengeExitBalance_4(
        ExitSlot storage slot,
        Data.Config storage params,
        Data.Account[] storage accounts,
        uint32 challenger
    )
        public 
    {
        require(slot.status == 4, "invalid status");
        require(block.number < slot.block, "challenge time has passed");
        require(accounts[challenger].balance >= params.massExitChallengeStake, "not enough funds");

        accounts[challenger].balance = SafeMath.sub64(
            accounts[challenger].balance,
            params.massExitChallengeStake);

        slot.challenger = challenger;
        slot.block = Challenge.getFutureBlock(params.massExitBalanceStepBlocks);
        slot.status = 5;
    }

    function challengeExitBalance_5(
        ExitSlot storage slot,
        Data.Config storage params,
        bytes balanceList
    ) 
        public 
    {
        require(slot.status == 5, "invalid status");
        require(block.number < slot.block, "challenge time has passed");
        require(balanceList.length == slot.listLength*8, "invalid balanceList");

        slot.hashBalanceList = keccak256(balanceList);
        slot.block = Challenge.getFutureBlock(params.massExitBalanceStepBlocks);
        slot.status = 6;
    }

    function challengeExitBalance_6(
        ExitSlot storage slot,
        Data.Config storage params,
        bytes sellerList,
        bytes balanceList,
        uint32 seller
    ) 
        public
    {
        require(slot.status == 6, "invalid status");
        require(block.number < slot.block, "challenge time has passed");
        require(keccak256(sellerList) == slot.hashSellerList, "invalid sellerList");
        require(keccak256(balanceList) == slot.hashBalanceList, "invalid balanceList");

        slot.index = indexOf(sellerList, seller);
        slot.seller = seller;
        slot.sellerBalance = getBalanceAtIndex(balanceList, slot.index);
        slot.block = Challenge.getFutureBlock(params.massExitBalanceStepBlocks);
        slot.status = 7;
    }

    function challengerTimeout(
        ExitSlot storage slot,
        Data.Config storage params,
        Data.Account[] storage accounts)
        public
    {
        require(slot.status == 6, "invalid status");
        require(block.number >= slot.block, "challenge is still possible");

        accounts[slot.delegate].balance = SafeMath.add64(
            accounts[slot.delegate].balance,
            SafeMath.add64(
                params.collectStake,
                params.massExitChallengeStake
                )
        );

        slot.status = 4;
        slot.block = Challenge.getFutureBlock(params.massExitBalanceBlocks);
    }

    function challengeExit_collectSuccessful(
        Data.CollectSlot storage s,
        ExitSlot storage e,
        Data.Config storage params,
        Data.Account[] storage accounts)
        public
    {
        require (s.status == 1, "slot is not available for challenge");
        require (block.number > s.block, "challenge time has passed");
        require (e.status == 7, "exit not completed");

        // check for exit challenge validation scenario
        //  - The delegate for collect() should be the same as for exit
        //  - The exit should be in a single balance challenge (status==6)
        //  - The exit-slot seller should be the target of the collect

        require(
            s.delegate == e.delegate && e.status == 7 && e.seller == s.to,
            "collect & exit mismatch");

        require(s.amount == e.sellerBalance, "balance mismatch");

        // delegate recovers Collect stake && exit challenge Stake

        s.status = 0;

        // Challenges from exits shouldn't modify seller.lastCollectedPaymentId
        if (accounts[s.to].lastCollectedPaymentId > s.minPayIndex)
            accounts[s.to].lastCollectedPaymentId = s.minPayIndex;

        accounts[s.delegate].balance = SafeMath.add64(
            accounts[s.delegate].balance,
            SafeMath.add64(
                params.collectStake,
                params.massExitChallengeStake
                )
        );

        e.block = Challenge.getFutureBlock(params.massExitBalanceBlocks);
        e.status = 4;
    }

    function challenge_accountClosed(
        Data.CollectSlot storage s,
        ExitSlot storage e,
        Data.Config storage params,
        Data.Account[] storage accounts,
        uint32 challenger,
        bytes sellerList
    )
        public
    {
        require (s.status == 1, "slot is not available for challenge");
        require (block.number <= s.block, "challenge time has passed");
        require (e.status >= 3, "exit not completed");

        // check for exit challenge validation scenario
        //  - The delegate for collect() should be the same as for exit
        //  - The exit should be in a single balance challenge (status==6)
        //  - The exit-slot seller should be the target of the collect

        if (s.delegate == e.delegate &&
            e.status == 6 &&
            e.seller == s.to)
        {
            revert("collect is part of exit-challenge");
        }

        // normal scenario, check if target account is closed

        require(keccak256(sellerList) == e.hashSellerList, "invalid sellerList");

        // Check seller is included on List
        indexOf(sellerList, s.to);

        // Challenges from exits shouldn't modify seller.lastCollectedPaymentId
        if (accounts[s.to].lastCollectedPaymentId > s.minPayIndex)
            accounts[s.to].lastCollectedPaymentId = s.minPayIndex;

        // challenger wins stake
        accounts[challenger].balance = SafeMath.add64(
            accounts[challenger].balance,
            params.collectStake);

        s.status = 0;
    }
}
