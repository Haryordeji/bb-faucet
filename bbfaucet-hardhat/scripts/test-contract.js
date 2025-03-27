// scripts/test-contract.js
const hre = require("hardhat");

async function main() {
  const contractAddress = "0xYourDeployedContractAddress";
  
  // Connect to the contract
  const quizFaucet = await hre.ethers.getContractAt("QuizFaucet", contractAddress);
  
  // Get contract balance
  const balance = await hre.ethers.provider.getBalance(contractAddress);
  console.log(`Contract balance: ${hre.ethers.formatEther(balance)} ETH`);
  
  // Check max claims per day
  const maxClaims = await quizFaucet.maxClaimsPerDay();
  console.log(`Max claims per day: ${maxClaims}`);
  
  // Check max reward
  const maxReward = await quizFaucet.maxReward();
  console.log(`Max reward: ${hre.ethers.formatEther(maxReward)} ETH`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });