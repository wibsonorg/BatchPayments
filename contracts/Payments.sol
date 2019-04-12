pragma solidity ^0.4.25;


import "./Accounts.sol";
import "./SafeMath.sol";
import "./Challenge.sol";


/**
 * @title Payments and Challenge game - Performs the operations associated with
 *        transfer and the different steps of the collect challenge game.
 */
contract Payments is Accounts {
    event PaymentRegistered(
        uint indexed payIndex,
        uint indexed from,
        uint totalNumberOfPayees,
        uint amount
    );

    event PaymentUnlocked(uint indexed payIndex, bytes key);
    event PaymentRefunded(uint32 beneficiaryAccountId, uint64 amountRefunded);
    /**
     * Event for collection logging. Off-chain monitoring services may listen
     * to this event to trigger challenges.
     */
    event Collect(
        uint indexed delegate,
        uint indexed slot,
        uint indexed to,
        uint fromPayindex,
        uint toPayIndex,
        uint amount
    );

    event Challenge1(uint indexed delegate, uint indexed slot, uint challenger);
    event Challenge2(uint indexed delegate, uint indexed slot);
    event Challenge3(uint indexed delegate, uint indexed slot, uint index);
    event Challenge4(uint indexed delegate, uint indexed slot);
    event ChallengeSuccess(uint indexed delegate, uint indexed slot);
    event ChallengeFailed(uint indexed delegate, uint indexed slot);

    Payment[] public payments;
    mapping (uint32 => mapping (uint32 => CollectSlot)) public collects;

    /**
     * @dev Register token payment to multiple recipients
     * @param fromId Account id for the originator of the transaction
     * @param amount Amount of tokens to pay each destination.
     * @param fee Fee in tokens to be payed to the party providing the unlocking service
     * @param payData Efficient representation of the destination account list
     * @param newCount Number of new destination accounts that will be reserved during the registerPayment transaction
     * @param rootHash Hash of the root hash of the Merkle tree listing the addresses reserved.
     * @param lockingKeyHash hash resulting of calculating the keccak256 of
     *        of the key locking this payment to help in atomic data swaps.
     *        This hash will later be used by the `unlock` function to unlock the payment we are registering.
     *         The `lockingKeyHash` must be equal to the keccak256 of the packed
     *         encoding of the unlockerAccountId and the key used by the unlocker to encrypt the traded data:
     *             `keccak256(abi.encodePacked(unlockerAccountId, key))`
     *         DO NOT use previously used locking keys, since an attacker could realize that by comparing key hashes
     * @param metadata Application specific data to be stored associated with the payment
     */
    function registerPayment(
        uint32 fromId,
        uint64 amount,
        uint64 fee,
        bytes payData,
        uint newCount,
        bytes32 rootHash,
        bytes32 lockingKeyHash,
        bytes32 metadata
    )
        external
    {
        require(isAccountOwner(fromId), "invalid fromId");

        Payment memory p;

        // Prepare a Payment struct
        p.fromAccountId = fromId;
        p.amount = amount;
        p.fee = fee;
        p.lockingKeyHash = lockingKeyHash;
        p.metadata = metadata;
        p.smallestAccountId = uint32(accounts.length);
        p.greatestAccountId = SafeMath.add32(p.smallestAccountId, newCount);
        p.lockTimeoutBlockNumber = SafeMath.add64(block.number, params.unlockBlocks);
        p.paymentDataHash = keccak256(abi.encodePacked(payData));
        p.totalNumberOfPayees = SafeMath.add32(Challenge.getPayDataCount(payData), newCount);

        require(p.totalNumberOfPayees < params.maxTransfer, "too many payees, should be less than config maxTransfer");

        // calculate total cost of payment
        uint64 totalCost = SafeMath.mul64(amount, p.totalNumberOfPayees);
        totalCost = SafeMath.add64(totalCost, fee);

        // Check that fromId has enough balance and substract totalCost
        balanceSub(fromId, totalCost);

        // If this operation includes new accounts, do a bulkRegister
        if (newCount > 0) {
            bulkRegister(newCount, rootHash);
        }

        // Save the new Payment
        payments.push(p);

        emit PaymentRegistered(payments.length-1, p.fromAccountId, p.totalNumberOfPayees, p.amount);
    }

    /**
     * @dev provide the required key, releasing the payment and enabling the buyer decryption the digital content.
     * @param payIndex payment Index associated with the registerPayment operation.
     * @param unlockerAccountId id of the party providing the unlocking service. Fees wil be payed to this id.
     * @param key Cryptographic key used to encrypt traded data.
     */
    function unlock(uint32 payIndex, uint32 unlockerAccountId, bytes memory key) public returns(bool) {
        require(payIndex < payments.length, "invalid payIndex, payments is not that long yet");
        require(isValidId(unlockerAccountId), "Invalid unlockerAccountId");
        require(block.number < payments[payIndex].lockTimeoutBlockNumber, "Hash lock expired");
        bytes32 h = keccak256(abi.encodePacked(unlockerAccountId, key));
        require(h == payments[payIndex].lockingKeyHash, "Invalid key");

        payments[payIndex].lockingKeyHash = bytes32(0);
        balanceAdd(unlockerAccountId, payments[payIndex].fee);

        emit PaymentUnlocked(payIndex, key);
        return true;
    }

    /**
     * @dev Enables the buyer to recover funds associated with a `registerPayment()`
     *      operation for which decryption keys were not provided.
     * @param payIndex Index of the payment transaction associated with this request.
     * @return true if the operation succeded.
     */
    function refundLockedPayment(uint payIndex) public returns (bool) {
        require(payIndex < payments.length, "invalid payIndex, payments is not that long yet");
        require(payments[payIndex].lockingKeyHash != 0, "payment is already unlocked");
        require(block.number >= payments[payIndex].lockTimeoutBlockNumber, "Hash lock has not expired yet");
        Payment memory payment = payments[payIndex];
        require(payment.totalNumberOfPayees > 0, "payment already refunded");

        uint64 total = SafeMath.add64(
            SafeMath.mul64(payment.totalNumberOfPayees, payment.amount),
            payment.fee
        );

        payment.totalNumberOfPayees = 0;
        payment.fee = 0;
        payment.amount = 0;
        payments[payIndex] = payment;

        // Complete refund
        balanceAdd(payment.fromAccountId, total);
        emit PaymentRefunded(payment.fromAccountId, total);

        return true;
    }

    /// @dev release a slot used for the collect channel game, if the challenge game has ended.
    /// @param delegate id of the account requesting the release operation
    /// @param slot id of the slot requested for the duration of the challenge game
    function freeSlot(uint32 delegate, uint32 slot) public {
        require(isAccountOwner(delegate), "only delegate can call");
        _freeSlot(delegate, slot);
    }

    /// @dev let users claim pending balance associated with prior transactions
    /// @param delegate id of the delegate account performing the operation on the name of the user.
    /// @param slotId Individual slot used for the challenge game.
    /// @param toAccountId Destination of the collect operation.
    /// @param payIndex payIndex of the first payment index not covered by this application.
    /// @param declaredAmount amount of tokens owed to this user account
    /// @param fee fee in tokens to be paid for the end user help.
    /// @param destination Address to withdraw the full account balance.
    /// @param signature An R,S,V ECDS signature provided by a user.
    function collect(
        uint32 delegate,
        uint32 slotId,
        uint32 toAccountId,
        uint32 payIndex,
        uint64 declaredAmount,
        uint64 fee,
        address destination,
        bytes memory signature
    )
    public{
        require(isAccountOwner(delegate), "invalid delegate");
        _freeSlot(delegate, slotId);
        Account memory acc = accounts[delegate];
        // Check toAccountId is valid
        require(isValidId(toAccountId), "toAccountId must be a valid account id");
        Account memory tacc = accounts[toAccountId];
        require(tacc.owner != 0, "account registration has to be completed");
        // Check payIndex is valid
        require(payIndex > 0 && payIndex <= payments.length, "invalid payIndex, payments is not that long yet");
        require(payIndex > tacc.lastCollectedPaymentId, "account already collected payments up to payIndex");
        require(payments[payIndex - 1].lockTimeoutBlockNumber < block.number,
            "cannot collect payments that can be unlocked");
        // Check if fee is valid
        require(fee <= declaredAmount, "fee is too big, should be smaller than declaredAmount");
        CollectSlot storage sl = collects[delegate][slotId];
        sl.delegate = delegate;
        if (delegate != toAccountId) {
            // If "toAccountId" != delegate, check who signed this transaction
            bytes32 hash =
            keccak256(
            abi.encodePacked(
                address(this), delegate, toAccountId, tacc.lastCollectedPaymentId,
                payIndex, declaredAmount, fee, destination
            ));
            require(Challenge.recoverHelper(hash, signature) == tacc.owner, "Bad user signature");
        }
        sl.minPayIndex = tacc.lastCollectedPaymentId;
        sl.maxPayIndex = payIndex;
        uint64 needed = params.collectStake;
        // check if this is an instant collect
        if (slotId >= instantSlot) {
            sl.delegateAmount = declaredAmount;
            tacc.balance = SafeMath.add64(tacc.balance, SafeMath.sub64(declaredAmount, fee));
            sl.addr = address(0);
            needed = SafeMath.add64(needed, SafeMath.sub64(declaredAmount, fee));
        } else
        {   // not instant-collect
            sl.addr = destination;
            sl.delegateAmount = fee;
        }
        // Check amount & balance
        require(acc.balance >= needed, "not enough funds");
        balanceSub(delegate, needed);
        sl.amount = declaredAmount;
        sl.to = toAccountId;
        sl.block = SafeMath.add64(block.number, params.challengeBlocks);
        sl.status = 1;
        tacc.lastCollectedPaymentId = uint32(payIndex);
        accounts[toAccountId] = tacc;
        // check if the user is withdrawing its balance
        if (destination != address(0) && slotId >= instantSlot) {
            accounts[toAccountId].balance = 0;
            require(token.transfer(destination, tacc.balance), "transfer failed");
        }
        emit Collect(delegate, slotId, toAccountId, tacc.lastCollectedPaymentId, payIndex, declaredAmount);
    }

    /**
     * @dev gets the number of payments issued
     * @return returns the size of the payments array.
     */
    function getPaymentsLength() public view returns (uint) {
        return payments.length;
    }

    /**
     * @dev initiate a challenge game
     * @param delegate id of the delegate that performed the collect operation
     *        in the name of the end-user.
     * @param slot slot used for the challenge game. Every user has a sperate
     *        set of slots
     * @param challenger id of the user account challenging the delegate.
     */
    function challenge_1(
        uint32 delegate,
        uint32 slot,
        uint32 challenger
    )
        public
        validId(delegate)
        onlyAccountOwner(challenger)
    {
        Challenge.challenge_1(collects[delegate][slot], params, accounts, challenger);
        emit Challenge1(delegate, slot, challenger);
    }

    /**
     * @dev The delegate provides the list of payments that mentions the enduser
     * @param delegate id of the delegate performing the collect operation
     * @param slot slot used for the operation
     * @param data binary list of payment indexes associated with this collect operation.
     */
    function challenge_2(
        uint32 delegate,
        uint32 slot,
        bytes memory data
    )
        public
        onlyAccountOwner(delegate)
    {
        Challenge.challenge_2(collects[delegate][slot], params, data);
        emit Challenge2(delegate, slot);
    }

    /**
     * @dev the Challenger chooses a single index into the delegate provided data list
     * @param delegate id of the delegate performing the collect operation
     * @param slot slot used for the operation
     * @param data binary list of payment indexes associated with this collect operation.
     * @param index index into the data array for the payment id selected by the challenger
     */
    function challenge_3(
        uint32 delegate,
        uint32 slot,
        bytes memory data,
        uint32 index
    )
        public
        validId(delegate)
    {
        require(isAccountOwner(collects[delegate][slot].challenger), "only challenger can call challenge_2");

        Challenge.challenge_3(collects[delegate][slot], params, data, index);
        emit Challenge3(delegate, slot, index);
    }

    /**
     * @dev the delegate provides proof that the destination account was
     *      included on that payment, winning the game
     * @param delegate id of the delegate performing the collect operation
     * @param slot slot used for the operation
     */
    function challenge_4(
        uint32 delegate,
        uint32 slot,
        bytes memory payData
    )
        public
        onlyAccountOwner(delegate)
    {
        Challenge.challenge_4(
            collects[delegate][slot],
            payments,
            payData
            );
        emit Challenge4(delegate, slot);
    }

    /**
     * @dev the challenge was completed successfully. The delegate stake is slashed.
     * @param delegate id of the delegate performing the collect operation
     * @param slot slot used for the operation
     */
    function challenge_success(
        uint32 delegate,
        uint32 slot
    )
        public
        validId(delegate)
    {
        Challenge.challenge_success(collects[delegate][slot], params, accounts);
        emit ChallengeSuccess(delegate, slot);
    }

    /**
     * @dev The delegate won the challenge game. He gets the challenge stake.
     * @param delegate id of the delegate performing the collect operation
     * @param slot slot used for the operation
     */
    function challenge_failed(
        uint32 delegate,
        uint32 slot
    )
        public
        onlyAccountOwner(delegate)
    {
        Challenge.challenge_failed(collects[delegate][slot], params, accounts);
        emit ChallengeFailed(delegate, slot);
    }

    /// @dev release a slot used for the collect channel game, if the challenge game has ended.
    ///      This function is private. There is a public version
    /// @param delegate id of the account requesting the release operation
    /// @param slot id of the slot requested for the duration of the challenge game
    function _freeSlot(uint32 delegate, uint32 slot) private {
        CollectSlot memory s = collects[delegate][slot];

        if (s.status == 0) return;

        require(s.status == 1 && block.number >= s.block, "slot not available");

        // Refund Stake
        balanceAdd(delegate, SafeMath.add64(s.delegateAmount, params.collectStake));

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
}
