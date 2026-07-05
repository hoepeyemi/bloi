const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying bloi Factory with deployer:", deployer.address);

  const BloiFactory = await hre.ethers.getContractFactory("BloiFactory");
  const factory = await BloiFactory.deploy();
  await factory.waitForDeployment();

  const tx = await factory.deployProtocol();
  const receipt = await tx.wait();

  console.log("BloiFactory deployed at:", await factory.getAddress());
  console.log("=== bloi Protocol Deployed ===");
  console.log("Deployment tx:", receipt.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
