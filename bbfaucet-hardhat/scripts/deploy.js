const hre = require("hardhat");

async function main() {
  console.log("Deploying QuizFaucet contract...");

  // Deploy the contract
  const QuizFaucet = await hre.ethers.getContractFactory("QuizFaucet");
  const quizFaucet = await QuizFaucet.deploy();

  await quizFaucet.waitForDeployment();
  
  const address = await quizFaucet.getAddress();
  console.log(`QuizFaucet deployed to: ${address}`);

  console.log("Funding the contract with initial balance...");
  const [deployer] = await hre.ethers.getSigners();
  const fundTx = await deployer.sendTransaction({
    to: address,
    value: hre.ethers.parseEther("0.05") 
  });
  await fundTx.wait();
  console.log("Contract funded successfully");

  // Wait for Etherscan to index the contract
  console.log("Waiting for Etherscan to index the contract...");
  await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds delay

  // Verify the contract on Etherscan
  console.log("Verifying contract on Etherscan...");
  try {
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: []
    });
    console.log("Contract verified on Etherscan");
  } catch (error) {
    console.error("Error verifying contract:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });