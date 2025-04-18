import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import { QuizQuestion, FreeResponseQuestion, QuizResult, ClaimResponse, ClaimStatus } from './types';
import { fetchQuizQuestions, submitQuizAnswers, getClaimStatus, initiateClaim } from './utils/api';
import { LoadingButton, FullPageSpinner, ProgressBar, ScoreCircle } from './components/Loading';
import { ErrorMessage, FeedbackOverlay } from './components/Feedback';
import EthereumLoader from './components/EthereumLoader';

const App: React.FC = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [freeResponseQuestion, setFreeResponseQuestion] = useState<FreeResponseQuestion | null>(null);
  const [freeResponseAnswer, setFreeResponseAnswer] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<(number | null)[]>([]);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<ClaimStatus | null>(null);
  const [claimProcessing, setClaimProcessing] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [feedbackVisible, setFeedbackVisible] = useState(false);

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
      setError(null);
      const data = await fetchQuizQuestions(5);
      
      setQuestions(data.questions);
      setFreeResponseQuestion(data.freeResponseQuestion);
      setSelectedOptions(new Array(data.questions.length).fill(null));
      setFreeResponseAnswer('');
      setQuizResult(null);
      setTransactionHash(null);
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
    return (
      selectedOptions.every(option => option !== null) && 
      freeResponseAnswer.trim().length > 0
    );
  };

  // Submit all answers
  const submitAnswers = async () => {
    if (!allQuestionsAnswered() || !questions.length || !freeResponseQuestion) return;

    try {
      setIsLoading(true);
      
      // Prepare arrays for question IDs, user answers, and correct answers
      const questionIds = questions.map(q => q.question);
      const userAnswers = questions.map((q, index) => {
        const selectedIndex = selectedOptions[index];
        return selectedIndex !== null ? q.options[selectedIndex] : '';
      });
      const correctAnswers = questions.map(q => q.correctAnswer);
      
      // Submit all answers together including free response
      const result = await submitQuizAnswers(
        questionIds,
        userAnswers,
        correctAnswers,
        freeResponseAnswer,
        freeResponseQuestion.question,
        freeResponseQuestion.rubric
      );

      setQuizResult(result);
      
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
      setFeedbackVisible(true); 
      
      const result = await initiateClaim(walletAddress, quizResult.score);
      
      if (result.success && result.transactionHash) {
        setTransactionHash(result.transactionHash);
        
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
      setFeedbackVisible(false);
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
          <LoadingButton 
            onClick={connectWallet} 
            disabled={false}
            isLoading={isLoading}
            className="connect-button"
          >
            Connect MetaMask
          </LoadingButton>
        ) : (
          <div className="wallet-info">
            <div className="wallet-address">
              <span className="wallet-icon">💳</span>
              <p>Connected: {`${walletAddress.substring(0, 6)}...${walletAddress.substring(38)}`}</p>
            </div>
            {claimStatus && (
              <div className="wallet-status">
                <span className="status-indicator"></span>
                <div className="claim-info">
                  Remaining claims: <span className="claim-count">{claimStatus.remainingClaims}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      <ErrorMessage error={error} onDismiss={() => setError(null)} />

      <main className="quiz-container">
        {!walletAddress ? (
          <div className="wallet-required">
            <h2>Connect Your Wallet</h2>
            <p>Please connect your MetaMask wallet to participate in quizzes and earn rewards.</p>
          </div>
        ) : questions.length > 0 && !quizResult ? (
          <>
            <h2>Blockchain Quiz</h2>
            
            <ProgressBar 
              current={selectedOptions.filter(option => option !== null).length} 
              total={questions.length} 
            />
            
            <div className="quiz-section-title">Multiple Choice Questions</div>
            <div className="all-questions">
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
            </div>
            
            <hr className="section-divider" />
            
            {freeResponseQuestion && (
              <div className="free-response-section">
                <h3>Free Response Question</h3>
                <p className="free-response-question">{freeResponseQuestion.question}</p>
                
                <textarea
                  className="free-response-input"
                  value={freeResponseAnswer}
                  onChange={(e) => setFreeResponseAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={8}
                />
                
                <div className="answer-count">
                  <span>{freeResponseAnswer.trim().length > 0 ? 'Your answer' : 'Please provide an answer'}</span>
                  <span>{freeResponseAnswer.length} characters</span>
                </div>
              </div>
            )}
            
            <LoadingButton
              onClick={submitAnswers}
              disabled={!allQuestionsAnswered()}
              isLoading={isLoading}
              className="submit-button"
            >
              Submit Quiz
            </LoadingButton>
          </>
        ) : isLoading ? (
          <EthereumLoader />
        ) : null}

        {quizResult && (
          <div className="quiz-result">
            <h3>Your Results</h3>
            
            <ScoreCircle score={quizResult.score} />
            
            {quizResult.multipleChoice && (
              <>
                <div className="quiz-section-title">Multiple Choice Results</div>
                <p>Score: {quizResult.multipleChoice.score}% ({quizResult.multipleChoice.totalCorrect}/{quizResult.multipleChoice.totalQuestions} correct)</p>
                
                {/* Display individual question results */}
                <div className="question-results">
                  {questions.map((question, index) => (
                    <div key={index} className="question-result">
                      <h4>Question {index + 1}</h4>
                      <p>{question.question}</p>
                      
                      {/* Replace the answer status section with this new code */}
                      <div className="result-options-container">
                        {question.options.map((option, optionIndex) => {
                          const isUserSelection = selectedOptions[index] === optionIndex;
                          const isCorrectAnswer = option === question.correctAnswer;
                          const isIncorrectSelection = isUserSelection && !isCorrectAnswer;
                          
                          return (
                            <div
                              key={optionIndex}
                              className={`result-option ${isCorrectAnswer ? 'correct-answer' : ''} ${isIncorrectSelection ? 'incorrect-answer' : ''}`}
                            >
                              {option}
                              
                              {isUserSelection && !isCorrectAnswer && (
                                <span className="result-option-label your-answer">Your answer</span>
                              )}
                              
                              {isCorrectAnswer && (
                                <span className="result-option-label correct">
                                  {isUserSelection ? 'Correct' : 'Correct answer'}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="explanation">{question.explanation}</div>
                    </div>
                  ))}
                </div>

              </>
            )}
            
            {quizResult.freeResponse && (
              <>
                <div className="quiz-section-title">Free Response Results</div>
                <div className="free-response-result">
                  <h4>Question</h4>
                  <p>{freeResponseQuestion?.question}</p>
                  
                  <h4>Your Answer</h4>
                  <p>{freeResponseAnswer}</p>
                  
                  <p className="free-response-score">Score: {quizResult.freeResponse.score}%</p>
                  
                  <div className="feedback-container">
                    <div className="feedback-title">Feedback:</div>
                    <p className="feedback">{quizResult.freeResponse.feedback}</p>
                  </div>
                </div>
              </>
            )}
            
            {quizResult.score >= 50 ? (
              <>
                {!transactionHash ? (
                  <LoadingButton
                    onClick={claimReward}
                    disabled={!claimStatus?.canClaim}
                    isLoading={claimProcessing}
                    className="claim-button"
                  >
                    {claimStatus?.canClaim ? 'Claim Reward' : 'Daily Claim Limit Reached'}
                  </LoadingButton>
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
                <LoadingButton 
                  onClick={loadQuizQuestions} 
                  className="next-question-button"
                  disabled={isLoading}
                  isLoading={false}
                >
                  Take Another Quiz
                </LoadingButton>
              </>
            ) : (
              <div className="low-score-message">
                <p>You need a score of at least 50% to claim a reward.</p>
                <LoadingButton 
                  onClick={loadQuizQuestions} 
                  className="next-question-button"
                  disabled={isLoading}
                  isLoading={false}
                >
                  Try Again
                </LoadingButton>
              </div>
            )}
          </div>
        )}

          <FeedbackOverlay 
            message="Processing your claim..." 
            visible={feedbackVisible} 
          />
      </main>
    </div>
  );
};

export default App;