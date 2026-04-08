import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import abi from '../utils/abi.json';
import { RefreshCw, FileText, Download, Clock, AlertCircle, Lock, MessageSquare, Verified, Database, ChevronRight } from 'lucide-react';
import AIChatModal from './AIChatModal';
import { motion } from 'framer-motion';
import TiltGlassCard from './TiltGlassCard';

const DocumentVault = ({ walletAddress }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeChatDoc, setActiveChatDoc] = useState(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError('');

      if (!window.ethereum) throw new Error("MetaMask not found.");
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
      if (!contractAddress || contractAddress.includes('your_deployed')) {
        throw new Error("Smart Contract address not configured in .env");
      }

      const contract = new ethers.Contract(contractAddress, abi, provider);
      const docs = await contract.getUserDocuments();
      
      const formattedDocs = docs.map(doc => ({
        ipfsHash: doc.ipfsHash,
        fileName: doc.fileName,
        uploadTime: Number(doc.uploadTime) * 1000, 
        owner: doc.owner
      })).reverse(); 

      setDocuments(formattedDocs);
    } catch (err) {
      console.error("Error fetching docs:", err);
      setError(err.message || "Failed to fetch documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!walletAddress) setDocuments([]);
    else fetchDocuments();
  }, [walletAddress]);

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString(undefined, { 
       month: 'short', day: 'numeric', year: 'numeric', 
       hour: '2-digit', minute: '2-digit' 
    });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  };

  return (
    <section className="w-full max-w-6xl mx-auto my-16 z-10 space-y-12 pb-24 relative">

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-2 text-center sm:text-left">
           <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 tracking-tight">The Ledger Vault</h2>
           <p className="text-slate-600 dark:text-slate-400">Your decentralized repository of truth.</p>
        </div>
        <div className="flex gap-4">
           <button 
             onClick={fetchDocuments}
             disabled={loading}
             className="flex items-center gap-2 bg-white dark:bg-[#1a1a1f] hover:bg-slate-50 dark:hover:bg-[#222228] text-indigo-600 dark:text-indigo-400 px-6 py-2.5 rounded-full transition-all border border-slate-200 dark:border-indigo-500/30 shadow-[0_4px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] transform hover:-translate-y-0.5"
           >
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} />
             <span className="font-semibold text-sm">Sync Ledger</span>
           </button>
        </div>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-4 rounded-xl bg-rose-100 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
          <span>{error}</span>
        </motion.div>
      )}

      {loading && documents.length === 0 ? (
        <div className="flex justify-center p-24">
          <RefreshCw className="w-12 h-12 text-teal-500 dark:text-teal-400 animate-spin" strokeWidth={1.5} />
        </div>
      ) : !walletAddress ? (
        <div className="w-full text-center p-16 border-2 border-dashed border-rose-300 dark:border-rose-500/20 rounded-3xl bg-white/70 dark:bg-[#131315]/80 backdrop-blur-xl hover:border-rose-400 transition-colors shadow-2xl">
          <Lock className="w-16 h-16 text-rose-500 dark:text-rose-400 mx-auto mb-6 opacity-80" strokeWidth={1.5} />
          <h3 className="text-rose-900 dark:text-rose-100 text-3xl font-bold mb-3">Vault Locked</h3>
          <p className="text-rose-600 dark:text-rose-400/80 text-lg">Connect Wallet to access your mathematically secured documents.</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center p-16 border-2 border-dashed border-slate-300 dark:border-white/20 rounded-3xl bg-white/70 dark:bg-[#131315]/80 backdrop-blur-xl hover:border-indigo-400 transition-colors cursor-pointer shadow-2xl" onClick={() => window.scrollTo(0, 0)}>
          <Database className="w-16 h-16 text-slate-400 dark:text-slate-500 mx-auto mb-6" strokeWidth={1.5} />
          <p className="text-slate-900 dark:text-white text-2xl font-bold">Your ledger is empty</p>
          <p className="text-slate-500 mt-3 text-lg">Upload a document above to securely link it forever.</p>
        </div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {documents.map((doc, idx) => (
            <TiltGlassCard key={idx} className="group relative overflow-hidden bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-white/10 p-8 flex flex-col gap-6 transition-all shadow-xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:shadow-2xl hover:border-indigo-500/50">
              
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-transparent to-teal-400/0 group-hover:from-indigo-500/5 group-hover:to-teal-400/5 transition-colors duration-500 -z-10 pointer-events-none"></div>
              
              <div className="flex justify-between items-start z-10 w-full pointer-events-none">
                <div className="p-3 rounded-xl bg-white/60 dark:bg-[#2a2a2c]/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-white/5 shadow-inner">
                  <FileText className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold tracking-widest uppercase mb-1">Verified On-Chain</span>
                  <div className="bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 p-1 rounded-full border border-teal-200 dark:border-teal-500/20">
                     <Verified className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 z-10 w-full pointer-events-none">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate" title={doc.fileName}>
                  {doc.fileName}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" strokeWidth={1.5} />
                  {formatDate(doc.uploadTime)}
                </p>
              </div>
              
              <div className="mt-auto flex items-center gap-3 pt-6 z-50 pointer-events-auto w-full relative">
                <button
                  onClick={() => setActiveChatDoc({ cid: doc.ipfsHash, name: doc.fileName })}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:scale-105 hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(99,102,241,0.6)] transition-all duration-200 text-sm cursor-pointer z-50 relative pointer-events-auto border border-indigo-400/30"
                >
                  <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
                  Chat with AI
                </button>
                <a 
                  href={`https://gateway.pinata.cloud/ipfs/${doc.ipfsHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-emerald-500 hover:bg-emerald-400 text-white p-3 rounded-xl flex items-center justify-center gap-2 hover:scale-105 hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(16,185,129,0.6)] transition-all duration-200 cursor-pointer z-50 relative pointer-events-auto text-sm border border-emerald-400/30"
                  title="Download File"
                >
                  <Download className="w-5 h-5" strokeWidth={1.5} />
                </a>
              </div>
            </TiltGlassCard>
          ))}
        </motion.div>
      )}

      {/* Mini Stats Section mimicking Dashboard style */}
      {documents.length > 0 && walletAddress && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 pt-16 border-t border-slate-200 dark:border-white/10 z-10">
            <div className="p-6 rounded-2xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 shadow-sm text-center md:text-left">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-bold tracking-widest uppercase">Vault Documents</span>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{documents.length}</div>
            </div>
            <div className="p-6 rounded-2xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 shadow-sm text-center md:text-left">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-bold tracking-widest uppercase">Encryption</span>
              <div className="text-3xl font-extrabold text-teal-600 dark:text-teal-400 mt-1">AES-256</div>
            </div>
            <div className="p-6 rounded-2xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 shadow-sm text-center md:text-left">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-bold tracking-widest uppercase">Network Status</span>
              <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">99.9%</div>
            </div>
            <div className="p-6 rounded-2xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 shadow-sm text-center md:text-left">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-bold tracking-widest uppercase">AI Validation</span>
              <div className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">Active</div>
            </div>
          </motion.div>
      )}

      {activeChatDoc && (
        <AIChatModal 
          documentCid={activeChatDoc.cid} 
          documentName={activeChatDoc.name} 
          onClose={() => setActiveChatDoc(null)} 
        />
      )}
    </section>
  );
};

export default DocumentVault;
