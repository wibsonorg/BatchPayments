const coverageWeb3Provider = require('./lib/CoverageWeb3Provider')
const DeployUtils = require('./utils/DeploymentUtils');

module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*' // Match any network id
    },
    coverage: {
      provider: coverageWeb3Provider,
      network_id: '*'
    },
    remoteDevelopment: { // 'development' collides with truffle's default
      provider: () => DeployUtils.getProvider('ropsten', 'remoteDevelopment'),
      network_id: 3, // official id of the ropsten network
      gasPrice: 1 * 1000000000,
      gas: 7900000
    },
    staging: {
      provider: () => DeployUtils.getProvider('ropsten', 'staging'),
      network_id: 3, // official id of the ropsten network
      gasPrice: 1 * 1000000000,
    },
    production: {
      provider: () => DeployUtils.getProvider('mainnet', 'production'),
      network_id: 1,
      gasPrice: 3 * 1000000000,
      gas: 7900000,
    },
    localChain: {
      host: '127.0.0.1',
      port: 2545,
      network_id: 987
    },
    rsk: {
      provider: () => DeployUtils.getProvider('testnet', 'rsk'),
      host: 'https://public-node.testnet.rsk.co/',
      port: 443,
      network_id: '*',
      gasPrice: 1 * 1000000000,
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 1
    }
  },
  mocha: {
    timeout: 60000 // Huge timeout for running coverage on Travis CI.
  }
}
