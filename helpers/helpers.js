const ethers = require("ethers");
const Big = require("big.js");

/**
 * This file could be used for adding functions you
 * may need to call multiple times or as a way to
 * abstract logic from bot.js. Feel free to add
 * in your own functions you desire here!
 */

const IPancakeswapV2Pair = require("@uniswap/v2-core/build/IUniswapV2Pair.json");
const IPancakeswapV3Pair = require("@pancakeswap/v3-core/artifacts/contracts/PancakeV3Pool.sol/PancakeV3Pool.json");
const IERC20 = require("@openzeppelin/contracts/build/contracts/ERC20.json");
const { log } = require("console");

async function getTokenAndContract(_token0Address, _token1Address, _provider) {
  const token0Contract = new ethers.Contract(
    _token0Address,
    IERC20.abi,
    _provider
  );
  const token1Contract = new ethers.Contract(
    _token1Address,
    IERC20.abi,
    _provider
  );

  const token0 = {
    address: _token0Address,
    decimals: 18,
    symbol: await token0Contract.symbol(),
    name: await token0Contract.name(),
  };

  const token1 = {
    address: _token1Address,
    decimals: 18,
    symbol: await token1Contract.symbol(),
    name: await token1Contract.name(),
  };

  return { token0Contract, token1Contract, token0, token1 };
}

async function getPairAddress(_Factory, _token0, _token1, _fee, _isV3) {
  if (_isV3) {
    const pairAddressV3 = await _Factory.getPool(_token0, _token1, _fee); // Replace with actual v3 method

    return pairAddressV3;
  } else {
    // Fallback to v2 logic
    const pairAddressV3 = await _Factory.getPair(_token0, _token1);
    return pairAddressV3;
  }
}

async function getPairContract(
  _Factory,
  _token0,
  _token1,
  _fee,
  _isV3,
  _provider
) {
  const pairAddress = await getPairAddress(
    _Factory,
    _token0,
    _token1,
    _fee,
    _isV3
  );

  if (_isV3) {
    const pairContract = new ethers.Contract(
      pairAddress,
      IPancakeswapV3Pair.abi,
      _provider
    );
    return pairContract;
  } else {
    const pairContract = new ethers.Contract(
      pairAddress,
      IPancakeswapV2Pair.abi,
      _provider
    );

    return pairContract;
  }
}

async function getReserves(_pairContract, _provider, _isV3) {
  if (_isV3) {
    try {
      const token0 = await _pairContract.token0();
      const token1 = await _pairContract.token1();
      const { token0Contract, token1Contract } = getTokenAndContract(
        token0,
        token1,
        _provider
      );
      const pairAddress = _pairContract.address;
      const reserve0 = await token0Contract.balanceOf(pairAddress);
      const reserve1 = await token1Contract.balanceOf(pairAddress);

      console.log("Reserve0:", reserve0);
      console.log("Reserve1:", reserve1);
      return [reserve0, reserve1];
    } catch (error) {
      console.error("Error fetching reserves:", error);
    }
  } else {
  
    const reserves = await _pairContract.getReserves();
    return [reserves.reserve0, reserves.reserve1];
  }
}

async function calculatePrice(_pairContract, _provider, _isV3) {
  const [x, y] = await getReserves(_pairContract, _provider, _isV3);
  return Big(x).div(Big(y));
}

async function calculateDifference(_pV2Price, _pV3Price) {
  return (((_pV3Price - _pV2Price) / _pV2Price) * 100).toFixed(2);
}

async function simulate(_amount, _routerPath, _token0, _token1) {
  const trade1 = await _routerPath[0].getAmountsOut(_amount, [
    _token0.address,
    _token1.address,
  ]);
  const trade2 = await _routerPath[1].getAmountsOut(trade1[1], [
    _token1.address,
    _token0.address,
  ]);

  const amountIn = ethers.formatUnits(trade1[0], "ether");
  const amountOut = ethers.formatUnits(trade2[1], "ether");

  return { amountIn, amountOut };
}

module.exports = {
  getTokenAndContract,
  getPairAddress,
  getPairContract,
  getReserves,
  calculatePrice,
  calculateDifference,
  simulate,
};
