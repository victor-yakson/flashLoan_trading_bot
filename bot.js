// -- HANDLE INITIAL SETUP -- //
require("./helpers/server.js");
require("dotenv").config();
const ethers = require("ethers");
const config = require("./config.json");
const {
  getTokenAndContract,
  getPairContract,
  getReserves,
  calculatePrice,
  simulate,
} = require("./helpers/helpers.js");
const {
  provider,
  pV3Factory,
  pV3Router,
  pV2Factory,
  pV2Router,
  arbitrage,
  signer,
} = require("./helpers/initialization.js");
const { json } = require("stream/consumers");
const { log } = require("console");

// -- .ENV VALUES HERE -- //
const arbFor = process.env.ARB_FOR; // This is the address of token we are attempting to arbitrage (cake)
const arbAgainst = process.env.ARB_AGAINST; // Busd
const units = process.env.UNITS; // Used for price display/reporting
const difference = process.env.PRICE_DIFFERENCE;
const gasLimit = process.env.GAS_LIMIT;
const gasPrice = process.env.GAS_PRICE; // Estimated Gas: 0.008453220000006144 ETH + ~10%
const fee = 500;
const isV3 = true;

let v3pair, v2pair, amount;
let isExecuting = false;

const main = async () => {
  const { token0Contract, token1Contract, token0, token1 } =
    await getTokenAndContract(arbFor, arbAgainst, provider);

    console.log(token0Contract, token1Contract);
   
  v2pair = await getPairContract(
    pV2Factory,
    token0.address,
    token1.address,
    fee,
    !isV3,
    signer
  );

  v3pair = await getPairContract(
    pV3Factory,
    token0.address,
    token1.address,
    fee,
    isV3,
    signer
  );

  console.log(`v3pair Address: ${v3pair.address} \n`);
  console.log(`v2pair Address: ${v2pair.address}\n`);

  const blockNumber = await provider.getBlockNumber();
  console.log("block Number", blockNumber);

  v3pair.on("Swap", async () => {
    if (!isExecuting) {
      isExecuting = true;
      const priceDifference = await checkPrice(
        "PANCAKE SWAP V3",
        token0,
        token1
      );

      const routerPath = await determineDirection(priceDifference);

      if (!routerPath) {
        console.log(`No Arbitrage Currently Available\n`);
        console.log(`-----------------------------------------\n`);
        isExecuting = false;
        return;
      }

      const isProfitable = await determineProfitability(
        routerPath,
        token0Contract,
        token0,
        token1
      );

      if (!isProfitable) {
        console.log(`No Arbitrage Currently Available\n`);
        console.log(`-----------------------------------------\n`);
        isExecuting = false;
        return;
      }

      const receipt = await executeTrade(
        routerPath,
        token0Contract,
        token1Contract
      );

      isExecuting = false;
    }
  });

  v2pair.on("Swap", async () => {
    if (!isExecuting) {
      isExecuting = true;

      const priceDifference = await checkPrice(
        "Pancakeswap v2",
        token0,
        token1
      );
      const routerPath = await determineDirection(priceDifference);

      if (!routerPath) {
        console.log(`No Arbitrage Currently Available\n`);
        console.log(`-----------------------------------------\n`);
        isExecuting = false;
        return;
      }

      const isProfitable = await determineProfitability(
        routerPath,
        token0Contract,
        token0,
        token1
      );

      if (!isProfitable) {
        console.log(`No Arbitrage Currently Available\n`);
        console.log(`-----------------------------------------\n`);
        isExecuting = false;
        return;
      }

      const receipt = await executeTrade(
        routerPath,
        token0Contract,
        token1Contract
      );

      isExecuting = false;
    }
  });

  console.log("Waiting for swap event...");
};

const checkPrice = async (_exchange, _token0, _token1) => {
  isExecuting = true;

  console.log(`Swap Initiated on ${_exchange}, Checking Price...\n`);

  const currentBlock = await provider.getBlockNumber();

  const v3Price = await calculatePrice(v3pair, provider, isV3);

  const v2Price = await calculatePrice(v2pair, provider, !isV3);

  const v3FPrice = Number(v3Price).toFixed(units);
  const v2FPrice = Number(v2Price).toFixed(units);
  const priceDifference = (((v3FPrice - v2FPrice) / v2FPrice) * 100).toFixed(2);

  console.log(`Current Block: ${currentBlock}`);
  console.log(`-----------------------------------------`);
  console.log(
    `PANCAKESWAP V3   | ${_token1.symbol}/${_token0.symbol}\t | ${v3FPrice}`
  );
  console.log(
    `PANCAKESWAP V2 | ${_token1.symbol}/${_token0.symbol}\t | ${v2FPrice}\n`
  );
  console.log(`Percentage Difference: ${priceDifference}%\n`);

  return priceDifference;
};

const determineDirection = async (_priceDifference) => {
  console.log(`Determining Direction...\n`);

  if (_priceDifference >= difference) {
    console.log(`Potential Arbitrage Direction:\n`);
    console.log(`Buy\t -->\t Pancakeswap v3`);
    console.log(`Sell\t -->\t PancakeSwap v2\n`);
    return [pV3Router, pV2Router];
  } else if (_priceDifference <= -difference) {
    console.log(`Potential Arbitrage Direction:\n`);
    console.log(`Buy\t -->\t Pancakeswap v2`);
    console.log(`Sell\t -->\t Pancakeswap v3\n`);
    return [pV2Router, pV3Router];
  } else {
    return null;
  }
};

const determineProfitability = async (
  _routerPath,
  _token0Contract,
  _token0,
  _token1
) => {
  console.log(`Determining Profitability...\n`);

  // This is where you can customize your conditions on whether a profitable trade is possible...

  let exchangeToBuy, exchangeToSell;

  if ((await _routerPath[0].getAddress()) === (await pV3Router.getAddress())) {
    exchangeToBuy = "Uniswap";
    exchangeToSell = "Sushiswap";
  } else {
    exchangeToBuy = "Sushiswap";
    exchangeToSell = "Uniswap";
  }

  /**
   * The helper file has quite a few functions that come in handy
   * for performing specifc tasks. Below we call the getReserves()
   * function in the helper to get the reserves of a pair.
   */

  const v3Reserves = await getReserves(v3pair);
  const v2Reserves = await getReserves(v2pair);

  let minAmount;

  if (v3Reserves[0] > v2Reserves[0]) {
    minAmount = BigInt(v2Reserves[0]) / BigInt(2);
  } else {
    minAmount = BigInt(v3Reserves[0]) / BigInt(2);
  }

  try {
    /**
     * See getAmountsIn & getAmountsOut:
     * - https://docs.uniswap.org/contracts/v2/reference/smart-contracts/library#getamountsin
     * - https://docs.uniswap.org/contracts/v2/reference/smart-contracts/library#getamountsout
     */

    // This returns the amount of WETH needed to swap for X amount of SHIB
    const estimate = await _routerPath[0].getAmountsIn(minAmount, [
      _token0.address,
      _token1.address,
    ]);

    // This returns the amount of WETH for swapping X amount of SHIB
    const result = await _routerPath[1].getAmountsOut(estimate[1], [
      _token1.address,
      _token0.address,
    ]);

    console.log(
      `Estimated amount of WETH needed to buy enough Shib on ${exchangeToBuy}\t\t| ${ethers.formatUnits(
        estimate[0],
        "ether"
      )}`
    );
    console.log(
      `Estimated amount of WETH returned after swapping SHIB on ${exchangeToSell}\t| ${ethers.formatUnits(
        result[1],
        "ether"
      )}\n`
    );

    const { amountIn, amountOut } = await simulate(
      estimate[0],
      _routerPath,
      _token0,
      _token1
    );
    const amountDifference = amountOut - amountIn;
    const estimatedGasCost = gasLimit * gasPrice;

    // Fetch account
    const account = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const ethBalanceBefore = ethers.formatUnits(
      await provider.getBalance(account.address),
      "ether"
    );
    const ethBalanceAfter = ethBalanceBefore - estimatedGasCost;

    const wethBalanceBefore = Number(
      ethers.formatUnits(
        await _token0Contract.balanceOf(account.address),
        "ether"
      )
    );
    const wethBalanceAfter = amountDifference + wethBalanceBefore;
    const wethBalanceDifference = wethBalanceAfter - wethBalanceBefore;

    const data = {
      "ETH Balance Before": ethBalanceBefore,
      "ETH Balance After": ethBalanceAfter,
      "ETH Spent (gas)": estimatedGasCost,
      "-": {},
      "WETH Balance BEFORE": wethBalanceBefore,
      "WETH Balance AFTER": wethBalanceAfter,
      "WETH Gained/Lost": wethBalanceDifference,
      "-": {},
      "Total Gained/Lost": wethBalanceDifference - estimatedGasCost,
    };

    console.table(data);
    console.log();

    if (amountOut < amountIn) {
      return false;
    }

    amount = ethers.parseUnits(amountIn, "ether");
    return true;
  } catch (error) {
    console.log(error);
    console.log(`\nError occured while trying to determine profitability...\n`);
    console.log(
      `This can typically happen because of liquidity issues, see README for more information.\n`
    );
    return false;
  }
};

const executeTrade = async (_routerPath, _token0Contract, _token1Contract) => {
  console.log(`Attempting Arbitrage...\n`);

  let startOnUniswap;

  if ((await _routerPath[0].getAddress()) == (await pV3Router.getAddress())) {
    startOnUniswap = true;
  } else {
    startOnUniswap = false;
  }

  // Create Signer
  const account = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  // Fetch token balances before
  const tokenBalanceBefore = await _token0Contract.balanceOf(account.address);
  const ethBalanceBefore = await provider.getBalance(account.address);

  if (config.PROJECT_SETTINGS.isDeployed) {
    const transaction = await arbitrage
      .connect(account)
      .executeTrade(
        startOnUniswap,
        await _token0Contract.getAddress(),
        await _token1Contract.getAddress(),
        amount,
        { gasLimit: process.env.GAS_LIMIT }
      );

    const receipt = await transaction.wait();
  }

  console.log(`Trade Complete:\n`);

  // Fetch token balances after
  const tokenBalanceAfter = await _token0Contract.balanceOf(account.address);
  const ethBalanceAfter = await provider.getBalance(account.address);

  const tokenBalanceDifference = tokenBalanceAfter - tokenBalanceBefore;
  const ethBalanceDifference = ethBalanceBefore - ethBalanceAfter;

  const data = {
    "ETH Balance Before": ethers.formatUnits(ethBalanceBefore, "ether"),
    "ETH Balance After": ethers.formatUnits(ethBalanceAfter, "ether"),
    "ETH Spent (gas)": ethers.formatUnits(
      ethBalanceDifference.toString(),
      "ether"
    ),
    "-": {},
    "WETH Balance BEFORE": ethers.formatUnits(tokenBalanceBefore, "ether"),
    "WETH Balance AFTER": ethers.formatUnits(tokenBalanceAfter, "ether"),
    "WETH Gained/Lost": ethers.formatUnits(
      tokenBalanceDifference.toString(),
      "ether"
    ),
    "-": {},
    "Total Gained/Lost": `${ethers.formatUnits(
      (tokenBalanceDifference - ethBalanceDifference).toString(),
      "ether"
    )} ETH`,
  };

  console.table(data);
};

main();
