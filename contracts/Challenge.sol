pragma solidity ^0.4.24;
import "./Account.sol";
import "./SafeMath.sol";


library Challenge {
    uint constant public challengeBlocks = 300;     
    uint constant public challengeStepBlocks = 100;
    uint64 constant public collectStake = 100;
    uint64 constant public challengeStake = 100;

  
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

    struct Payment {
        uint32  from;
        uint64  amount;
        uint64  fee;
        uint32  minId;  
        uint32  maxId;
        uint32  totalCount;
        uint64  block;
        bytes32 hash;
        bytes32 lock;
        bytes32 metadata;
    }

    function futureBlock(uint delta) private view returns(uint64) {
        return SafeMath.add64(block.number, delta);
    }    

    
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

    function challenge_1(CollectSlot storage s, Account.Record[] storage accounts, uint32 challenger) internal {
        require(accounts[challenger].balance >= challengeStake, "not enough balance");
 
        require(s.status == 1, "slot is not available for challenge");      
        require (block.number < s.block, "challenge time has passed");
        s.status = 2;
        s.challenger = challenger;
        s.block = futureBlock(challengeStepBlocks);
        
        accounts[challenger].balance -= challengeStake;
    }

    function challenge_2(CollectSlot storage s, bytes memory data) internal {
        require(s.status == 2, "wrong slot status");
        require (block.number < s.block, "challenge time has passed");

        require(data.length % 12 == 0, "wrong data format");
        require (getDataSum(data) == s.amount, "data doesn't represent collected amount");

        s.data = keccak256(data);
        s.status = 3;
        s.block = futureBlock(challengeStepBlocks);
    }


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

    function challenge_4(
        CollectSlot storage s, 
        Account.Record[] storage accounts, 
        Payment[] storage payments, 
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

    function challenge_success(CollectSlot storage s, Account.Record[] storage accounts) internal {
        require((s.status == 2 || s.status == 4) && block.number >= s.block, "challenge not finished");

        accounts[s.challenger].balance = SafeMath.add64(
            accounts[s.challenger].balance,
            collectStake);

        s.status = 0;
    }

    function challenge_failed(CollectSlot storage s, Account.Record[] storage accounts) internal {
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

}