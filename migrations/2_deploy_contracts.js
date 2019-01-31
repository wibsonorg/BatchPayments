const BatPay = artifacts.require('./BatPay');
const StandardToken = artifacts.require('./StandardToken');
const TestHelper = artifacts.require('./TestHelper');
const Merkle = artifacts.require('./Merkle');
const Challenge = artifacts.require('./Challenge');

module.exports = function(deployer) {
	async function doDeploy(deployer) {
		deployer.deploy(StandardToken, "Token", "TOK", 2, 1000000);
		let i = await StandardToken.deployed();

		deployer.deploy(Merkle);
		deployer.deploy(Challenge);
		deployer.link(Challenge, BatPay);
		deployer.link(Merkle, BatPay);
		deployer.deploy(BatPay, i.address);
		await BatPay.deployed();
		
		deployer.link(Merkle, TestHelper);
		deployer.deploy(TestHelper);
		await TestHelper.deployed();
	}
	doDeploy(deployer);
};
