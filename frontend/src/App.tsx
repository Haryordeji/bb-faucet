import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface QuizResult {
  score: number;
  isCorrect: boolean;
}

const App: React.FC = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if MetaMask is installed
  const isMetaMaskInstalled = () => {
    return typeof window.ethereum !== 'undefined';
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
        // TODO: display visual error message
      }
      
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      setWalletAddress(accounts[0]);
      setProvider(provider);
      setError(null);
      
      // Load a quiz question after connecting
      await loadQuizQuestion();
    } catch (err) {
      setError('Failed to connect wallet. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load a quiz question from the backend
  const loadQuizQuestion = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('http://localhost:3000/api/quiz/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slideContent: 'Blockchain is a decentralized ledger technology that allows data to be stored globally on thousands of servers.',
          numQuestions: 1,
          difficulty: 'beginner'
        }),
      });

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
      const response = await fetch('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionId: questions[currentQuestionIndex].question, // Using question as ID for simplicity
          selectedOption,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit answer');
      }

      const result = await response.json();
      setQuizResult(result);
    } catch (err) {
      setError('Failed to submit answer. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Claim the reward
  const claimReward = async () => {
    if (!provider || !walletAddress || !quizResult) return;

    try {
      setIsLoading(true);
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
        throw new Error('Failed to claim reward');
      }

      const result = await response.json();
      if (result.success) {
        alert(`Reward claimed successfully! Transaction hash: ${result.transactionHash}`);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      setError(`Failed to claim reward: ${err instanceof Error ? err.message : String(err)}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle MetaMask account changes
  useEffect(() => {
    if (!isMetaMaskInstalled()) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setWalletAddress(null);
        setProvider(null);
      } else {
        setWalletAddress(accounts[0]);
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
            
            {quizResult.score >= 50 && (
              <button
                onClick={claimReward}
                disabled={isLoading}
                className="claim-button"
              >
                {isLoading ? 'Processing...' : 'Claim Reward'}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;