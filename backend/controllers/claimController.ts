// backend/controllers/claimController.ts
import { Request, Response } from 'express';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import dotenv from "dotenv";
dotenv.config();

// Load ABI from the compiled contract
const QUIZ_FAUCET_ABI = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../../backend/artifacts/contracts/QuizFaucet.sol/QuizFaucet.json')
  ).toString()
).abi;

export const claimController = {
  /**
   * Get the claim status for a user
   */
  getClaimStatus: async (req: Request, res: Response) => {
    try {
      const { userAddress } = req.params;
      
      if (!userAddress || !ethers.isAddress(userAddress)) {
        res.status(400).json({ error: 'Invalid address format' });
        return;
      }
      
      // Connect to the contract
      const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
      const faucetContract = new ethers.Contract(
        process.env.QUIZ_FAUCET_ADDRESS || '',
        QUIZ_FAUCET_ABI,
        provider
      );
      
      // Get remaining claims for user
      const remainingClaims = await faucetContract.getRemainingClaims(userAddress);
      const canClaim = await faucetContract.canClaim(userAddress);
      
      // Get user's claim data
      const userClaims = await faucetContract.userClaims(userAddress);
      const lastClaimTime = userClaims.lastClaimTimestamp > 0 
        ? new Date(Number(userClaims.lastClaimTimestamp) * 1000) 
        : null;
      
      res.json({
        userAddress,
        remainingClaims: Number(remainingClaims),
        lastClaimTime,
        canClaim
      });
    } catch (error) {
      console.error('Error fetching claim status:', error);
      res.status(500).json({ error: 'Failed to get claim status' });
    }
  },
  
  /**
   * Initiate a claim for quiz rewards
   */
  initiateClaim: async (req: Request, res: Response) => {
    try {
      const { userAddress, scorePercentage } = req.body;
      
      if (!userAddress || !ethers.isAddress(userAddress)) {
        res.status(400).json({ error: 'Invalid address format' });
        return;
      }
      
      if (typeof scorePercentage !== 'number' || scorePercentage < 0 || scorePercentage > 100) {
        res.status(400).json({ error: 'Invalid score percentage' });
        return;
      }
      
      // Connect to the contract with a wallet that can sign transactions
      const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
      const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY || '', provider);
      const faucetContract = new ethers.Contract(
        process.env.QUIZ_FAUCET_ADDRESS || '',
        QUIZ_FAUCET_ABI,
        adminWallet
      );
      
      // Check if user can claim
      const canClaim = await faucetContract.canClaim(userAddress);
      if (!canClaim) {
        res.status(403).json({ 
          success: false, 
          error: 'Daily claim limit reached' 
        });
        return;
      }
      
      // Initiate the claim
      const tx = await faucetContract.claimReward(userAddress, scorePercentage);
      const receipt = await tx.wait();
      
      res.json({
        success: true,
        userAddress,
        scorePercentage,
        transactionHash: receipt.hash
      });
    } catch (error) {
      console.error('Error processing claim:', error);
      res.status(500).json({ 
        success: false, 
        error: `Failed to process claim: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }
};