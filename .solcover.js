module.exports = {
	port: 8555,
	testCommand: '../node_modules/.bin/truffle test --network coverage',
	compileCommand: '../node_modules/.bin/truffle compile --network coverage',
	norpc: true,
	copyPackages: ['zeppelin-solidity'],
};
