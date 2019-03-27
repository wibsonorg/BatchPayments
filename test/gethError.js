async function tryCatch(promise, message) {
    assert(message === 'revert', "Message not implemented")
    try {
        await promise;
        throw null;
    }
    catch (error) {
        console.log(error, message)
        assert(error, "Expected an error but did not get one");

        let transactionTrace = await web3.currentProvider.send({
            method: "debug_traceTransaction",
            params: [error.tx, {}],
            jsonrpc: "2.0",
            id: new Date().getTime()
        })

        if (transactionTrace.result) {
            assert(asd.result.structLogs.pop().op === 'REVERT')
        } else {
            assert(false, "Error while trying to trace transaction.")
        }
    }
};


module.exports = async function(promise, message) { await tryCatch(promise, message) }
