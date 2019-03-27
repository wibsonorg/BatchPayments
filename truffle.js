const HDWalletProvider = require("truffle-hdwallet-provider")


module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*" // Match any network id
    },
    testchain: {
      host: "127.0.0.1",
      port: 9656,
      network_id: "316507"
    },
    ropsten: {
      provider: () => {
        return new HDWalletProvider(
          process.env.ACCOUNT_MNEMONIC,
          process.env.INFURA_ROPSTEN_ENDPOINT
        )
      },
      network_id: "3",
    },
    coverage: {
      host: "127.0.0.1",
      port: 8555,
      network_id: "*",
      gas: 0xfffffffffff,
      gasPrice: 0x01
    }
  },
  solc: {
    optimizer: {
        enabled: true,
        runs: 200
    }
  }
}
