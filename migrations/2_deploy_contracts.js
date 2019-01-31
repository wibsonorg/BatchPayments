const BatPay = artifacts.require('./BatPay');
const StandardToken = artifacts.require('./StandardToken');
const TestHelper = artifacts.require('./TestHelper');
const Merkle = artifacts.require('./Merkle');
const Challenge = artifacts.require('./Challenge');

module.exports = function(deployer) {

	let token;

	deployer.deploy(StandardToken, "Token", "TOK", 2, 1000000)
	.then(x=>StandardToken.deployed()).then(i=>{
			token = i;
			return deployer.deploy(Merkle);
		})
	.then(x=>deployer.deploy(Challenge)).then(()=>{
			deployer.link(Challenge, BatPay);
			deployer.link(Merkle, BatPay);	
			deployer.link(Merkle,TestHelper);
			return Merkle.deployed();
		})
	.then(x=>deployer.deploy(TestHelper))
	.then(x=>Challenge.deployed())
	.then(x=>deployer.deploy(BatPay, token.address));
	


};
