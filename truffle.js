const HDWalletProvider = require("truffle-hdwallet-provider")


// const mnemonic = process.env.MNEMONIC
const mnemonic = "enroll armor soldier bone museum fault differ kitten dice dilemma casual scale"


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
          return new HDWalletProvider(mnemonic, "https://ropsten.infura.io/v3/c5f5893be7804494af4b2027dfad9d3b")
        },
        network_id: "3",
      }
    },
    solc: {
      optimizer: {
          enabled: true,
          runs: 200
      }
  }

};
