import React from 'react';
import { ethers } from 'ethers';
import { Wallet, Sparkles, LogOut, Sun, Moon } from 'lucide-react';

const Navbar = ({ walletAddress, setWalletAddress, isDarkMode, toggleTheme }) => {

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
        }
      } catch (error) {
        console.error("Error connecting to wallet:", error);
      }
    } else {
      alert("Please install MetaMask to use this completely Web3 feature!");
    }
  };

  const formatAddress = (address) => {
    return `${address.substring(0, 5)}...${address.substring(address.length - 4)}`;
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 w-full px-6 py-4 flex items-center justify-between transition-colors duration-300 shadow-sm dark:shadow-none">
      <div className="flex items-center gap-2">
        <Sparkles className="text-teal-600 dark:text-teal-400 w-6 h-6" />
        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-indigo-600 dark:from-teal-400 dark:to-indigo-400">
          DocuChain AI
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Theme Toggle Button */}
        <button 
          onClick={toggleTheme}
          className="p-2 rounded-full bg-slate-200/50 hover:bg-slate-300/50 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-yellow-300 transition-colors"
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Wallet Controls */}
        <div className="flex flex-col items-end">
          {walletAddress ? (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-green-100 dark:bg-green-500/10 border border-green-300 dark:border-green-500/50 text-green-700 dark:text-green-400 px-4 py-2 rounded-xl text-sm font-medium shadow-[0_0_15px_rgba(34,197,94,0.1)] dark:shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-colors duration-300">
                  <span className="w-2 h-2 rounded-full bg-green-500 dark:bg-green-400 animate-pulse"></span>
                  {formatAddress(walletAddress)}
                </div>
                <button 
                  onClick={disconnectWallet}
                  className="p-2 border border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/10 hover:border-rose-400 dark:hover:border-rose-500/50 rounded-xl transition-all shadow-sm dark:shadow-[0_0_10px_rgba(244,63,94,0.1)] hover:shadow-md dark:hover:shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                  title="Disconnect from App"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-500/70 mr-1 max-w-[200px] text-right leading-tight hidden sm:block">
                Note: To fully revoke access, disconnect from within the MetaMask extension
              </p>
            </div>
          ) : (
            <button 
              onClick={connectWallet}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-[0_4px_15px_rgba(79,70,229,0.3)] dark:shadow-[0_0_15px_rgba(99,102,241,0.4)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.4)] dark:hover:shadow-[0_0_20px_rgba(99,102,241,0.6)]"
            >
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
