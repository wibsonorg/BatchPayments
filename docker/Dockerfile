# Node image
FROM node:10

# Create code directory
RUN mkdir /src

# Set working directory
WORKDIR /src

# Install Truffle
RUN apt-get update && apt-get -y install vim curl wget git less
RUN yarn global add truffle ganache-cli

