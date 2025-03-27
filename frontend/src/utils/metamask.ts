import { ethers } from 'ethers';

// The global window.ethereum type is defined in src/types/ethereum.d.ts

export const connectMetaMask = async (): Promise<{
  provider: ethers.BrowserProvider;
  address: string;
}> => {
  if (typeof window === 'undefined' || typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask is not installed');
  }

  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  const provider = new ethers.BrowserProvider(window.ethereum as any);
  
  return {
    provider,
    address: accounts[0]
  };
};

export const checkMetaMaskInstalled = (): boolean => {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
};

export const listenForAccountChanges = (
  callback: (newAddress: string | null) => void
): (() => void) => {
  if (typeof window === 'undefined' || typeof window.ethereum === 'undefined') {
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