const TestHelper = artifacts.require('./TestHelper');
const Merkle = artifacts.require('./Merkle');

module.exports = function(deployer) {    
    deployer.link(Merkle,TestHelper);
    return deployer.deploy(TestHelper);
};
