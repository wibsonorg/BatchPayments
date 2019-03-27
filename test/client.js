const semver = require('semver')


const Client = {
    fullVersion: web3.version.node,

    nickname() {
        return this.checkVersion()[0]
    },

    version() {
        return this.checkVersion()[1]
    },

    checkVersion() {
        let matches = {}
        const allowedClients = {
            "geth": /Geth\/v([0-9.]+)/,
            "ganache": /TestRPC\/v([0-9.]+)\/ethereum-js/
        }

        Object.keys(allowedClients).map( (key, _) => {
            matches[key] = allowedClients[key].exec(this.fullVersion)
        })

        const filteredMatches = Object.entries(matches).filter( a => a[1] )
        assert(filteredMatches.length === 1, "One and only one client should match")
        let [client, match] = filteredMatches.pop()

        assert(
            ( client === 'ganache' && semver.satisfies(match[1], '2.5.x') ) ||
                ( client === 'geth' && semver.satisfies(match[1], '1.8.x') ),
            `I don't know how to catch errors for the current client ${this.fullVersion}`
        )
        return [client, match[1]]
    }
}

module.exports = Client
