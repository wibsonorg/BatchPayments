module.exports = {
	    port: 8555,
	# testrpcOptions: '-p 8545', //-u 0x54fd80d6ae7584d8e9a19fe1df43f04e5282cc43',
	    testCommand: 'truffle test --network coverage',
	    compileCommand: 'truffle compile', 
	    norpc: true,
	    dir: './SecretDir',
	    copyPackages: ['zeppelin-solidity'],
	    skipFiles: ['Routers/EtherRouter.sol']
};
