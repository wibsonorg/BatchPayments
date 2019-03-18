FROM ubuntu:xenial

# Install dependencies and tools
RUN apt-get update \
    && apt-get install -y wget software-properties-common git python jq curl vim wget less\
    && rm -rf /var/lib/apt/lists/*

# Install node, gulp, yarn
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y nodejs
RUN npm install gulp -g
RUN npm install yarn -g

# Enable Ethereum launchpad repository
RUN add-apt-repository -y ppa:ethereum/ethereum

# Install Ethereum tooling
RUN apt-get update \
    && apt-get install -y ethereum
RUN yarn global add truffle@4 ganache-cli truffle-assertions

# Set working directory
WORKDIR /src

COPY config/testchain config/testchain

# Bootstrap a new genesis block
RUN geth --identity "MyTestNode" init config/testchain/genesis.json --datadir config/testchain/data
