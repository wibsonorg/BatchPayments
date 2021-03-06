# BatPay :anger: Gas conscious batch payments.
[![Build Status](https://travis-ci.com/wibsonorg/BatchPayments.svg?token=k5H2Cw9NKvrr4RbRXrEA&branch=master)](https://travis-ci.com/wibsonorg/BatchPayments)
[![codecov.io](https://codecov.io/gh/wibsonorg/BatchPayments/branch/master/graphs/badge.svg?token=MBTgdNZ5fr)](https://codecov.io/gh/wibsonorg/BatchPayments/)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://github.com/wibsonorg/BatchPayments/blob/master/LICENSE)

A payment scaling solution to reduce gas costs associated with operating with ERC20 tokens on the ethereum blockchain.

## Summary

BatchPayment is a proxy contract for the transfer of ERC20 tokens. It is suitable for micropayments in one-to-many and few-to-many scenarios, including digital markets, reward and dividends distribution.

In BatchPayment many similar operations are bundled together into a single transaction in order to optimize gas consumption. In addition, some costly verifications are replaced by a challenge game, pushing most of the computing cost off-chain. This results in a 100x gas reduction in transfer costs, achieving ~1700 tps on the ethereum blockchain.  

In addition, it includes many relevant features, like meta-transactions for end-user operation without ether, and key-locked transfers for atomic exchange of digital goods.

### Main Features
- Cost of 300-1000 gas per payment (depending on operating parameters).
- No data availability issues.
- No bottlenecks for normal operation or challenge games.
- Meta-transactions for ether-less operations of end-users.
- Support for immediate withdrawal.   
- Key-locked transfers for supporting atomic exchange of digital goods.
- Bulk-registration for inexpensive reservation of ids for new users.

### General Overview

1. Registration of all parties involved, where 32-bit account ids are used.
2. Buyers initiate payments by issuing a registerPayment transaction, which includes a per-destination amount and a somewhat-compressed list of seller-ids.
3. Sellers wait to accumulate enough payments, then send a collect transaction specifying a range of payments and a total amount corresponding to their account.
4. After a challenge period, the requested amount is added to the seller's balance.
5. In the case of dispute, the seller lists the individual payments in which she is included. The challenger selects a single payment and requests a proof of inclusion. The loser pays for the verification game (stake).

### Other Related Approaches
- Payment Pools: Use of Merkle proofs for batch-payments (see e.g. [1], [2], or [3]).
- BatLog: A solution for periodic reward distribution (see [4]).
- EIP1035: Transaction execution batching and delegation (see [5]).
- Payment Channels: Scalability through offchain channels, e.g. Raiden, Perun, Counterfactual, Machimony, Celer, Connext, etc..
- Plasma Chain: Scalability through child chains, e.g. PlasmaCash or PlasmaDebit. More.
- Batch-Payments Using zk-Snarks: Scalability through verifiable offchain computation (see [6]).

## Reporting Security Vulnerabilities
If you think that you have found a security issue in BatchPayments, please **DO NOT** post it as a Github issue and don't publish it publicly. Instead, all security issues must be sent to developers@wibson.org.
We appreciate your discretion and will give the corresponding credit to the reporter(s).

## Getting started
### Setup
##### Using docker
Setup docker, then run `docker-compose up` to get truffle & ganache-cli running.
Then, in a different terminal, run `./docker-run.sh`

##### Local installation
Install dependencies:
```bash
$ npm i
```
Run the test suite to check everything is going smoothly:
```
$ npx ganache-cli
$ npm run test
```
### Using Batch Payments library
```javascript
const { Batpay } = require('../lib')(web3, artifacts)

// Initialize Baypay
batpay = new Batpay.BP(
    batpayContractInstance,
    yourTokenContractInstance
)

batpay.init()

// Start registering Batch Payments
batpay.registerPayment(...)
```

Take a look at [this example](src/demo.js) for a walkthrough most of BatPay features.

    $ npx truffle exec src/demo.js

#### Getting Benchmark Data
The following command will execute BatchPayments and measure gas usage, producing a detailed report

    $ npx truffle exec src/benchmarks.js

### Using Batch Payments contracts
#### Simple example
Run the following command to complete a couple of basic operations on BP.

    $ npx truffle exec src/run.js

#### Configuration
In order to configure deployments and general usage, the `deploy.json` file must be set up.
You can start by copying the `deploy.example.json` file, renaming it and editing it as suitable.

```bash
$ cp deploy.example.json deploy.json
$ vi deploy.json
```

The structure is the following:
* `environments`: Allowed keys are the ones declared in the [truffle.js](truffle.js) file. Feel free to add more.
* Environment options:
    * `publicNode`: Public Node to use in the `HDWalletProvider`.
    * `privateKeys`: Private keys used by truffle, the first one will be the deployer account (used in remote environments).
    * `deployedToken`: Optionally, an address of a previously deployed ERC20 token can be used to deploy a new BatPay instance. This property can be defined in any environment.
    * `batPay`: The parameters to be used in the constructor of the BatPay smart contract.

## Detailed description
The BatchPayment contract can be instantiated to act as an optimization proxy for a standard pre existing ERC20 token contract. User and contract accounts can use it to relay batch micropayments with a 100x lower gas footprint.

### Roles
There are five different roles on the BatchPayment ecosystem: buyer, seller, unlocker, delegate and monitor.
Players may interact with BatchPayment in  more than one of these roles, depending on the circumstance. All roles will be identified by an account id obtained during registration.

#### Buyer
The buyer deposits tokens into the BatchPayment contract, and uses her balance to pay sellers.

#### Seller
The seller participates in several operations with one or many buyers, and collects afterwards her earnings in her account. The balance could be withdrawn into an ERC20 token account.

#### Unlocker
The unlocker looks for a locked payment issued by a buyer, which references a key she possess, and provides the required key in exchange for a fee. This releases the payment to both sellers and unlocker.

#### Delegate
Delegates simplify the experience of sellers by allowing them to interact with the BatchPayment contract on their behalf in exchange for a fee.

#### Monitor
The monitor subscribes to events associated with the BatchPayment contract, recording outstanding not-yet-collected balances and issuing challenges whenever a delegate performs an inconsistent operation.



### Data structures
There are four data structures maintained on contract storage.  Accounts, payments, bulkRecords and collectSlots.

**Account** is an array which stores the account address, balance and latest collected payment associated with an id.

**BulkRegistration** is an array used to store information about ids reservation, including the merkle-tree root hash which will allow a user to later claim an individual id, and associate it with her address.

**Payment** is an array which stores the per-destination amount, the hash of the destination list, as well as other miscellaneous elements associated with each individual payment.

**CollectSlot** is a map used to open and manage the collect-challenge game, it stores several attributes associated with the challenge state.

### Mechanics

#### Contract Instantiation
When the BatchPayment contract is instantiated, the address of a contract implementing the IERC20 interface is supplied. This address is stored to be used later, and cannot be changed. All deposit and withdrawal operations are performed through this address.

#### Registration
Everyone who wants to interact with the BatchPayment contract, needs to register his address to obtain an associated account id. This can be performed using one of the available registration methods.

In some cases, paying for registration costs upfront could be prohibitive. For example, the seller may disengage and not participate in a significant number of operations to amortize the registration costs. In this case, direct registration is not attractive and bulkRegistration can be used instead. Bulk Registration can simultaneously register 1000s of accounts, while paying for a single transaction cost.

**Direct registration**
The registration function can be used to obtain a new account id, initializing its balance to 0.

Alternatively, executing a deposit operation with a user id of -1, would register a new account and associate it with the sender address, initializing its balance to the provided amount.


**Bulk Registration**
The bulkRegistration function can be used to reserve a range of ids simultaneously. The sender specifies the number of accounts to reserve and provides the root hash of the merkle tree holding the list of addresses. This information is saved on contract storage to allow verification.

At a later time, the claimBulkRegistrationId function can be used to assign an address to a pre-reserved account. The sender specifies the account-id, the bulkRegistration-id, and a merkle proof referencing the address.

**Registration on initial deposit**
In addition, specifying -1 as an account number while sending a token deposit to the BatchPayment contract, will register a new account.

#### Payments funds collection

See [Collect mechanics](docs/collect_mechanics.md).

## Contribute
Thank you for thinking about contributing to Wibson Core. There are many ways you can participate and help build high quality software. Check out the [contribution guide]!

[contribution guide]: CONTRIBUTING.md
