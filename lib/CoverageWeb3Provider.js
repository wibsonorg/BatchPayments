let coverageWeb3Provider

if (process.env.TEST_COVERAGE) {
  const ProviderEngine = require('web3-provider-engine')
  const { GanacheSubprovider } = require('@0x/subproviders')
  const { CoverageSubprovider } = require('@0x/sol-coverage')
  const { TruffleArtifactAdapter } = require('@0x/sol-coverage')

  const projectRoot = ''
  const solcVersion = '0.4.25'
  const defaultFromAddress = '0x5409ed021d9299bf6814279a6a1411a7e866a631'
  const partialConfig = {
    ignoreFilesGlobs: [
      '**/contracts/Migrations.sol',
      '**/contracts/IERC20.sol',
      '**/contracts/StandardToken.sol',
      '**/contracts/TestHelper.sol',
      '**/contracts/MassExitLib.sol'
    ],
    isVerbose: true
  }

  const artifactAdapter = new TruffleArtifactAdapter(projectRoot, solcVersion)
  coverageWeb3Provider = new ProviderEngine()
  const ganacheSubprovider = new GanacheSubprovider({
    'default_balance_ether': '1000000000000000000000000',
    'total_accounts': 10,
    'port': 8545
  })
  global.coverageSubprovider = new CoverageSubprovider(
    artifactAdapter,
    defaultFromAddress,
    partialConfig
  )

  // It's REALLY important the order in which the providers are added.
  coverageWeb3Provider.addProvider(global.coverageSubprovider)
  coverageWeb3Provider.addProvider(ganacheSubprovider)
  coverageWeb3Provider.start(err => {
    if (err !== undefined) {
      console.log(err)
      process.exit(1)
    }
  })
} else {
  coverageWeb3Provider = undefined
}

module.exports = coverageWeb3Provider
