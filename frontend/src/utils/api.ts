// API utility for making requests to the backend

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const fetchQuizQuestions = async (numQuestions = 1) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/quiz/generate?numQuestions=${numQuestions}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch quiz questions');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching quiz questions:', error);
    throw error;
  }
};

export const submitQuizAnswers = async (questionIds: string[], answers: string[], correctAnswers: string[]) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/quiz/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        questionIds,
        answers,
        correctAnswers,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to submit quiz answers');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error submitting quiz answers:', error);
    throw error;
  }
};

export const getClaimStatus = async (userAddress: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/claim/status/${userAddress}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch claim status');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching claim status:', error);
    throw error;
  }
};

export const initiateClaim = async (userAddress: string, scorePercentage: number) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/claim/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userAddress,
        scorePercentage,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to claim reward');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error initiating claim:', error);
    throw error;
  }
};