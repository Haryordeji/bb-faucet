# BB Faucet Hardhat Deployment

# Smart Contract Deployment Guide

## Prerequisites

- Node.js and npm installed
- MetaMask or another Ethereum wallet with Sepolia testnet ETH
- Alchemy or Infura account for RPC access

## Setup Hardhat Project

First, create a directory for your contract deployment:

```bash
mkdir -p hardhat-project
cd hardhat-project
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox dotenv
```

Initialize Hardhat:

```bash
npx hardhat init
```

Select "Create a JavaScript project" when prompted.

## Configure Hardhat

Create a `.env` file in the hardhat project root:

```
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_api_key
PRIVATE_KEY=your_wallet_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

Update the `hardhat.config.js` file:

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};
```

## Add Your Contract

Copy your QuizFaucet.sol into the contracts directory:

```bash
cp path/to/your/QuizFaucet.sol contracts/
```

Here's the contract code for reference:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract QuizFaucet {
    address public owner;
    uint256 public maxClaimsPerDay = 2;
    uint256 public maxReward = 0.1 ether; // Maximum reward (100% score)
    
    struct UserClaims {
        uint256 lastClaimTimestamp;
        uint256 claimsToday;
    }
    
    mapping(address => UserClaims) public userClaims;
    
    event RewardClaimed(address indexed user, uint256 amount, uint256 score);
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    // Function to update the faucet's balance
    receive() external payable {}
    
    // Function to dispense rewards based on quiz score
    function claimReward(address recipient, uint256 scorePercentage) external onlyOwner returns (bool) {
        require(scorePercentage <= 100, "Score percentage must be <= 100");
        require(canClaim(recipient), "Daily claim limit reached");
        
        // Calculate reward based on score
        uint256 reward = (maxReward * scorePercentage) / 100;
        
        // Check if contract has enough balance
        require(address(this).balance >= reward, "Insufficient faucet balance");
        
        // Update user's claim record
        UserClaims storage userClaim = userClaims[recipient];
        
        // Reset claims if it's a new day
        if (block.timestamp >= userClaim.lastClaimTimestamp + 24 hours) {
            userClaim.claimsToday = 0;
        }
        
        userClaim.claimsToday += 1;
        userClaim.lastClaimTimestamp = block.timestamp;
        
        // Send reward
        (bool success, ) = recipient.call{value: reward}("");
        require(success, "Transfer failed");
        
        emit RewardClaimed(recipient, reward, scorePercentage);
        
        return true;
    }
    
    // Check if user can claim today
    function canClaim(address user) public view returns (bool) {
        UserClaims memory userClaim = userClaims[user];
        
        // Reset count if it's a new day
        if (block.timestamp >= userClaim.lastClaimTimestamp + 24 hours) {
            return true;
        }
        
        // Check if user has reached daily limit
        return userClaim.claimsToday < maxClaimsPerDay;
    }
    
    // Get remaining claims for user today
    function getRemainingClaims(address user) external view returns (uint256) {
        UserClaims memory userClaim = userClaims[user];
        
        // Reset count if it's a new day
        if (block.timestamp >= userClaim.lastClaimTimestamp + 24 hours) {
            return maxClaimsPerDay;
        }
        
        return maxClaimsPerDay - userClaim.claimsToday;
    }
    
    // Admin function to withdraw funds if needed
    function withdraw() external onlyOwner {
        (bool success, ) = owner.call{value: address(this).balance}("");
        require(success, "Transfer failed");
    }
    
    // Admin function to update max claims per day
    function setMaxClaimsPerDay(uint256 _maxClaimsPerDay) external onlyOwner {
        maxClaimsPerDay = _maxClaimsPerDay;
    }
    
    // Admin function to update max reward
    function setMaxReward(uint256 _maxReward) external onlyOwner {
        maxReward = _maxReward;
    }
}
```

## Create Deployment Script

Create a file `scripts/deploy.js`:

```javascript
const hre = require("hardhat");

async function main() {
  console.log("Deploying QuizFaucet contract...");

  // Deploy the contract
  const QuizFaucet = await hre.ethers.getContractFactory("QuizFaucet");
  const quizFaucet = await QuizFaucet.deploy();

  await quizFaucet.waitForDeployment();
  
  const address = await quizFaucet.getAddress();
  console.log(`QuizFaucet deployed to: ${address}`);

  // Fund the contract (optional but recommended)
  console.log("Funding the contract with initial balance...");
  const [deployer] = await hre.ethers.getSigners();
  const fundTx = await deployer.sendTransaction({
    to: address,
    value: hre.ethers.parseEther("0.5") // Fund with 0.5 ETH for testing
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
```

## Deploy the Contract

Make sure you have Sepolia ETH in your wallet

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

This will:
1. Deploy your contract
2. Fund it with 0.5 Sepolia ETH 
3. Verify the contract on Etherscan (if possible)

Take note of the deployed contract address.

## Create a Test Script (Optional)

Create a file `scripts/test-contract.js` to test your deployed contract:

```javascript
const hre = require("hardhat");

async function main() {
  const contractAddress = "0xYourDeployedContractAddress"; // Replace with your contract address
  
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
  
  // Get owner address
  const owner = await quizFaucet.owner();
  console.log(`Contract owner: ${owner}`);
  
  // Try to check claim status for your address
  const [signer] = await hre.ethers.getSigners();
  const canClaim = await quizFaucet.canClaim(signer.address);
  console.log(`Can claim from address ${signer.address}: ${canClaim}`);
  
  const remainingClaims = await quizFaucet.getRemainingClaims(signer.address);
  console.log(`Remaining claims today: ${remainingClaims}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

Run the test script:

```bash
npx hardhat run scripts/test-contract.js --network sepolia
```

## Get the ABI and Integrate with Backend

### 1. Compile the Contract

If you haven't already:

```bash
npx hardhat compile
```

### 2. Create the Directory Structure in Your Backend

```bash
mkdir -p backend/artifacts/contracts/QuizFaucet.sol
```

### 3. Copy the ABI File

```bash
cp hardhat-project/artifacts/contracts/QuizFaucet.sol/QuizFaucet.json backend/artifacts/contracts/QuizFaucet.sol/
```

### 4. Update Your Backend .env File

Add your deployed contract address to your backend `.env` file:

```
QUIZ_FAUCET_ADDRESS=0xYourDeployedContractAddress
```

## Troubleshooting

### Common Issues:

1. **Not enough ETH for deployment**
   - Get Sepolia ETH from a faucet

2. **Contract verification fails**
   - Make sure your ETHERSCAN_API_KEY is correct
   - Try manual verification on Etherscan if needed

3. **Backend can't load ABI**
   - Check file paths and ensure the ABI JSON is in the correct location
   - Verify file permissions

4. **Contract calls fail**
   - Ensure your SEPOLIA_RPC_URL is working
   - Check that your contract address is correct
   - Make sure your private key has access to the contract owner account for admin operations