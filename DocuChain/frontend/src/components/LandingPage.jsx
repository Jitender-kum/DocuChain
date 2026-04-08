import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Zap, FileJson, ArrowRight, Play } from 'lucide-react';
import TiltGlassCard from './TiltGlassCard';

const FloatingShapes = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
       <motion.div 
         animate={{ y: [0, -40, 0], opacity: [0.3, 0.6, 0.3] }}
         transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
         className="absolute top-20 left-[10%] w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px]" 
       />
       <motion.div 
         animate={{ y: [0, 50, 0], opacity: [0.2, 0.5, 0.2] }}
         transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
         className="absolute bottom-20 right-[15%] w-96 h-96 bg-teal-400/20 rounded-full blur-[100px]" 
       />
       <motion.div 
         animate={{ rotate: 360, scale: [1, 1.2, 1] }}
         transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
         className="absolute top-[40%] left-[60%] w-72 h-72 border border-indigo-500/10 rounded-full" 
       />
    </div>
  );
};

const LandingPage = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 80, damping: 15 } }
  };

  return (
    <div className="relative w-full min-h-screen flex flex-col items-center pt-24 pb-20 px-6 sm:px-12 bg-transparent transition-colors duration-500 z-0">
      
      {/* 3D Moving Mesh / Floating Shapes Background */}
      <FloatingShapes />

      {/* Hero Section */}
      <motion.div 
        variants={containerVariants} 
        initial="hidden" 
        animate="show"
        className="w-full max-w-5xl mx-auto flex flex-col items-center text-center mt-12 z-10"
      >
        <motion.div variants={itemVariants} className="inline-flex items-center gap-2 bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-5 py-2 rounded-full mb-10 shadow-sm dark:shadow-none backdrop-blur-md">
          <Zap className="w-4 h-4 text-teal-500 dark:text-teal-400" strokeWidth={2} />
          <span className="text-xs font-bold tracking-widest uppercase text-slate-800 dark:text-teal-400">v1.0 is now live on Testnet</span>
        </motion.div>
        
        <motion.h1 variants={itemVariants} className="text-6xl md:text-8xl font-extrabold tracking-tighter mb-8 text-slate-900 dark:text-white leading-[1.1]">
          The Ethereal <br/>
          <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 bg-clip-text text-transparent">
             Ledger.
          </span>
        </motion.h1>
        
        <motion.p variants={itemVariants} className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-12 max-w-2xl leading-relaxed">
           AI-powered document orchestration on the blockchain. Verifiable, immutable, and intelligently context-aware for the decentralized era.
        </motion.p>
        
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-3 bg-gradient-to-r from-indigo-500 via-indigo-600 to-teal-500 text-white px-10 py-5 rounded-full font-bold text-lg shadow-[0_10px_30px_rgba(79,70,229,0.4)] dark:shadow-[0_0_20px_rgba(99,102,241,0.6)] dark:hover:shadow-[0_0_35px_rgba(99,102,241,0.8)] transition-shadow"
            onClick={() => {
              const btn = document.querySelector('nav button:last-child');
              if (btn) btn.click();
            }}
          >
            Connect Wallet
            <ArrowRight className="w-6 h-6" strokeWidth={2} />
          </motion.button>
          <button className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-8 py-4 font-bold transition-colors">
             Explore Protocol
          </button>
        </motion.div>
      </motion.div>

      {/* Feature Bento Grid wrapped in Framer Tilt Component */}
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8 }}
        className="w-full max-w-6xl mx-auto mt-32 grid grid-cols-1 md:grid-cols-12 gap-8 z-10"
      >
        {/* Feature 1 */}
        <div className="md:col-span-7 h-full">
           <TiltGlassCard className="h-full bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-white/10 p-10 hover:border-indigo-500/50 dark:hover:border-indigo-500/30 transition-colors shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
             <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-8 shadow-inner border border-indigo-200 dark:border-indigo-500/10">
               <Shield className="text-indigo-600 dark:text-indigo-400 w-8 h-8" strokeWidth={1.5} />
             </div>
             <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Immutable Storage</h3>
             <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg max-w-sm">
                Decentralized document archiving powered by IPFS. Your records are mathematically permanent and cryptographically secured forever.
             </p>
           </TiltGlassCard>
        </div>

        {/* Feature 2 */}
        <div className="md:col-span-5 h-full">
           <TiltGlassCard className="h-full bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-white/10 p-10 hover:border-teal-500/50 dark:hover:border-teal-400/30 transition-colors shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
             <div className="w-16 h-16 bg-teal-100 dark:bg-teal-500/20 rounded-2xl flex items-center justify-center mb-8 shadow-inner border border-teal-200 dark:border-teal-500/10">
               <Zap className="text-teal-600 dark:text-teal-400 w-8 h-8" strokeWidth={1.5} />
             </div>
             <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">AI Verification</h3>
             <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg">
                Automated Gemini vision screening processes all uploads to intelligently detect tampering.
             </p>
           </TiltGlassCard>
        </div>

        {/* Feature 3 (Full Span) */}
        <div className="md:col-span-12">
           <TiltGlassCard className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-white/10 p-12 hover:border-purple-500/50 dark:hover:border-purple-500/30 transition-colors shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col md:flex-row items-center justify-between gap-12">
              <div className="flex-1">
                 <div className="w-16 h-16 bg-purple-100 dark:bg-purple-500/20 rounded-2xl flex items-center justify-center mb-8 shadow-inner border border-purple-200 dark:border-purple-500/10">
                   <FileJson className="text-purple-600 dark:text-purple-400 w-8 h-8" strokeWidth={1.5} />
                 </div>
                 <h3 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-6">Chat with Context</h3>
                 <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg max-w-xl">
                    Query thousands of on-chain documents instantly. Ask questions, summarize complex contracts, and extract data rapidly right inside the Vault using native multi-modal integration.
                 </p>
              </div>
              
              {/* Decorative mini chat UI */}
              <div className="flex-1 w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-inner">
                 <div className="flex gap-4 items-start mb-6">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 shrink-0 border border-indigo-200 dark:border-indigo-500/30"></div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl rounded-tl-none text-sm text-slate-700 dark:text-slate-200 shadow-sm">Analyze the liability clause in the smart contract Hash...</div>
                 </div>
                 <div className="flex gap-4 items-start justify-end">
                    <div className="bg-gradient-to-r from-teal-500 to-emerald-500 p-4 rounded-xl rounded-tr-none text-sm text-right text-white shadow-md">The liability is capped at 5,000 ETH...</div>
                    <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-500/20 shrink-0 border border-teal-200 dark:border-teal-500/30"></div>
                 </div>
              </div>
           </TiltGlassCard>
        </div>
      </motion.div>
    </div>
  );
};

export default LandingPage;
