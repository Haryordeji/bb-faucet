import React from 'react';

export const LoadingButton: React.FC<{
  onClick: () => void;
  disabled: boolean;
  isLoading: boolean;
  className: string;
  children: React.ReactNode;
}> = ({ onClick, disabled, isLoading, className, children }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`button ${className}`}
      style={{marginRight: '5px'}}
    >
      {isLoading && <span className="spinner"></span>}
      {children}
    </button>
  );
};

export const FullPageSpinner: React.FC = () => {
  return (
    <div className="loading-quiz">
      <div className="spinner-large"></div>
      <p>Loading...</p>
    </div>
  );
};

export const ProgressBar: React.FC<{
  current: number;
  total: number;
}> = ({ current, total }) => {
  const percentage = Math.round((current / total) * 100);
  
  return (
    <div className="progress-container">
      <div 
        className="progress-bar" 
        style={{ width: `${percentage}%` }}
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      ></div>
    </div>
  );
};

export const ScoreCircle: React.FC<{
  score: number;
}> = ({ score }) => {
  
  let color = '#e74c3c'; 
  if (score >= 70) color = '#2ecc71'; 
  else if (score >= 50) color = '#f39c12';
  
  return (
    <div className="score-display">
      <div className="score-circle" style={{ 
        background: `conic-gradient(${color} ${score}%, #f5f7fa ${score}% 100%)`
      }}>
        <div className="score-circle-value">{score}%</div>
      </div>
      <p className="score-label">Your Score</p>
    </div>
  );
};