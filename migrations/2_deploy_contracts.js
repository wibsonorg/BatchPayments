const BatPay = artifacts.require('./BatPay');
const StandardToken = artifacts.require('./StandardToken');
const TestHelper = artifacts.require('./TestHelper');
const Merkle = artifacts.require('./Merkle');


module.exports = function(deployer) {
	async function doDeploy(deployer) {
		deployer.deploy(StandardToken, "Token", "TOK", 2, 1000000);
		let i = await StandardToken.deployed();

		deployer.deploy(BatPay, i.address);
		BatPay.deployed();
		
		await deployer.deploy(TestHelper);
		await TestHelper.deployed();
	}
	doDeploy(deployer);

};
