export interface QuizQuestion {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  }
  
  export interface QuizResult {
    score: number;
    isCorrect: boolean;
  }
  
  export interface ClaimStatus {
    remainingClaims: number;
    lastClaimTime: Date | null;
    canClaim: boolean;
  }
  
  export interface ClaimResponse {
    success: boolean;
    transactionHash?: string;
    error?: string;
  }