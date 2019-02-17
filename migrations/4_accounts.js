const Merkle = artifacts.require('./Merkle');
const Accounts = artifacts.require('./Accounts');

module.exports = function(deployer) {
    deployer.link(Merkle, Accounts);
    return deployer.deploy(Accounts);    
}

