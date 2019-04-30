const fs = require('fs');
const path = require('path');
const HDWalletProvider = require('truffle-hdwallet-provider'); // eslint-disable-line import/no-extraneous-dependencies

function getConfig() {
  try {
    const configFile = path.resolve(__dirname, '../deploy.json');
    return JSON.parse(fs.readFileSync(configFile, 'utf8'));
  } catch (err) {
    console.error('\n--> Missing deploy.json. ' + // eslint-disable-line no-console
        'Please take a look at the README.md file before continuing.\n\n');
    throw err;
  }
}

exports.getEnvConfig = function getEnvConfig(environment) {
  const config = getConfig();
  return config.environments[environment] || {};
};

exports.getProvider = function getProvider(network, environment) {
  const config = getConfig();
  const envConfig = config.environments[environment] || {};
  const infura = `https://${network}.infura.io/v3/${config.infuraToken}`;
  const privKeys = envConfig.privateKeys;
  return new HDWalletProvider(privKeys, infura, 0, privKeys.length, false);
};
