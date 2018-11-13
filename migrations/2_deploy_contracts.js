const BatPay = artifacts.require('./BatPay');
const StandardToken = artifacts.require('./StandardToken');


module.exports = function(deployer) {
	async function doDeploy(deployer) {
		deployer.deploy(StandardToken, "Token", "TOK", 2, 10000);
		let i = await StandardToken.deployed();

		deployer.deploy(BatPay, i.address);
		
	}
	doDeploy(deployer);

	
};
