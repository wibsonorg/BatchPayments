# Exceptions hooks

exit_hook() {
    exit_container
    exit_eth_client
}

exit_container() {
    # If running, gracefully terminate container process.
    [ -z "$containerPID" ] && return
    echo
    echo "$green[I]$nocolor Terminating container instance."
    
    sudo killall docker-compose
}

exit_eth_client() {
    # If running, gracefully terminate client process.
    [ -z "$ethclientPID" ] && return
    echo
    echo "$green[I]$nocolor Terminating client instance."
    
    kill -0 $ethclientPID 2> /dev/null
    kill $ethclientPID
}
