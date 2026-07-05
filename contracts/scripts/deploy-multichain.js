const hre = require("hardhat");
const { mergeDeploymentState, readDeploymentState } = require("./deployment-state");

const BASE_SEPOLIA_PYTH_ADDRESS = "0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a";
const BASE_SEPOLIA_NATIVE_USD_FEED = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer account available. Set PRIVATE_KEY in contracts/.env or your shell before running deploy:base-sepolia."
    );
  }
  const pythAddress =
    process.env.PYTH ||
    (hre.network.name === "baseSepolia" ? BASE_SEPOLIA_PYTH_ADDRESS : hre.ethers.ZeroAddress);
  const nativeUsdFeed =
    process.env.PYTH_NATIVE_USD_FEED ||
    (hre.network.name === "baseSepolia" ? BASE_SEPOLIA_NATIVE_USD_FEED : hre.ethers.ZeroHash);
  const deploymentState = readDeploymentState(hre.network.name);
  const aavePool = process.env.AAVE_POOL || deploymentState.mockAavePool || hre.ethers.ZeroAddress;
  const mockAaveAsset = process.env.MOCK_AAVE_ASSET || deploymentState.mockAaveAsset || hre.ethers.ZeroAddress;
  const wrapNativeEth = process.env.MOCK_AAVE_WRAP_NATIVE === "true";

  console.log("=== bloi Base Sepolia Deployment ===");
  console.log("Deployer:", deployer.address);
  console.log("Chain ID:", hre.network.config.chainId || "unknown");
  console.log("Pyth Oracle:", pythAddress);
  if (hre.network.name === "baseSepolia" && !process.env.PYTH) {
    console.log("Pyth Oracle source: built-in Base Sepolia address");
  }
  console.log("Native USD Feed:", nativeUsdFeed);
  console.log("Aave V3 Pool:", aavePool);
  console.log("Mock Aave Asset:", mockAaveAsset);
  console.log("Wrap Native ETH:", wrapNativeEth);

  const InvoiceNFT = await hre.ethers.getContractFactory("src/InvoiceNFT.sol:InvoiceNFT");
  const YieldVault = await hre.ethers.getContractFactory("YieldVault");
  const PrivacyRegistry = await hre.ethers.getContractFactory("PrivacyRegistry");
  const AgentRouter = await hre.ethers.getContractFactory("AgentRouter");
  const PythOracle = await hre.ethers.getContractFactory("PythOracle");
  const AaveV3YieldSource = await hre.ethers.getContractFactory("AaveV3YieldSource");
  const MockAaveV3Pool = await hre.ethers.getContractFactory("MockAaveV3Pool");
  const WrappedMNT = await hre.ethers.getContractFactory("WrappedMNT");

  const invoiceNFT = await InvoiceNFT.deploy();
  await invoiceNFT.waitForDeployment();
  const yieldVault = await YieldVault.deploy(await invoiceNFT.getAddress());
  await yieldVault.waitForDeployment();
  const privacyRegistry = await PrivacyRegistry.deploy();
  await privacyRegistry.waitForDeployment();
  const agentRouter = await AgentRouter.deploy(await invoiceNFT.getAddress(), await yieldVault.getAddress());
  await agentRouter.waitForDeployment();

  let oracleAddress = hre.ethers.ZeroAddress;
  if (pythAddress !== hre.ethers.ZeroAddress) {
    if (nativeUsdFeed === hre.ethers.ZeroHash) {
      throw new Error("Set PYTH_NATIVE_USD_FEED before deploying PythOracle.");
    }

    const pythOracle = await PythOracle.deploy(pythAddress, nativeUsdFeed);
    await pythOracle.waitForDeployment();
    oracleAddress = await pythOracle.getAddress();
    console.log("PythOracle deployed at:", oracleAddress);
  }

  let yieldSourceAddress = hre.ethers.ZeroAddress;
  let resolvedAavePool = aavePool;
  if (resolvedAavePool === hre.ethers.ZeroAddress && hre.network.name === "baseSepolia") {
    const mockPool = await MockAaveV3Pool.deploy();
    await mockPool.waitForDeployment();
    resolvedAavePool = await mockPool.getAddress();
    console.log("MockAaveV3Pool deployed at:", resolvedAavePool);

    let assetToRegister = mockAaveAsset;
    if (assetToRegister === hre.ethers.ZeroAddress && wrapNativeEth) {
      const wrappedEth = await WrappedMNT.deploy();
      await wrappedEth.waitForDeployment();
      assetToRegister = await wrappedEth.getAddress();
      console.log("WrappedETH deployed at:", assetToRegister);
    }

    if (assetToRegister !== hre.ethers.ZeroAddress) {
      const tokenName = process.env.MOCK_AAVE_ATOKEN_NAME || "Mock Aave interest bearing token";
      const tokenSymbol = process.env.MOCK_AAVE_ATOKEN_SYMBOL || "maToken";
      const liquidityRate = process.env.MOCK_AAVE_LIQUIDITY_RATE ? BigInt(process.env.MOCK_AAVE_LIQUIDITY_RATE) : 0n;
      const registerTx = await mockPool.registerAsset(assetToRegister, tokenName, tokenSymbol, liquidityRate);
      await registerTx.wait();
      console.log("Mock Aave asset registered:", assetToRegister);
      console.log("Mock aToken:", await mockPool.getAToken(assetToRegister));

      mergeDeploymentState(hre.network.name, {
        mockAavePool: resolvedAavePool,
        wrappedEth: assetToRegister,
        mockAaveAsset: assetToRegister,
        mockAToken: await mockPool.getAToken(assetToRegister),
      });
    } else {
      console.log("Mock Aave pool deployed without an asset. Set MOCK_AAVE_ASSET or MOCK_AAVE_WRAP_NATIVE=true.");
      mergeDeploymentState(hre.network.name, {
        mockAavePool: resolvedAavePool,
      });
    }
  }

  if (resolvedAavePool !== hre.ethers.ZeroAddress) {
    const yieldSource = await AaveV3YieldSource.deploy(resolvedAavePool);
    await yieldSource.waitForDeployment();
    await yieldSource.setAuthorizedVault(await yieldVault.getAddress());
    yieldSourceAddress = await yieldSource.getAddress();
    console.log("AaveV3YieldSource deployed at:", yieldSourceAddress);
  }

  await invoiceNFT.setYieldVault(await yieldVault.getAddress());
  await invoiceNFT.setAgentRouter(await agentRouter.getAddress());
  if (oracleAddress !== hre.ethers.ZeroAddress) {
    await invoiceNFT.setOracle(oracleAddress);
  }
  await yieldVault.setAgentRouter(await agentRouter.getAddress());
  if (yieldSourceAddress !== hre.ethers.ZeroAddress) {
    await yieldVault.setYieldSource(yieldSourceAddress);
  }

  console.log("");
  console.log("=== Deployment Addresses ===");
  console.log("INVOICE_NFT:", await invoiceNFT.getAddress());
  console.log("YIELD_VAULT:", await yieldVault.getAddress());
  console.log("PRIVACY_REGISTRY:", await privacyRegistry.getAddress());
  console.log("AGENT_ROUTER:", await agentRouter.getAddress());
  console.log("PYTH_ORACLE:", oracleAddress);
  console.log("AAVE_YIELD_SOURCE:", yieldSourceAddress);

  mergeDeploymentState(hre.network.name, {
    invoiceNFT: await invoiceNFT.getAddress(),
    yieldVault: await yieldVault.getAddress(),
    privacyRegistry: await privacyRegistry.getAddress(),
    agentRouter: await agentRouter.getAddress(),
    pythOracle: oracleAddress,
    nativeUsdFeed,
    aaveYieldSource: yieldSourceAddress,
    mockAavePool: resolvedAavePool,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
