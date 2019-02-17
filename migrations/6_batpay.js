const BatPay = artifacts.require('./BatPay');
const StandardToken = artifacts.require('./StandardToken');
const Merkle = artifacts.require('./Merkle');
const Payments = artifacts.require('./Payments');
const Accounts = artifacts.require('./Accounts');

module.exports = function(deployer) {
    deployer.link(Merkle, BatPay);
    deployer.link(Accounts, BatPay);
    deployer.link(Payments, BatPay);	
    
    return StandardToken.deployed().then(token=>{
            return deployer.deploy(BatPay, token.address);            
        });
};
