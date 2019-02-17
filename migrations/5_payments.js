const Merkle = artifacts.require('./Merkle');
const Accounts = artifacts.require('./Accounts');
const Payments = artifacts.require('./Payments');

module.exports = function(deployer) {
    deployer.link(Merkle, Payments);
    deployer.link(Accounts, Payments);
    return deployer.deploy(Payments);
}
 
