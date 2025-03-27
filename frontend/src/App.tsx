import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import { QuizQuestion, QuizResult, ClaimResponse, ClaimStatus } from './types';

const App: React.FC = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<ClaimStatus | null>(null);
  const [claimProcessing, setClaimProcessing] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  // Check if MetaMask is installed
  const isMetaMaskInstalled = () => {
    return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
  };

  // Connect to MetaMask
  const connectWallet = async () => {
    if (!isMetaMaskInstalled()) {
      setError('MetaMask is not installed. Please install it to use this app.');
      return;
    }

    try {
      setIsLoading(true);
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed');
      }
      
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      setWalletAddress(accounts[0]);
      setProvider(provider);
      setError(null);
      
      // Load a quiz question after connecting
      await loadQuizQuestion();
      
      // Get claim status for this address
      if (accounts[0]) {
        await fetchClaimStatus(accounts[0]);
      }
    } catch (err) {
      setError('Failed to connect wallet. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch claim status for the current wallet
  const fetchClaimStatus = async (address: string) => {
    try {
      const response = await fetch(`http://localhost:3000/api/claim/status/${address}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch claim status');
      }
      
      const data = await response.json();
      setClaimStatus(data);
    } catch (err) {
      console.error('Error fetching claim status:', err);
      // Don't set error state here to avoid disrupting the main flow
    }
  };

  // Load a quiz question from the backend
  const loadQuizQuestion = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('http://localhost:3000/api/quiz/generate?numQuestions=1');

      if (!response.ok) {
        throw new Error('Failed to load question');
      }

      const data = await response.json();
      setQuestions(data.questions);
      setCurrentQuestionIndex(0);
      setSelectedOption(null);
      setQuizResult(null);
    } catch (err) {
      setError('Failed to load quiz question. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit the selected answer
  const submitAnswer = async () => {
    if (selectedOption === null || !questions.length) return;

    try {
      setIsLoading(true);
      
      // Get the current question
      const currentQuestion = questions[currentQuestionIndex];
      const selectedAnswerText = currentQuestion.options[selectedOption];
      
      const response = await fetch('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionIds: [currentQuestion.question],
          answers: [selectedAnswerText],
          correctAnswers: [currentQuestion.correctAnswer],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit answer');
      }

      const result = await response.json();
      setQuizResult({
        score: result.score,
        isCorrect: result.isCorrect,
      });
      
      // Refresh claim status after submitting
      if (walletAddress) {
        await fetchClaimStatus(walletAddress);
      }
    } catch (err) {
      setError('Failed to submit answer. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Claim the reward
  const claimReward = async () => {
    if (!walletAddress || !quizResult) return;
    
    try {
      setClaimProcessing(true);
      
      const response = await fetch('http://localhost:3000/api/claim/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress: walletAddress,
          scorePercentage: quizResult.score,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to claim reward');
      }

      const result: ClaimResponse = await response.json();
      
      if (result.success && result.transactionHash) {
        setTransactionHash(result.transactionHash);
        
        // Refresh claim status after claiming
        if (walletAddress) {
          await fetchClaimStatus(walletAddress);
        }
      } else {
        throw new Error(result.error || 'Unknown error occurred');
      }
    } catch (err) {
      setError(`Failed to claim reward: ${err instanceof Error ? err.message : String(err)}`);
      console.error(err);
    } finally {
      setClaimProcessing(false);
    }
  };

  // Handle MetaMask account changes
  useEffect(() => {
    if (!isMetaMaskInstalled()) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setWalletAddress(null);
        setProvider(null);
        setClaimStatus(null);
      } else {
        setWalletAddress(accounts[0]);
        fetchClaimStatus(accounts[0]);
      }
    };

    window.ethereum!.on('accountsChanged', handleAccountsChanged);

    return () => {
      window.ethereum!.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, []);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>QuizFaucet</h1>
        <p>Learn blockchain and earn testnet ETH</p>
        
        {!walletAddress ? (
          <button 
            onClick={connectWallet} 
            disabled={isLoading}
            className="connect-button"
          >
            {isLoading ? 'Connecting...' : 'Connect MetaMask'}
          </button>
        ) : (
          <div className="wallet-info">
            <p>Connected: {`${walletAddress.substring(0, 6)}...${walletAddress.substring(38)}`}</p>
            {claimStatus && (
              <p>Remaining claims today: {claimStatus.remainingClaims}</p>
            )}
          </div>
        )}
      </header>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <main className="quiz-container">
        {!walletAddress ? (
          <div className="wallet-required">
            <h2>Connect Your Wallet</h2>
            <p>Please connect your MetaMask wallet to participate in quizzes and earn rewards.</p>
          </div>
        ) : questions.length > 0 ? (
          <div className="quiz-question">
            <h2>Question {currentQuestionIndex + 1}</h2>
            <p>{questions[currentQuestionIndex].question}</p>
            
            <div className="options-container">
              {questions[currentQuestionIndex].options.map((option, index) => (
                <div
                  key={index}
                  className={`option ${selectedOption === index ? 'selected' : ''}`}
                  onClick={() => setSelectedOption(index)}
                >
                  {option}
                </div>
              ))}
            </div>
            
            <button
              onClick={submitAnswer}
              disabled={selectedOption === null || isLoading}
              className="submit-button"
            >
              {isLoading ? 'Submitting...' : 'Submit Answer'}
            </button>
          </div>
        ) : (
          <div className="loading-quiz">
            <p>Loading quiz questions...</p>
          </div>
        )}

        {quizResult && (
          <div className="quiz-result">
            <h3>Your Result</h3>
            <p>Score: {quizResult.score}%</p>
            <p>{questions[currentQuestionIndex].explanation}</p>
            
            {quizResult.score >= 50 ? (
              <>
                {!transactionHash ? (
                  <button
                    onClick={claimReward}
                    disabled={claimProcessing || !claimStatus?.canClaim}
                    className="claim-button"
                  >
                    {claimProcessing ? 'Processing...' : 
                      claimStatus?.canClaim ? 'Claim Reward' : 'Daily Claim Limit Reached'}
                  </button>
                ) : (
                  <div className="claim-success">
                    <p>Reward claimed successfully!</p>
                    <p>
                      <a 
                        href={`https://sepolia.etherscan.io/tx/${transactionHash}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        View Transaction
                      </a>
                    </p>
                  </div>
                )}
                <button 
                  onClick={loadQuizQuestion} 
                  className="next-question-button"
                  disabled={isLoading}
                >
                  Try Another Question
                </button>
              </>
            ) : (
              <div className="low-score-message">
                <p>You need a score of at least 50% to claim a reward.</p>
                <button 
                  onClick={loadQuizQuestion} 
                  className="next-question-button"
                  disabled={isLoading}
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;