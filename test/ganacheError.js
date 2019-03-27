const PREFIX = "VM Exception while processing transaction: ";

async function tryCatch(promise, message) {
    try {
        await promise;
        throw null;
    }
    catch (error) {
        assert(error, "Expected an error but did not get one");
        assert(error.message.startsWith(PREFIX + message), "Expected an error starting with '" + PREFIX + message + "' but got '" + error.message + "' instead");
    }
};


module.exports = async function(promise, type) { await tryCatch(promise, type) }
