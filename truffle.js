const solcVersion = '0.4.25'

// To prevent truffle from complaining 'provider' isn't defined when compiling
const ProviderEngine = require('web3-provider-engine')
const provider = new ProviderEngine()

const { GanacheSubprovider } = require('@0x/subproviders')

const { CoverageSubprovider } = require('@0x/sol-coverage')
const { TruffleArtifactAdapter } = require('@0x/sol-trace')

const projectRoot = ''
const defaultFromAddress = '0x5409ed021d9299bf6814279a6a1411a7e866a631'
const isVerbose = true
const artifactAdapter = new TruffleArtifactAdapter(projectRoot, solcVersion)

global.coverageSubprovider = new CoverageSubprovider(
  artifactAdapter,
  defaultFromAddress,
  isVerbose
)

provider.addProvider(global.coverageSubprovider)

const ganacheSubprovider = new GanacheSubprovider({
  'default_balance_ether': '1000000000000000000000000',
  'total_accounts': 10,
  'port': 8545,
})

provider.addProvider(ganacheSubprovider)

provider.start(err => {
  if (err !== undefined) {
    console.log(err)
    process.exit(1)
  }
})

module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*' // Match any network id
    },
    coverage: {
      provider,
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
