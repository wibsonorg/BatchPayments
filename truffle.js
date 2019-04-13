const coverageWeb3Provider = require('./lib/CoverageWeb3Provider')

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
