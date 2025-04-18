export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface FreeResponseQuestion {
  question: string;
  sampleAnswer: string;
  rubric: string;
}

export interface QuizResult {
  score: number;
  isCorrect: boolean;
  multipleChoice?: {
    results: any[];
    totalCorrect: number;
    totalQuestions: number;
    score: number;
  };
  freeResponse?: {
    score: number;
    feedback: string;
  };
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