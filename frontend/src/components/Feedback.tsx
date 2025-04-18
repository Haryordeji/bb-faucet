import React, { useState, useEffect } from 'react';

export const ErrorMessage: React.FC<{
    error: string | null;
    onDismiss: () => void;
  }> = ({ error, onDismiss }) => {
    const [expanded, setExpanded] = useState(false);
    
    if (!error) return null;
    
    let formattedError = error;
    let errorTitle = 'Error';
    const originalError = error;
    
    if (error.includes('Insufficient faucet balance')) {
      errorTitle = 'Transaction Failed';
      formattedError = 'The faucet does not have enough funds to process your claim right now.';
    } else if (error.includes('Daily claim limit reached')) {
      errorTitle = 'Claim Limit Exceeded';
      formattedError = 'You have reached your daily claim limit. Please try again tomorrow.';
    } else if (error.includes('execution reverted')) {
      const errorMatch = error.match(/execution reverted: "(.*?)"/);
      if (errorMatch && errorMatch[1]) {
        errorTitle = 'Transaction Failed';
        formattedError = errorMatch[1];
      }
    }
    
    return (
      <div className="error-message">
        <div className="error-message-header">
          <h4 className="error-message-title">{errorTitle}</h4>
          <button className="error-message-dismiss" onClick={onDismiss}>×</button>
        </div>
        
        <div className={`error-message-content ${expanded ? 'expanded' : ''}`}>
          <p>{expanded ? originalError : formattedError}</p>
        </div>
        
        {originalError.length > 100 && (
          <button 
            className="error-message-toggle" 
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : 'Show technical details'}
          </button>
        )}
      </div>
    );
  };

export const FeedbackOverlay: React.FC<{
    message: string;
    visible: boolean;
  }> = ({ message, visible }) => {
    return (
      <div className={`feedback-overlay ${visible ? 'visible' : 'hidden'}`}>
        <div className="feedback-overlay-spinner"></div>
        <span>{message}</span>
      </div>
    );
  };