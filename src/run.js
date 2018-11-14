var lib = require('../lib')(web3, artifacts);
var merkle = lib.merkle;


module.exports = function() {
    var w = merkle.merkle([1,2,3,4]);

    console.log(w);

}