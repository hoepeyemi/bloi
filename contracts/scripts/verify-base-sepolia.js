const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const CHAIN_ID = 84532;
const API_URL = "https://api.etherscan.io/v2/api";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = line.slice(0, equalsIndex).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, "..", ".env"));
loadEnvFile(path.join(__dirname, "..", ".env.local"));
loadEnvFile(path.join(__dirname, "..", "..", ".env"));

const ETHERSCAN_API_KEY = process.env.BASESCAN_API_KEY || process.env.ETHERSCAN_API_KEY;
if (!ETHERSCAN_API_KEY) {
  throw new Error("Set BASESCAN_API_KEY (or ETHERSCAN_API_KEY) in contracts/.env before running verification.\nGet a free key at https://basescan.org/myapikey");
}

const deploymentPath = path.join(__dirname, "..", "deployments", "baseSepolia.json");
if (!fs.existsSync(deploymentPath)) {
  throw new Error(`No deployment found at ${deploymentPath}. Run 'npm run deploy:base-sepolia' first.`);
}
const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

const rpcUrl =
  process.env.BASE_SEPOLIA_RPC ||
  process.env.BASE_SEPOLIA_RPC_URL ||
  "https://sepolia.base.org";

const provider = new ethers.JsonRpcProvider(rpcUrl, CHAIN_ID);
const abiCoder = ethers.AbiCoder.defaultAbiCoder();

function readArtifact(relativePath) {
  const artifactPath = path.join(__dirname, "..", "artifacts", relativePath);
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

function findBuildInfoFor(sourceName, contractName) {
  const buildInfoDir = path.join(__dirname, "..", "artifacts", "build-info");
  const files = fs.existsSync(buildInfoDir)
    ? fs.readdirSync(buildInfoDir).filter((f) => f.endsWith(".json"))
    : [];
  for (const file of files) {
    const buildInfo = JSON.parse(fs.readFileSync(path.join(buildInfoDir, file), "utf8"));
    if (buildInfo?.output?.contracts?.[sourceName]?.[contractName]) {
      return buildInfo;
    }
  }
  throw new Error(`Could not find build-info for ${sourceName}:${contractName}`);
}

async function getLiveConstructorArgs(address, abi, fns) {
  const contract = new ethers.Contract(address, abi, provider);
  const values = [];
  for (const fn of fns) values.push(await contract[fn]());
  return values;
}

async function getVerificationState(address) {
  const url = new URL(API_URL);
  url.searchParams.set("chainid", String(CHAIN_ID));
  url.searchParams.set("module", "contract");
  url.searchParams.set("action", "getsourcecode");
  url.searchParams.set("address", address);
  url.searchParams.set("apikey", ETHERSCAN_API_KEY);
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`getsourcecode failed for ${address}: HTTP ${res.status}`);
  const payload = await res.json();
  const result = Array.isArray(payload.result) ? payload.result[0] : undefined;
  return { verified: Boolean(result?.SourceCode?.trim()), result, payload };
}

async function submitVerification(target) {
  const artifact = readArtifact(target.artifactPath);
  const buildInfo = findBuildInfoFor(artifact.sourceName, artifact.contractName);
  const compilerVersion = buildInfo.solcLongVersion.startsWith("v")
    ? buildInfo.solcLongVersion
    : `v${buildInfo.solcLongVersion}`;
  const sourceCode = JSON.stringify(buildInfo.input);
  const constructorArgs = target.constructorArgs.length
    ? abiCoder.encode(target.constructorTypes, target.constructorArgs).replace(/^0x/, "")
    : "";

  const body = new URLSearchParams({
    apikey: ETHERSCAN_API_KEY,
    module: "contract",
    action: "verifysourcecode",
    chainid: String(CHAIN_ID),
    contractaddress: target.address,
    sourceCode,
    codeformat: "solidity-standard-json-input",
    contractname: `${artifact.sourceName}:${artifact.contractName}`,
    compilerversion: compilerVersion,
    optimizationUsed: buildInfo.input.settings.optimizer?.enabled ? "1" : "0",
    runs: String(buildInfo.input.settings.optimizer?.runs ?? 0),
    evmVersion: buildInfo.input.settings.evmVersion || "default",
    licenseType: "3",
    constructorArguments: constructorArgs,
  });

  const res = await fetch(`${API_URL}?chainid=${CHAIN_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Verification request failed for ${target.name}: HTTP ${res.status}`);
  const payload = await res.json();
  const guid = payload.result;
  if (!guid || typeof guid !== "string") {
    throw new Error(`Verification submission failed for ${target.name}: ${JSON.stringify(payload)}`);
  }
  return { guid };
}

async function pollVerification(guid, name, address) {
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, 5000));
    const url = new URL(API_URL);
    url.searchParams.set("chainid", String(CHAIN_ID));
    url.searchParams.set("module", "contract");
    url.searchParams.set("action", "checkverifystatus");
    url.searchParams.set("guid", guid);
    url.searchParams.set("apikey", ETHERSCAN_API_KEY);
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      if (res.status === 403 && address) {
        const state = await getVerificationState(address);
        if (state.verified) return { ok: true, result: "Verified via source lookup fallback" };
      }
      continue;
    }
    const payload = await res.json();
    const status = String(payload.status ?? "");
    const result = String(payload.result ?? "");
    if (status === "1" || /already verified/i.test(result)) return { ok: true, result };
    if (/pending|queue/i.test(result)) continue;
    if (status === "0") return { ok: false, result };
  }
  return { ok: false, result: "Timed out" };
}

async function verifyContract(target) {
  if (!target.address || target.address === ethers.ZeroAddress) {
    return { name: target.name, status: "skipped", reason: "Not deployed" };
  }
  const code = await provider.getCode(target.address);
  if (code === "0x") {
    return { name: target.name, status: "skipped", reason: "No contract code at address" };
  }
  const current = await getVerificationState(target.address);
  if (current.verified) return { name: target.name, status: "already-verified" };
  const { guid } = await submitVerification(target);
  const final = await pollVerification(guid, target.name, target.address);
  if (!final.ok) throw new Error(`${target.name} failed: ${final.result}`);
  return { name: target.name, status: "verified" };
}

async function main() {
  const yieldVaultAbi = ["function invoiceNFT() view returns (address)"];
  const agentRouterAbi = [
    "function invoiceNFT() view returns (address)",
    "function yieldVault() view returns (address)",
  ];
  const pythOracleAbi = [
    "function pyth() view returns (address)",
    "function nativeUsdFeed() view returns (bytes32)",
  ];
  const aaveYieldSourceAbi = ["function pool() view returns (address)"];

  const targets = [
    {
      name: "InvoiceNFT",
      address: deployment.invoiceNFT,
      artifactPath: path.join("src", "InvoiceNFT.sol", "InvoiceNFT.json"),
      constructorArgs: [],
      constructorTypes: [],
    },
    {
      name: "YieldVault",
      address: deployment.yieldVault,
      artifactPath: path.join("src", "YieldVault.sol", "YieldVault.json"),
      constructorArgs: await getLiveConstructorArgs(deployment.yieldVault, yieldVaultAbi, ["invoiceNFT"]),
      constructorTypes: ["address"],
    },
    {
      name: "AgentRouter",
      address: deployment.agentRouter,
      artifactPath: path.join("src", "AgentRouter.sol", "AgentRouter.json"),
      constructorArgs: await getLiveConstructorArgs(deployment.agentRouter, agentRouterAbi, ["invoiceNFT", "yieldVault"]),
      constructorTypes: ["address", "address"],
    },
    {
      name: "PrivacyRegistry",
      address: deployment.privacyRegistry,
      artifactPath: path.join("src", "PrivacyRegistry.sol", "PrivacyRegistry.json"),
      constructorArgs: [],
      constructorTypes: [],
    },
    {
      name: "PythOracle",
      address: deployment.pythOracle,
      artifactPath: path.join("src", "PythOracle.sol", "PythOracle.json"),
      constructorArgs: deployment.pythOracle && deployment.pythOracle !== ethers.ZeroAddress
        ? await getLiveConstructorArgs(deployment.pythOracle, pythOracleAbi, ["pyth", "nativeUsdFeed"])
        : [],
      constructorTypes: ["address", "bytes32"],
    },
    {
      name: "AaveV3YieldSource",
      address: deployment.aaveYieldSource,
      artifactPath: path.join("src", "AaveV3YieldSource.sol", "AaveV3YieldSource.json"),
      constructorArgs: deployment.aaveYieldSource && deployment.aaveYieldSource !== ethers.ZeroAddress
        ? await getLiveConstructorArgs(deployment.aaveYieldSource, aaveYieldSourceAbi, ["pool"])
        : [],
      constructorTypes: ["address"],
    },
  ];

  console.log("=== Base Sepolia Verification ===");
  console.log("Explorer: https://sepolia.basescan.org");

  const results = [];
  for (const target of targets) {
    process.stdout.write(`  ${target.name}... `);
    try {
      const result = await verifyContract(target);
      results.push(result);
      if (result.status === "verified") console.log("✓ verified");
      else if (result.status === "already-verified") console.log("↺ already verified");
      else console.log(`- skipped (${result.reason})`);
    } catch (err) {
      results.push({ name: target.name, status: "failed", reason: err.message });
      console.log(`✗ failed: ${err.message}`);
    }
  }

  const failed = results.filter((r) => r.status === "failed");
  if (failed.length > 0) {
    process.exitCode = 1;
    console.error("\nFailed:");
    for (const r of failed) console.error(`  ${r.name}: ${r.reason}`);
  } else {
    console.log("\nAll done.");
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
