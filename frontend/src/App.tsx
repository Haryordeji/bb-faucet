import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import { QuizQuestion, QuizResult, ClaimResponse, ClaimStatus } from './types';
import { fetchQuizQuestions, submitQuizAnswers, getClaimStatus, initiateClaim } from './utils/api';

const App: React.FC = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<(number | null)[]>([]);
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
      
      // Load quiz questions after connecting
      await loadQuizQuestions();
      
      // Get claim status for this address
      if (accounts[0]) {
        await fetchClaimStatusForUser(accounts[0]);
      }
    } catch (err) {
      setError('Failed to connect wallet. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch claim status for the current wallet
  const fetchClaimStatusForUser = async (address: string) => {
    try {
      const data = await getClaimStatus(address);
      setClaimStatus(data);
    } catch (err) {
      console.error('Error fetching claim status:', err);
      // Don't set error state here to avoid disrupting the main flow
    }
  };

  // Load quiz questions from the backend
  const loadQuizQuestions = async () => {
    try {
      setIsLoading(true);
      const data = await fetchQuizQuestions(5);
      
      setQuestions(data.questions);
      setSelectedOptions(new Array(data.questions.length).fill(null));
      setQuizResult(null);
    } catch (err) {
      setError('Failed to load quiz questions. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle selecting an option for a specific question
  const handleOptionSelect = (questionIndex: number, optionIndex: number) => {
    const newSelectedOptions = [...selectedOptions];
    newSelectedOptions[questionIndex] = optionIndex;
    setSelectedOptions(newSelectedOptions);
  };

  // Check if all questions have a selected answer
  const allQuestionsAnswered = () => {
    return selectedOptions.every(option => option !== null);
  };

  // Submit all answers
  const submitAnswers = async () => {
    if (!allQuestionsAnswered() || !questions.length) return;

    try {
      setIsLoading(true);
      
      // Prepare arrays for question IDs, user answers, and correct answers
      const questionIds = questions.map(q => q.question);
      const userAnswers = questions.map((q, index) => {
        const selectedIndex = selectedOptions[index];
        return selectedIndex !== null ? q.options[selectedIndex] : '';
      });
      const correctAnswers = questions.map(q => q.correctAnswer);
      
      // Submit all answers together
      const result = await submitQuizAnswers(
        questionIds,
        userAnswers,
        correctAnswers
      );

      setQuizResult({
        score: result.score,
        isCorrect: result.isCorrect,
      });
      
      // Refresh claim status after submitting
      if (walletAddress) {
        await fetchClaimStatusForUser(walletAddress);
      }
    } catch (err) {
      setError('Failed to submit answers. Please try again.');
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
      
      const result = await initiateClaim(walletAddress, quizResult.score);
      
      if (result.success && result.transactionHash) {
        setTransactionHash(result.transactionHash);
        
        // Refresh claim status after claiming
        if (walletAddress) {
          await fetchClaimStatusForUser(walletAddress);
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
        fetchClaimStatusForUser(accounts[0]);
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
        ) : questions.length > 0 && !quizResult ? (
          <div className="all-questions">
            <h2>Blockchain Quiz</h2>
            
            {questions.map((question, questionIndex) => (
              <div key={questionIndex} className="quiz-question">
                <h3>Question {questionIndex + 1}</h3>
                <p>{question.question}</p>
                
                <div className="options-container">
                  {question.options.map((option, optionIndex) => (
                    <div
                      key={optionIndex}
                      className={`option ${selectedOptions[questionIndex] === optionIndex ? 'selected' : ''}`}
                      onClick={() => handleOptionSelect(questionIndex, optionIndex)}
                    >
                      {option}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            <button
              onClick={submitAnswers}
              disabled={!allQuestionsAnswered() || isLoading}
              className="submit-button"
            >
              {isLoading ? 'Submitting...' : 'Submit All Answers'}
            </button>
          </div>
        ) : isLoading ? (
          <div className="loading-quiz">
            <p>Loading quiz questions...</p>
          </div>
        ) : null}

        {quizResult && (
          <div className="quiz-result">
            <h3>Your Results</h3>
            <p>Overall Score: {quizResult.score}%</p>
            
            {/* Display individual question results */}
            <div className="question-results">
              {questions.map((question, index) => (
                <div key={index} className="question-result">
                  <h4>Question {index + 1}</h4>
                  <p>{question.question}</p>
                  <p>Your answer: {selectedOptions[index] !== null ? 
                      question.options[selectedOptions[index]] : 'No answer'}</p>
                  <p>Correct answer: {question.correctAnswer}</p>
                  <p className="explanation">{question.explanation}</p>
                </div>
              ))}
            </div>
            
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
                  onClick={loadQuizQuestions} 
                  className="next-question-button"
                  disabled={isLoading}
                >
                  Take Another Quiz
                </button>
              </>
            ) : (
              <div className="low-score-message">
                <p>You need a score of at least 50% to claim a reward.</p>
                <button 
                  onClick={loadQuizQuestions} 
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