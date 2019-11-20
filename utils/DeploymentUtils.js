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

function getEnvConfig(environment) {
  const config = getConfig();
  const envConfig = config.environments[environment];
  if (!envConfig) {
    const error = `Missing environment ${environment} in deploy.json. ` +
      'Please take a look at the README.md file before continuing.';
    console.error(`\n--> ${error}\n\n`);
    throw new Error(error);
  }
  return envConfig;
}

exports.getEnvConfig = getEnvConfig;

exports.getProvider = function getProvider(environment) {
  const config = getConfig();
  const envConfig = config.environments[environment] || {};
  const { privateKeys = [], publicNode = '' } = envConfig;

  const wallet = new HDWalletProvider(privateKeys, publicNode, 0, privateKeys.length, true);
  return wallet;
};
