const BatPay = artifacts.require('./BatPay');
const StandardToken = artifacts.require('./StandardToken');
const Merkle = artifacts.require('./Merkle');
const Challenge = artifacts.require('./Challenge');


module.exports = function(deployer) {
    deployer.link(Merkle, BatPay);
    deployer.link(Challenge, BatPay);
    deployer.then(()=>{
        return StandardToken.deployed();
    }).then(token=>{
        return deployer.deploy(BatPay, token.address);            
    });
};