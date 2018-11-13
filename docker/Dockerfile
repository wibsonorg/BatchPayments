# Node image
FROM node:latest

# Create code directory
RUN mkdir /src

# Set working directory
WORKDIR /src

# Install Truffle
RUN apt-get update && apt-get -y install vim curl wget git
RUN npm install -g truffle ganache-cli

