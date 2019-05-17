BigNumber = web3.utils.BN

module.exports = {
  MAX_UINT32: new BigNumber('2').pow(new BigNumber('32')).sub(new BigNumber('1')),
  MAX_UINT64: new BigNumber('2').pow(new BigNumber('64')).sub(new BigNumber('1')),
  MAX_UINT256: new BigNumber('2').pow(new BigNumber('256')).sub(new BigNumber('1'))
}
