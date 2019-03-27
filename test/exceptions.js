const semver = require('semver')

const Client = require('./client.js')
const catchGanacheError = require('./ganacheError.js')
const catchGethError = require('./gethError.js')


let catchError
if (Client.nickname() === 'ganache') {
    catchError = catchGanacheError 
    // catchError = catchGethError // DEBUG
} else if (Client.nickname() === 'geth') {
    catchError = catchGethError
}
module.exports = catchError
