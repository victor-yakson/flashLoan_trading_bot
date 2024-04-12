const { HardhatUserConfig } = require("hardhat/config");
require("@nomicfoundation/hardhat-toolbox");
const dotenv = require("dotenv");
dotenv.config();

// npx hardhat node --port 8700

const mainnet_provider_url = process.env.MAINNET_PROVIDER_URL;
const testnet_provider_url = process.env.TESTNET_PROVIDER_URL;
const private_key = process.env.PRIVATE_KEY;

const config = {
  solidity: {
    compilers: [
      {
        version: "0.8.10",
      },
      {
        version: "0.8.13",
      },
    ],
  },
  networks: {
    hardhat: {
      forking: {
        url: mainnet_provider_url,
      },
    },
    testnet: {
      url: testnet_provider_url,
      chainId: 97,
      accounts: [private_key],
    },
    mainnet: {
      url: mainnet_provider_url,
      chainId: 56,
      accounts: [private_key],
    },
  },
};

module.exports = config;
