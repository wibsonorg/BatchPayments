# Collect Workflow

## Considerations

Sellers are recipient of several small-denomination payment operations (transfer).
Verification for each individual payment could be too expensive to be completed onchain.
Sellers may not have enough funds available to participate on verification games.

## Strategy

1. A delegate will get information from a seller and represent her in a collect/challenge
    game. Chain-history can be inspected to verify correct balance for seller.
2. Delegate will issue a collect operation, specifying seller and balance associated, and
    putting a stake for the collect game.
3. Monitors, will verify the seller/balance and create a challenge if incorrect.
4. If everything is correct, a transfer will be completed for the seller

## Characteristics

Transfers are completed onchain instantly without any verification games.
Collects are verifyied in individual games (no bottlenecks).
There is no data availability problem, everything is published on onchain.
Finality can be delayed during challenges, but the affected user is compensated with the
loser stake.

## Game state machine


States

**0. Empty slot**
    Delegate may call collect(to, payIndex, amount) => 1
    (from payIndex is implied from accounts[to].collected
**1.  CollectGame (amount published)**
    Waiting for a challenger...=> 2
    In case of timeout, freeSlot() => 0
**2. Challenge started**
    Delegate gives ([payIndex0, amount0, payIndex1, amount1 .. payIndexn, amountn])
    => 1
    Timeout, challenge success => 0
**3. Waiting for individual payment selection**
    Challenger gives index, (payIndex, balance) => 4
    timeout, challenge failed => 1
**4. Waiting for proof for payIndex**
    Delegate gives payData for payIndex with right amount: challenge_failed => 1
    Timeout, challenge_success() => 0

## Stakes

The delegate deposits a stake to enter the collect game. (params.collectStake)
The challenger deposits a stake to enter the collectGame (params.challengeStake).
