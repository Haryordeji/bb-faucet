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