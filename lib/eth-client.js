const assert = require('assert')
const semver = require('semver')

const EthClient = {
  async nickname () {
    return (await this.checkVersion())[0]
  },

  async version () {
    return (await this.checkVersion())[1]
  },

  async checkVersion () {
    let matches = {}
    const allowedClients = {
      'geth': /Geth\/v([0-9.]+)/,
      'ganache': /TestRPC\/v([0-9.]+)\/ethereum-js/
    }
    const fullVersion = await this._fullVersion()

    Object.keys(allowedClients).map(async (key, _) => {
      matches[key] = allowedClients[key].exec(fullVersion)
    })

    const filteredMatches = Object.entries(matches).filter(a => a[1])
    assert(filteredMatches.length === 1, 'One and only one client should match')
    let [client, match] = filteredMatches.pop()

    assert(
      (client === 'ganache' && semver.satisfies(match[1], '2.5.x')) ||
        (client === 'geth' && semver.satisfies(match[1], '1.8.x')),
      `I don't know how handle the current client ${fullVersion}`
    )
    return [client, match[1]]
  },

  _fullVersion () {
    return new Promise((resolve, reject) => {
      web3.version.getNode(EthClient._web3Callback(resolve, reject))
    })
  },

  _web3Callback (resolve, reject) {
    console.log('web3 callback')
    return (error, value) => {
      if (error) reject(error)
      else resolve(value)
    }
  }
}

module.exports = EthClient
