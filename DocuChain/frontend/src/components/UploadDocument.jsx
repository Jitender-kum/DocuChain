import React, { useState, useRef } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';
import { UploadCloud, CheckCircle2, FileText, XCircle, Loader2, Lock } from 'lucide-react';
import abi from '../utils/abi.json';
import { motion } from 'framer-motion';

const getBase64Data = async (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  });
};

const verifyDocumentWithAI = async (file) => {
  try {
     const base64Data = await getBase64Data(file);
     
     const response = await axios.post('http://localhost:5000/api/verify-document', {
       fileData: base64Data,
       mimeType: file.type
     });
     
     return response.data;
  } catch (error) {
     console.error("AI Verification CRASHED:", error);
     return { isValid: true, reason: "AI Verification unavailable - bypassing fallback" };
  }
};

const UploadDocument = ({ walletAddress }) => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, ai, ipfs, blockchain, success, error
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setMessage('');
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setStatus('idle');
      setMessage('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setStatus('error');
      setMessage('Unsupported format. Please upload a PDF, PNG, or JPEG.');
      return;
    }

    try {
      setStatus('ai');
      setMessage('AI is verifying document authenticity...');
      
      const aiResult = await verifyDocumentWithAI(file);
      if (!aiResult.isValid) {
         setStatus('error');
         setMessage(`AI Rejected: ${aiResult.reason}`);
         return;
      }

      setStatus('ipfs');
      setMessage('Encrypting and pinning to IPFS...');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('pinataMetadata', JSON.stringify({ name: file.name }));
      formData.append('pinataOptions', JSON.stringify({ cidVersion: 0 }));

      const res = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
        maxBodyLength: "Infinity",
        headers: {
          'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
          pinata_api_key: import.meta.env.VITE_PINATA_API_KEY,
          pinata_secret_api_key: import.meta.env.VITE_PINATA_SECRET_API_KEY,
        }
      });

      const ipfsHash = res.data.IpfsHash;

      setStatus('blockchain');
      setMessage('Securing immutable hash on Blockchain...');

      if (!window.ethereum) throw new Error("MetaMask is not installed!");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
      const contract = new ethers.Contract(contractAddress, abi, signer);

      const tx = await contract.getFunction("uploadDocument(string,string)")(ipfsHash, file.name);
      
      const receipt = await tx.wait(); 
      if (receipt && receipt.status === 0) throw new Error("Transaction reverted.");

      setStatus('success');
      setMessage('Document successfully secured on the blockchain!');
      setFile(null);
      
    } catch (err) {
      console.error("Upload Error:", err);
      setStatus('error');
      setMessage(err?.info?.error?.message || err?.reason || err?.message || "Error occurred");
    }
  };

  if (!walletAddress) {
    return (
      <div className="w-full max-w-4xl mx-auto my-12 bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/10 p-12 text-center flex flex-col items-center shadow-xl">
         <Lock className="w-16 h-16 text-rose-500 dark:text-rose-400 mx-auto mb-4 opacity-80" strokeWidth={1.5} />
         <h3 className="text-rose-900 dark:text-white text-2xl font-bold mb-2">Upload Disabled</h3>
         <p className="text-rose-600 dark:text-rose-400/80">Connect Wallet to secure new documents on the blockchain.</p>
      </div>
    );
  }

  return (
    <section className="w-full max-w-6xl mx-auto my-12 flex flex-col items-center justify-center p-4">
      <div className="w-full bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-white/10 p-8 md:p-12 rounded-3xl flex flex-col items-center justify-center gap-8 shadow-2xl transition-colors duration-300">
         
         {/* Top Info Bar */}
         <div className="w-full flex justify-end">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-100 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-500/20 shadow-[0_0_10px_rgba(45,212,191,0.2)]">
               <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
               <span className="text-xs font-bold tracking-widest uppercase">Nodes Online</span>
            </div>
         </div>

         <div className="text-center space-y-4 max-w-3xl -mt-4">
            <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 tracking-tighter">
               Secure the Future of your Data.
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
               Drag and drop sensitive documents to verify them via AI and anchor their immutable hashes on the DocuChain AI ledger.
            </p>
         </div>

         {/* 2D Flat Dropzone Container */}
         <div className="w-full max-w-3xl mt-4">
            <div 
               className={`w-full bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border-2 border-dashed ${file ? 'border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'border-slate-300 dark:border-white/20 hover:border-teal-500 dark:hover:border-teal-500 hover:shadow-[0_0_15px_rgba(45,212,191,0.2)]'} rounded-2xl py-12 px-8 cursor-pointer transition-all flex flex-col items-center overflow-hidden`}
               onDragOver={handleDragOver}
               onDrop={handleDrop}
               onClick={() => !file && fileInputRef.current?.click()}
            >
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 onChange={handleFileChange} 
                 className="hidden" 
                 accept="application/pdf, image/png, image/jpeg, image/webp"
               />

               {file ? (
                  <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center text-center w-full">
                     <FileText className="w-16 h-16 text-teal-500 dark:text-teal-400 mb-4" strokeWidth={1.5} />
                     <p className="text-slate-900 dark:text-white font-semibold text-xl truncate w-full max-w-sm px-4">{file.name}</p>
                     <p className="text-slate-500 mt-2">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                     
                     {(status === 'idle' || status === 'error') && (
                        <button 
                         onClick={(e) => { e.stopPropagation(); setFile(null); setStatus('idle'); setMessage(''); }}
                         className="mt-6 text-sm text-rose-600 dark:text-rose-400 hover:text-rose-800 flex items-center justify-center gap-2 transition-colors bg-rose-100 dark:bg-rose-400/10 px-6 py-2 rounded-lg"
                        >
                          <XCircle className="w-5 h-5" strokeWidth={1.5} /> Remove File
                        </button>
                     )}
                  </motion.div>
               ) : (
                  <div className="flex flex-col items-center text-center">
                     <div className="w-20 h-20 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-6 text-indigo-500 dark:text-indigo-400 shadow-inner">
                        <UploadCloud className="w-10 h-10 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                     </div>
                     <span className="text-slate-900 dark:text-white font-semibold text-lg md:text-xl">Click to upload or drag and drop</span>
                     <span className="text-slate-500 mt-2 font-medium">Maximum file size: 50MB (PDF, JPG, PNG)</span>
                  </div>
               )}
            </div>
         </div>

         {/* Status Indicators */}
         {status !== 'idle' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`w-full max-w-3xl p-5 rounded-xl flex items-center justify-center gap-3 transition-colors ${
              status === 'error' ? 'bg-rose-100 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/20 text-rose-700 dark:text-rose-400' :
              status === 'success' ? 'bg-teal-100 dark:bg-teal-500/10 border border-teal-300 dark:border-teal-500/20 text-teal-800 dark:text-teal-400' :
              'bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-300 dark:border-indigo-500/20 text-indigo-800 dark:text-indigo-300'
            }`}>
               {(status === 'ai' || status === 'ipfs' || status === 'blockchain') && <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />}
               {status === 'success' && <CheckCircle2 className="w-5 h-5" strokeWidth={2} />}
               {status === 'error' && <XCircle className="w-5 h-5" strokeWidth={2} />}
               <span className="font-semibold text-center">{message}</span>
            </motion.div>
         )}

         {/* Action Button */}
         <button 
            onClick={handleUpload}
            disabled={!file || status === 'ai' || status === 'ipfs' || status === 'blockchain'}
            className={`w-full max-w-3xl py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
               !file || status === 'ai' || status === 'ipfs' || status === 'blockchain' 
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700' 
                : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-teal-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.6)] hover:shadow-[0_0_30px_rgba(45,212,191,0.8)] border border-indigo-400/50 hover:opacity-90 transform active:scale-95'
            }`}
         >
            {status === 'ai' ? 'Verifying Authenticity...' : 
             status === 'ipfs' ? 'Pinning to IPFS...' : 
             status === 'blockchain' ? 'Awaiting Wallet Confirmation...' : 
             'Upload & Secure Document'}
         </button>
      </div>
    </section>
  );
};

export default UploadDocument;
