import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import UploadDocument from './components/UploadDocument';
import DocumentVault from './components/DocumentVault';
import LandingPage from './components/LandingPage';
import { ethers } from 'ethers';

function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        return savedTheme === 'dark';
      }
      return true; // Default dark
    }
    return true;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  const checkConnection = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_accounts", []);
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
      } else {
        setWalletAddress(null);
      }
    }
  };

  useEffect(() => {
    checkConnection();

    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          setWalletAddress(null);
        } else {
          setWalletAddress(accounts[0]);
        }
      };
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      return () => window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    }
  }, []);

  return (
    <div className="min-h-screen text-slate-900 flex flex-col overflow-x-hidden transition-colors duration-500 z-0 bg-slate-50 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] dark:bg-slate-950 dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] dark:text-slate-100">
      <Navbar 
        walletAddress={walletAddress} 
        setWalletAddress={setWalletAddress} 
        isDarkMode={isDarkMode} 
        toggleTheme={toggleTheme} 
      />
      
      {/* Main Content Area */}
      <main className="flex-1 w-full flex flex-col items-center justify-start p-4 md:p-8 relative">
        {!walletAddress ? (
          <LandingPage />
        ) : (
          <div className="mt-16 sm:mt-24 flex flex-col items-center justify-center w-full max-w-7xl mx-auto animate-in fade-in duration-500 relative z-10 w-full">
            <h1 className="text-4xl md:text-5xl lg:text-6xl text-center font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 mb-6 font-plus-jakarta tracking-tight">
              DocuChain AI Dashboard
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg md:text-xl text-center max-w-2xl leading-relaxed mb-6 font-inter font-medium tracking-wide">
              Secure your files to IPFS and immutably anchor their hashes on the Ethereum network.
            </p>
            
            <UploadDocument walletAddress={walletAddress} />
            <DocumentVault walletAddress={walletAddress} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
