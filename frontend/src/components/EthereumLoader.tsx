
import React, { useState, useEffect } from 'react';

interface EthereumLoaderProps {
  message?: string;
}

const loadingMessages = [
  "Connecting to the blockchain...",
  "Generating questions...",
  "Validating smart contract...",
  "Processing quiz data...",
  "Optimizing quiz difficulty..."
];

export const EthereumLoader: React.FC<EthereumLoaderProps> = ({ 
  message = "Preparing your quiz" 
}) => {
  const [currentMessage, setCurrentMessage] = useState(loadingMessages[0]);
  const [particles, setParticles] = useState<{ id: number; left: number; top: number; delay: number; tx: number }[]>([]);
  
  useEffect(() => {
    let currentIndex = 0;
    
    const intervalId = setInterval(() => {
      currentIndex = (currentIndex + 1) % loadingMessages.length;
      setCurrentMessage(loadingMessages[currentIndex]);
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  useEffect(() => {
    const initialParticles = Array.from({ length: 15 }).map((_, index) => ({
      id: index,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 2,
      tx: (Math.random() * 100) - 50 
    }));
    
    setParticles(initialParticles);
    
    const particleInterval = setInterval(() => {
      setParticles(prev => {
        const newParticles = [...prev];
        for (let i = 0; i < 5; i++) {
          const randomIndex = Math.floor(Math.random() * newParticles.length);
          newParticles[randomIndex] = {
            id: newParticles[randomIndex].id,
            left: Math.random() * 100,
            top: Math.random() * 100,
            delay: Math.random() * 2,
            tx: (Math.random() * 100) - 50
          };
        }
        return newParticles;
      });
    }, 3000);
    
    return () => clearInterval(particleInterval);
  }, []);
  
  return (
    <div className="eth-loader-container">
      <h3>{message}</h3>
      
      <div className="eth-coin">
        <div className="eth-symbol">Ξ</div>
      </div>
      
      <div className="eth-particles">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="particle"
            style={{
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              animationDelay: `${particle.delay}s`,
              '--tx': `${particle.tx}px`
            } as React.CSSProperties}
          ></div>
        ))}
      </div>
      
      <div className="loading-progress">
        <div className="progress-bar2"></div>
      </div>
      
      <div className="loading-status">{currentMessage}</div>
    </div>
  );
};

export default EthereumLoader;