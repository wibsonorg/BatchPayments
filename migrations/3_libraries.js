const Merkle = artifacts.require('./Merkle');
const Challenge = artifacts.require('./Challenge');

module.exports = function(deployer) {
    return Promise.all(
        deployer.deploy(Merkle),
        deployer.deploy(Challenge));
}

    
