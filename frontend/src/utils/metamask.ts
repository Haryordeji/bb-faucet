import { ethers } from 'ethers';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string }) => Promise<string[]>;
      on: (event: string, callback: (accounts: string[]) => void) => void;
      removeListener: (event: string, callback: (accounts: string[]) => void) => void;
    };
  }
}

export const connectMetaMask = async (): Promise<{
  provider: ethers.BrowserProvider;
  address: string;
}> => {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask is not installed');
  }

  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  const provider = new ethers.BrowserProvider(window.ethereum);
  
  return {
    provider,
    address: accounts[0]
  };
};

export const checkMetaMaskInstalled = (): boolean => {
  return typeof window.ethereum !== 'undefined';
};

export const listenForAccountChanges = (
  callback: (newAddress: string | null) => void
): (() => void) => {
  if (typeof window.ethereum === 'undefined') {
    return () => {};
  }

  const handleAccountsChanged = (accounts: string[]) => {
    callback(accounts.length > 0 ? accounts[0] : null);
  };

  window.ethereum.on('accountsChanged', handleAccountsChanged);

  return () => {
    window.ethereum!.removeListener('accountsChanged', handleAccountsChanged);
  };
};