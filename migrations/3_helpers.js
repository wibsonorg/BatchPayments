const Merkle = artifacts.require('./Merkle');
const Payments = artifacts.require('./Payments');
const Accounts = artifacts.require('./Accounts');

module.exports = function(deployer) {
    deployer.deploy(Merkle);
    deployer.link(Merkle, Accounts);
    deployer.deploy(Accounts);
    deployer.link(Merkle, Payments);
    deployer.link(Accounts, Payments);
    deployer.deploy(Payments);
};
