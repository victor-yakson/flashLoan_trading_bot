const { ethers } = require("ethers");
const hre = require("hardhat");
require("dotenv").config();

/**
 * This file could be used for initializing some
 * of the main contracts such as the V2 router &
 * factory. This is also where we initialize the
 * main Arbitrage contract.
 */

const config = require("../config.json");
const IPancakeswapV2Router02 = require("@uniswap/v2-periphery/build/IUniswapV2Router02.json");
const IPancakeswapV2Factory = require("@uniswap/v2-core/build/IUniswapV2Factory.json");
const IPancakeswapV3Router03 = require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json");
const IPancakeswapV3Factory = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json");
let provider ,signer;

if (config.PROJECT_SETTINGS.isLocal) {
  // provider = new hre.ethers.WebSocketProvider()
  provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545/"); // Using JsonRpcProvider for local development
} else {
  provider = new ethers.providers.JsonRpcProvider(
    `${process.env.MAINNET_PROVIDER_URL}`
  );
}
signer = provider.getSigner()


// -- SETUP UNISWAP/SUSHISWAP CONTRACTS -- //
const pV2Factory = new hre.ethers.Contract(
  config.PANCAKESWAPV2.FACTORY_ADDRESS,
  IPancakeswapV2Factory.abi,
  provider
);
const pV2Router = new hre.ethers.Contract(
  config.PANCAKESWAPV2.V2_ROUTER_02_ADDRESS,
  IPancakeswapV2Router02.abi,
  provider
);
const pV3Factory = new hre.ethers.Contract(
  config.PANCAKESWAPV3.FACTORY_ADDRESS,
  IPancakeswapV3Factory.abi,
  provider
);
const pV3Router = new hre.ethers.Contract(
  config.PANCAKESWAPV3.V3_ROUTER_03_ADDRESS,
  IPancakeswapV3Router03.abi,
  provider
);

const IArbitrage = require("../artifacts/contracts/FlashLoan.sol/FlashLoan.json");
const arbitrage = new hre.ethers.Contract(
  config.PROJECT_SETTINGS.ARBITRAGE_ADDRESS,
  IArbitrage.abi,
  provider
);

module.exports = {
  provider,
  pV2Factory,
  pV2Router,
  pV3Factory,
  pV3Router,
  arbitrage,
  signer
};
