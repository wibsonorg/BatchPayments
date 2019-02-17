const Merkle = artifacts.require('./Merkle');

module.exports = function(deployer) {
    return deployer.deploy(Merkle);
}

    
