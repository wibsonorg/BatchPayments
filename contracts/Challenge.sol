pragma solidity ^0.4.24;


import "./Data.sol";
import "./SafeMath.sol";


/**
 * @title Challenge helper library
 */
library Challenge {
    /**
     * @dev Reverts if challenge period has expired or Collect Slot status is not a valid one.
     */
    modifier onlyValidCollectSlot(Data.CollectSlot storage collectSlot, uint8 validStatus) {
        require(!challengeHasExpired(collectSlot), "Challenge has expired");
        require(isSlotStatusValid(collectSlot, validStatus), "Wrong Collect Slot status");
        _;
    }

    /**
     * @return true if the current block number is greater or equal than the allowed
     *         block for this challenge.
     */
    function challengeHasExpired(Data.CollectSlot storage collectSlot) public view returns (bool) {
        return collectSlot.block <= block.number;
    }

    /**
     * @return true if the Slot status is valid.
     */
    function isSlotStatusValid(Data.CollectSlot storage collectSlot, uint8 validStatus) public view returns (bool) {
        return collectSlot.status == validStatus;
    }

    /** @dev calculates new block numbers based on the current block and a
     *      delta constant specified by the protocol policy.
     * @param delta number of blocks into the future to calculate.
     * @return future block number.
     */
    function getFutureBlock(uint delta) public view returns(uint64) {
        return SafeMath.add64(block.number, delta);
    }

    /**
     * @dev Inspects the compact payment list provided and calculates the sum of the amounts referenced
     * @param data binary array, with 12 bytes per item. 8-bytes amount, 4-bytes payment index.
     * @return the sum of the amounts referenced on the array.
     */
    function getDataSum(bytes memory data) public pure returns (uint sum) {
        require(data.length > 0, "no data provided");
        require(data.length % 12 == 0, "wrong data format");

        uint n = SafeMath.div(data.length, 12);
        uint modulus = 2**64;

        sum = 0;

        // Get the sum of the stated amounts in data
        // Each entry in data is [8-bytes amount][4-bytes payIndex]

        for (uint i = 0; i < n; i++) {
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                let amount := mod(mload(add(data, add(8, mul(i, 12)))), modulus)
                let result := add(sum, amount)
                if or(gt(result, modulus), eq(result, modulus)) { revert (0, 0) }
                sum := result
            }
        }
    }

    /// @dev Helper function that obtains the amount/payIndex pair located at position index
    /// @param data binary array, with 12 bytes per item. 8-bytes amount, 4-bytes payment index.
    /// @param index Array item requested
    /// @return amount and payIndex requested

    function getDataAtIndex(bytes memory data, uint index) public pure returns (uint64 amount, uint32 payIndex) {
        require(data.length > 0, "no data provided");
        require(data.length % 12 == 0, "wrong data format");

        uint mod1 = 2**64;
        uint mod2 = 2**32;
        uint i = SafeMath.mul(index, 12);

        require(i <= SafeMath.sub(data.length, 12), "invalid index");

        // solium-disable-next-line security/no-inline-assembly
        assembly {
            amount := mod(
                mload(add(data, add(8, i))),
                mod1)

            payIndex := mod(
                mload(add(data, add(12, i))),
                mod2)
        }
    }

    /// @dev Process payData, inspecting the list of ids, accumulating the amount for
    ///    each entry of `id`.
    ///   `payData` includes 2 header bytes, followed by n bytesPerId-bytes entries.
    ///   `payData` format: [byte 0xff][byte bytesPerId][delta 0][delta 1]..[delta n-1]
    /// @param payData List of payees of a specific Payment, with the above format.
    /// @param id ID to look for in `payData`
    /// @param amount amount per occurrence of `id` in `payData`
    /// @return the amount sum for all occurrences of `id` in `payData`

    function getPayDataSum(bytes memory payData, uint id, uint amount) public pure returns (uint sum) {
        require(payData.length > 0, "no payData provided");

        uint bytesPerId = uint(payData[1]);
        require((payData.length - 2) % bytesPerId == 0, "wrong payData format");

        uint modulus = 1 << SafeMath.mul(bytesPerId, 8);
        uint currentId = 0;

        sum = 0;

        for(uint i = 2; i < payData.length; i += bytesPerId) {
            // Get next id delta from paydata
            // currentId += payData[2+i*bytesPerId]

            // solium-disable-next-line security/no-inline-assembly
            assembly {
                currentId := add(
                    currentId,
                    mod(
                        mload(add(payData,add(i, bytesPerId))),
                        modulus))

                if eq(currentId, id) { sum := add(sum, amount) }
            }
        }
    }

    /**
     * @dev function. Phase I of the challenging game
     * @param collectSlot Collect slot
     * @param config Various parameters
     * @param accounts a reference to the main accounts array
     * @param challenger id of the challenger user
     */
    function challenge_1(
        Data.CollectSlot storage collectSlot, 
        Data.Config storage config, 
        Data.Account[] storage accounts, 
        uint32 challenger
    )
        public
        onlyValidCollectSlot(collectSlot, 1)
    {
        require(accounts[challenger].balance >= config.challengeStake, "not enough balance");
 
        collectSlot.status = 2;
        collectSlot.challenger = challenger;
        collectSlot.block = getFutureBlock(config.challengeStepBlocks);

        accounts[challenger].balance -= config.challengeStake;
    }

    /**
     * @dev Internal function. Phase II of the challenging game
     * @param collectSlot Collect slot
     * @param config Various parameters   
     * @param data Binary array listing the payments in which the user was referenced.
     */
    function challenge_2(
        Data.CollectSlot storage collectSlot, 
        Data.Config storage config, 
        bytes memory data
    )
        public
        onlyValidCollectSlot(collectSlot, 2)
    {
        require (getDataSum(data) == collectSlot.amount, "data doesn't represent collected amount");

        collectSlot.data = keccak256(data);
        collectSlot.status = 3;
        collectSlot.block = getFutureBlock(config.challengeStepBlocks);
    }

    /**
     * @dev Internal function. Phase III of the challenging game
     * @param collectSlot Collect slot
     * @param config Various parameters
     * @param data Binary array listing the payments in which the user was referenced.
     * @param disputedPaymentIndex index selecting the disputed payment
     */
    function challenge_3(
        Data.CollectSlot storage collectSlot, 
        Data.Config storage config, 
        bytes memory data, 
        uint32 disputedPaymentIndex
    )
        public
        onlyValidCollectSlot(collectSlot, 3)
    {  
        require(collectSlot.data == keccak256(data), "data mismatch");
        (collectSlot.challengeAmount, collectSlot.index) = getDataAtIndex(data, disputedPaymentIndex);
        collectSlot.status = 4;
        collectSlot.block = getFutureBlock(config.challengeStepBlocks);
    }

    /**
     * @dev Internal function. Phase IV of the challenging game
     * @param collectSlot Collect slot
     * @param payments a reference to the BatPay payments array
     * @param payData binary data describing the list of account receiving tokens on the selected transfer
     */
    function challenge_4(
        Data.CollectSlot storage collectSlot,
        Data.Payment[] storage payments, 
        bytes memory payData
    )
        public
        onlyValidCollectSlot(collectSlot, 4)
    {
        require(collectSlot.index >= collectSlot.minPayIndex && collectSlot.index < collectSlot.maxPayIndex,
            "payment referenced is out of range");
        Data.Payment memory p = payments[collectSlot.index];
        require(keccak256(payData) == p.paymentDataHash, "payData is incorrect");
        require(p.lockingKeyHash == 0, "payment is locked");

        uint collected = getPayDataSum(payData, collectSlot.to, p.amount);

        // Check if id is included in bulkRegistration within payment
        if (collectSlot.to >= p.smallestAccountId && collectSlot.to < p.greatestAccountId) {
            collected = SafeMath.add(collected, p.amount);
        }

        require(collected == collectSlot.challengeAmount, "amount mismatch");

        collectSlot.status = 5;
    }

    /// @dev the challenge was completed successfully, or the delegate failed to respond on time.
    /// The challenger will collect the stake.
    /// @param collectSlot Collect slot
    /// @param config Various parameters
    /// @param accounts a reference to the main accounts array


    function challenge_success(
        Data.CollectSlot storage collectSlot,
        Data.Config storage config,
        Data.Account[] storage accounts
    ) 
        public
    {
        require((collectSlot.status == 2 || collectSlot.status == 4) && block.number >= collectSlot.block,
            "challenge not finished");

        accounts[collectSlot.challenger].balance = SafeMath.add64(
            accounts[collectSlot.challenger].balance,
            config.collectStake);

        collectSlot.status = 0;
    }

    /**
     * @dev Internal function. The delegate proved the challenger wrong, or
     *      the challenger failed to respond on time. The delegae collects the stake.
     * @param collectSlot Collect slot
     * @param config Various parameters
     * @param accounts a reference to the main accounts array
     */
    function challenge_failed(
        Data.CollectSlot storage collectSlot,
        Data.Config storage config,
        Data.Account[] storage accounts
    )
        public
    {
        require(collectSlot.status == 5 || (collectSlot.status == 3 && block.number >= collectSlot.block),
            "challenge not completed");

        // Challenge failed
        // delegate wins Stake
        accounts[collectSlot.delegate].balance = SafeMath.add64(
            accounts[collectSlot.delegate].balance,
            config.challengeStake);

        // reset slot to status=1, waiting for challenges
        collectSlot.challenger = 0;
        collectSlot.status = 1;
        collectSlot.block = getFutureBlock(config.challengeBlocks);
    }

    /**
     * @dev Helps verify a ECDSA signature, while recovering the signing address.
     * @param hash Hash of the signed message
     * @param sig binary representation of the r, s & v parameters.
     * @return address of the signer if data provided is valid, zero otherwise.
     */
    function recoverHelper(bytes32 hash, bytes sig) public pure returns (address) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, hash));

        bytes32 r;
        bytes32 s;
        uint8 v;

        // Check the signature length
        if (sig.length != 65) {
            return (address(0));
        }

        // Divide the signature in r, s and v variables
        // ecrecover takes the signature parameters, and the only way to get them
        // currently is to use assembly.
        // solium-disable-next-line security/no-inline-assembly
        assembly {
        r := mload(add(sig, 32))
        s := mload(add(sig, 64))
        v := byte(0, mload(add(sig, 96)))
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
}
