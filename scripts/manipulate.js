require("dotenv").config();
const { ethers } = require("ethers");
const hre = require("hardhat");

// -- IMPORT HELPER FUNCTIONS & CONFIG -- //
const {
  getTokenAndContract,
  getPairContract,
  calculatePrice,
} = require("../helpers/helpers");
const {
  provider,
  pV3Factory,
  pV3Router,
  pV2Factory,
  pV2Router,
  signer,
} = require("../helpers/initialization.js");
let v3pair, v2pair, amount, isV3, fee;

isV3 = true;
fee = 500;
// -- CONFIGURE VALUES HERE -- //
const V2_FACTORY_TO_USE = pV2Factory;
const V2_ROUTER_TO_USE = pV2Router;

const UNLOCKED_ACCOUNT = "0xF977814e90dA44bFA03b6295A0616a897441aceC"; // cake account to impersonate
const AMOUNT = "54045163"; //  Tokens will automatically be converted to wei

async function main() {
  // Fetch contracts
  const {
    token0Contract,
    token1Contract,
    token0: ARB_FOR,
    token1: ARB_AGAINST,
  } = await getTokenAndContract(
    process.env.ARB_FOR,
    process.env.ARB_AGAINST,

    provider
  );

  const pair = await getPairContract(
    V2_FACTORY_TO_USE,
    ARB_FOR.address,
    ARB_AGAINST.address,
    fee,
    !isV3,
    signer
  );

  // Fetch price of SHIB/WETH before we execute the swap
  const priceBefore = await calculatePrice(pair, provider, !isV3);



  await manipulatePrice([ARB_FOR, ARB_AGAINST], token0Contract);

  // Fetch price of SHIB/WETH after the swap
  const priceAfter = await calculatePrice(pair, provider, !isV3);

  const data = {
    "Price Before": `1 cake = ${Number(priceBefore).toFixed(4)} Busd`,
    "Price After": `1 Cake = ${Number(priceAfter).toFixed(4)} Busd`,
  };

  console.table(data);
}

async function manipulatePrice(_path, _token0Contract) {
  console.log(`\nBeginning Swap...\n`);

  console.log(`Input Token: ${_path[0].symbol}`);
  console.log(`Output Token: ${_path[1].symbol}\n`);

  const amount = ethers.utils.parseUnits(AMOUNT, "ether");
  const path = [_path[0].address, _path[1].address];
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [UNLOCKED_ACCOUNT],
  });

  const signer = await hre.ethers.getSigner(UNLOCKED_ACCOUNT);

  const approval = await _token0Contract
    .connect(signer)
    .approve(V2_ROUTER_TO_USE.address, amount, { gasLimit: 50000 });
  await approval.wait();

  const swap = await V2_ROUTER_TO_USE.connect(signer).swapExactTokensForTokens(
    amount,
    0,
    path,
    signer.address,
    deadline,
    { gasLimit: 125000 }
  );
  await swap.wait();

  console.log(`Swap Complete!\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
