const Merkle = artifacts.require('./Merkle');
const Challenge = artifacts.require('./Challenge');
const MassExitLib = artifacts.require('./MassExitLib');

module.exports = function(deployer) {
    deployer.then(()=>{
        return deployer.deploy(Merkle);
    }).then(()=>{
        return deployer.deploy(Challenge);
    }).then(()=>{
        deployer.link(Challenge, MassExitLib);
        return deployer.deploy(MassExitLib);
    });
}

    
