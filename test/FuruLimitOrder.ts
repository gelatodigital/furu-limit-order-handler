import { getWitnessAndSecret } from "@gelatonetwork/limit-orders-lib";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network, waffle } from "hardhat";
import {
  HGelatoLimitOrder,
  IERC20,
  IGelatoPineCore,
  IHFunds,
  IProxy,
  IRegistry,
  IUniswapV2Router02,
} from "../typechain";
import { getTokenFromFaucet } from "./helpers";

const gelatoAddress = "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6";
const proxyAddress = "0xA013AfbB9A92cEF49e898C87C060e6660E050569";
const handlerRegistryAddress = "0xd4258B13C9FADb7623Ca4b15DdA34b7b85b842C7";
const hFundsAddress = "0x95f44674C3b8A3EC56589A8ddAC7D7FD09DB3e8E";
const gelatoPineAddress = "0x36049D479A97CdE1fC6E2a5D2caE30B666Ebf92B";
const limitOrderModuleAddress = "0x037fc8e71445910e1E0bBb2a0896d5e9A7485318";
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const uniswapRouterAddress = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";
const uniHalderAddress = "0x842A8Dea50478814e2bFAFF9E5A27DC0D1FdD37c";
const daiAddress = "0x6b175474e89094c44da98b954eedeac495271d0f";
const wethAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const Zero = ethers.constants.HashZero;

const GAS_PRICE = ethers.utils.parseUnits("50", "gwei");

describe("FuruLimitOrder", function () {
  let token0: IERC20;
  let user0: SignerWithAddress;
  let user1: SignerWithAddress;
  let gelato: any;
  let proxy: IProxy;
  let registry: IRegistry;
  let hGelatoLimitOrder: HGelatoLimitOrder;
  let hFunds: IHFunds;
  let gelatoPine: IGelatoPineCore;
  let uniRouter: IUniswapV2Router02;

  before(async function () {
    [user0, user1] = await ethers.getSigners();

    // Deploy hGelatoLimitOrderHandler
    const hGelatoLimitOrderFactory = await ethers.getContractFactory(
      "HGelatoLimitOrder"
    );
    const hGelatoLimitOrderDeploy = await hGelatoLimitOrderFactory.deploy();

    hGelatoLimitOrder = (await ethers.getContractAt(
      "HGelatoLimitOrder",
      hGelatoLimitOrderDeploy.address
    )) as HGelatoLimitOrder;

    // Get Furu Registry Owner
    registry = (await ethers.getContractAt(
      "IRegistry",
      handlerRegistryAddress
    )) as IRegistry;

    const registryOwnerAddress = await registry.owner();

    await user0.sendTransaction({
      value: ethers.utils.parseEther("1"),
      to: registryOwnerAddress,
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [registryOwnerAddress],
    });

    const registryOwner = await ethers.provider.getSigner(registryOwnerAddress);

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [gelatoAddress],
    });

    gelato = await ethers.provider.getSigner(gelatoAddress);

    await registry
      .connect(registryOwner)
      .register(
        hGelatoLimitOrder.address,
        ethers.utils.formatBytes32String("Gelato Limit Order")
      );

    proxy = (await ethers.getContractAt("IProxy", proxyAddress)) as IProxy;

    gelatoPine = (await ethers.getContractAt(
      "IGelatoPineCore",
      gelatoPineAddress
    )) as IGelatoPineCore;

    hFunds = (await ethers.getContractAt("IHFunds", hFundsAddress)) as IHFunds;

    token0 = (await ethers.getContractAt("IERC20", daiAddress)) as IERC20;

    uniRouter = (await ethers.getContractAt(
      "IUniswapV2Router02",
      uniswapRouterAddress
    )) as IUniswapV2Router02;
  });

  describe("Furu Limit Order Handler", async function () {
    it("Should place and execute ETH order successfully", async function () {
      // Place the order
      const sellAmount = ethers.utils.parseEther("5");

      const amountOut = (
        await uniRouter.getAmountsOut(sellAmount, [wethAddress, daiAddress])
      )[1];

      const desiredIncrease = "1"; // 1%

      const minReturn = amountOut.add(
        amountOut
          .mul(ethers.BigNumber.from(desiredIncrease))
          .div(ethers.BigNumber.from("100"))
      );

      const { secret, witness } = getWitnessAndSecret();

      const placeOrderData = hGelatoLimitOrder.interface.encodeFunctionData(
        "placeLimitOrder",
        [ETH_ADDRESS, daiAddress, sellAmount, minReturn, witness, secret]
      );

      const preBalance = await waffle.provider.getBalance(user0.address);

      const placeTx = await proxy
        .connect(user0)
        .batchExec([hGelatoLimitOrder.address], [Zero], [placeOrderData], {
          value: sellAmount,
          gasPrice: GAS_PRICE,
        });

      const placeTxReceipt = await placeTx.wait();

      const { gasUsed } = placeTxReceipt;

      const txCost = GAS_PRICE.mul(gasUsed);

      const postBalance = await waffle.provider.getBalance(user0.address);

      // Check if tokens or ETH got transferred out of users wallet

      expect(preBalance.sub(sellAmount.add(txCost))).to.be.eq(postBalance);

      // Check if order exist
      const encodedData = new ethers.utils.AbiCoder().encode(
        ["address", "uint256"],
        [daiAddress, minReturn]
      );
      const orderExists = await gelatoPine.existOrder(
        limitOrderModuleAddress,
        ETH_ADDRESS,
        user0.address,
        witness,
        encodedData
      );

      expect(orderExists).to.be.true;

      // Change price to make order executable
      const dumpAmount = sellAmount.mul(100000);

      await getTokenFromFaucet(daiAddress, user1.address, dumpAmount);

      await token0.connect(user1).approve(uniRouter.address, dumpAmount);

      await uniRouter
        .connect(user1)
        .swapExactTokensForTokens(
          dumpAmount,
          0,
          [daiAddress, wethAddress],
          user1.address,
          10000000000
        );

      const auxData = new ethers.utils.AbiCoder().encode(
        ["address", "address", "uint256"],
        [uniHalderAddress, gelatoAddress, ethers.constants.Two]
      );

      const hash = ethers.utils.solidityKeccak256(["address"], [gelatoAddress]);
      const wallet = new ethers.Wallet(secret);
      const sig = ethers.utils.joinSignature(
        wallet._signingKey().signDigest(hash)
      ); // Unsafe but not for this.

      const preTokenBalance = await token0.balanceOf(user0.address);

      await gelatoPine
        .connect(gelato)
        .executeOrder(
          limitOrderModuleAddress,
          ETH_ADDRESS,
          user0.address,
          encodedData,
          sig,
          auxData
        );

      const postTokenBalance = await token0.balanceOf(user0.address);

      expect(postTokenBalance.sub(preTokenBalance)).to.be.gt(minReturn);
    });

    it("Should place and cancel ETH order successfully", async function () {
      // Place the order
      const sellAmount = ethers.utils.parseEther("5");

      const amountOut = (
        await uniRouter.getAmountsOut(sellAmount, [wethAddress, daiAddress])
      )[1];

      const desiredIncrease = "1"; // 1%

      // @dev change to actual UNI rate
      const minReturn = amountOut.add(
        amountOut
          .mul(ethers.BigNumber.from(desiredIncrease))
          .div(ethers.BigNumber.from("100"))
      );

      const { secret, witness } = getWitnessAndSecret();

      const placeOrderData = hGelatoLimitOrder.interface.encodeFunctionData(
        "placeLimitOrder",
        [ETH_ADDRESS, daiAddress, sellAmount, minReturn, witness, secret]
      );

      const placeTx = await proxy
        .connect(user0)
        .batchExec([hGelatoLimitOrder.address], [Zero], [placeOrderData], {
          value: sellAmount,
          gasPrice: GAS_PRICE,
        });

      await placeTx.wait();

      // Check if order exist
      const encodedData = new ethers.utils.AbiCoder().encode(
        ["address", "uint256"],
        [daiAddress, minReturn]
      );

      const preCancelEthBalance = await waffle.provider.getBalance(
        user0.address
      );

      await gelatoPine
        .connect(user0)
        .cancelOrder(
          limitOrderModuleAddress,
          ETH_ADDRESS,
          user0.address,
          witness,
          encodedData
        );

      const postCancelEthBalance = await waffle.provider.getBalance(
        user0.address
      );

      expect(postCancelEthBalance).to.be.gt(preCancelEthBalance);
    });

    it("Should place and execute DAI order successfully", async function () {
      // Place the order
      const sellAmount = ethers.utils.parseEther("5000");
      // const injectData = hFunds.interface.encodeFunctionData("inject", [
      //   [ETH_ADDRESS], [sellAmount]
      // ])

      const amountOut = (
        await uniRouter.getAmountsOut(sellAmount, [daiAddress, wethAddress])
      )[1];

      const desiredIncrease = "1"; // 1%

      // @dev change to actual UNI rate
      const minReturn = amountOut.add(
        amountOut
          .mul(ethers.BigNumber.from(desiredIncrease))
          .div(ethers.BigNumber.from("100"))
      );

      const injectData = hFunds.interface.encodeFunctionData("inject", [
        [daiAddress],
        [sellAmount],
      ]);

      const { secret, witness } = getWitnessAndSecret();

      const placeOrderData = hGelatoLimitOrder.interface.encodeFunctionData(
        "placeLimitOrder",
        [daiAddress, ETH_ADDRESS, sellAmount, minReturn, witness, secret]
      );

      const preBalance = await token0.balanceOf(user0.address);

      await token0.connect(user0).approve(proxy.address, sellAmount);

      await proxy
        .connect(user0)
        .batchExec(
          [hFunds.address, hGelatoLimitOrder.address],
          [Zero, Zero],
          [injectData, placeOrderData],
          {
            gasPrice: GAS_PRICE,
          }
        );

      const postBalance = await token0.balanceOf(user0.address);

      // Check if tokens or ETH got transferred out of users wallet

      expect(preBalance.sub(sellAmount)).to.be.eq(postBalance);

      // Check if order exist
      const encodedData = new ethers.utils.AbiCoder().encode(
        ["address", "uint256"],
        [ETH_ADDRESS, minReturn]
      );
      const orderExists = await gelatoPine.existOrder(
        limitOrderModuleAddress,
        daiAddress,
        user0.address,
        witness,
        encodedData
      );

      expect(orderExists).to.be.true;

      // Change price to make order executable
      const dumpAmount = sellAmount.div(10);

      await uniRouter
        .connect(user1)
        .swapExactETHForTokens(
          0,
          [wethAddress, daiAddress],
          user1.address,
          10000000000,
          { value: dumpAmount }
        );

      const auxData = new ethers.utils.AbiCoder().encode(
        ["address", "address", "uint256"],
        [uniHalderAddress, gelatoAddress, ethers.constants.Two]
      );

      const hash = ethers.utils.solidityKeccak256(["address"], [gelatoAddress]);
      const wallet = new ethers.Wallet(secret);
      const sig = ethers.utils.joinSignature(
        wallet._signingKey().signDigest(hash)
      ); // Unsafe but not for this.

      const preTokenBalance = await waffle.provider.getBalance(user0.address);

      await gelatoPine
        .connect(gelato)
        .executeOrder(
          limitOrderModuleAddress,
          daiAddress,
          user0.address,
          encodedData,
          sig,
          auxData
        );

      const postTokenBalance = await waffle.provider.getBalance(user0.address);

      expect(postTokenBalance.sub(preTokenBalance)).to.be.gt(minReturn);
    });

    it("Should place and cancel DAI order successfully", async function () {
      // Place the order
      const sellAmount = ethers.utils.parseEther("5");
      // const injectData = hFunds.interface.encodeFunctionData("inject", [
      //   [ETH_ADDRESS], [sellAmount]
      // ])

      const amountOut = (
        await uniRouter.getAmountsOut(sellAmount, [daiAddress, wethAddress])
      )[1];

      const desiredIncrease = "1"; // 1%

      // @dev change to actual UNI rate
      const minReturn = amountOut.add(
        amountOut
          .mul(ethers.BigNumber.from(desiredIncrease))
          .div(ethers.BigNumber.from("100"))
      );

      const injectData = hFunds.interface.encodeFunctionData("inject", [
        [daiAddress],
        [sellAmount],
      ]);

      const { secret, witness } = getWitnessAndSecret();

      const placeOrderData = hGelatoLimitOrder.interface.encodeFunctionData(
        "placeLimitOrder",
        [daiAddress, ETH_ADDRESS, sellAmount, minReturn, witness, secret]
      );

      await token0.approve(proxy.address, sellAmount);

      await proxy
        .connect(user0)
        .batchExec(
          [hFunds.address, hGelatoLimitOrder.address],
          [Zero, Zero],
          [injectData, placeOrderData],
          {
            gasPrice: GAS_PRICE,
          }
        );

      const encodedData = new ethers.utils.AbiCoder().encode(
        ["address", "uint256"],
        [ETH_ADDRESS, minReturn]
      );

      const preCancelDaiBalance = await token0.balanceOf(user0.address);

      await gelatoPine
        .connect(user0)
        .cancelOrder(
          limitOrderModuleAddress,
          daiAddress,
          user0.address,
          witness,
          encodedData
        );

      const postCancelDaiBalance = await token0.balanceOf(user0.address);

      expect(postCancelDaiBalance).to.be.gt(preCancelDaiBalance);
    });
  });
});
