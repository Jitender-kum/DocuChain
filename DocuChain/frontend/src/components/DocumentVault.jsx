import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import abi from '../utils/abi.json';
import {
  RefreshCw,
  FileText,
  Download,
  Clock,
  AlertCircle,
  Lock,
  MessageSquare,
  Verified,
  Database,
  Eye,
  Wallet,
  KeyRound,
  Loader2,
  X,
} from 'lucide-react';
import AIChatModal from './AIChatModal';
import { motion, AnimatePresence } from 'framer-motion';
import TiltGlassCard from './TiltGlassCard';
import {
  DOCUCHAIN_SIGN_MESSAGE,
  deriveKeyFromPassword,
  deriveKeyFromSignature,
  decryptFileBuffer,
  decryptDataUrlCipherToDataUrl,
  isDocuChainEncryptedFile,
  isLikelyPlainMediaFile,
} from '../utils/cryptoUtils';

const dataURItoBlob = (dataURI) => {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
};

function guessMimeFromName(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

const getDocMetadata = (rawFileName) => {
  const isPassword = rawFileName.startsWith('[P]-');
  const isWallet = rawFileName.startsWith('[W]-');
  const isPublic = rawFileName.startsWith('[U]-');
  const cleanName = rawFileName.replace(/^\[[PWU]\]-/, '');
  return { isPassword, isWallet, isPublic, cleanName };
};


const DECRYPT_FAIL_USER_MSG = 'Decryption Failed: Incorrect Password or Signature.';

/** CryptoJS ciphertext must be a string — same as fetch().then(r => r.text()) on the payload bytes. */
async function arrayBufferToCiphertextString(buf) {
  const encryptedText = await new Response(buf).text();
  if (typeof encryptedText !== 'string') {
    throw new Error('Ciphertext is not a string');
  }
  return encryptedText;
}

const DocumentVault = ({ walletAddress }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeChatDoc, setActiveChatDoc] = useState(null);

  const [viewLoadingHash, setViewLoadingHash] = useState(null);
  const [unlockDoc, setUnlockDoc] = useState(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [decryptedPreview, setDecryptedPreview] = useState(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError('');

      if (!window.ethereum) throw new Error('MetaMask not found.');

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
      if (!contractAddress || contractAddress.includes('your_deployed')) {
        throw new Error('Smart Contract address not configured in .env');
      }

      console.log("[DocuChain] Connecting to contract at:", contractAddress);
      console.log("[DocuChain] Fetching documents for wallet:", signerAddress);

      const contract = new ethers.Contract(contractAddress, abi, signer);
      // Explicitly pass { from: signerAddress } to ensure msg.sender is set in read call
      const docs = await contract.getUserDocuments({ from: signerAddress });
      console.log("[DocuChain] Raw documents from contract:", docs);

      if (!docs) {
        setDocuments([]);
        return;
      }

      const docsArray = Array.from(docs);
      const formattedDocs = docsArray
        .map((doc) => {
          if (!doc) return null;
          
          // Fallback to indices if fields are not named in the returned structure
          const ipfsHash = doc.ipfsHash || doc[0] || '';
          const fileName = doc.fileName || doc[1] || '';
          
          let uploadTime = 0;
          try {
            const rawTime = doc.uploadTime !== undefined ? doc.uploadTime : doc[2];
            if (rawTime !== undefined && rawTime !== null) {
              uploadTime = Number(rawTime.toString()) * 1000;
            }
          } catch (tErr) {
            console.error("[DocuChain] Error parsing uploadTime BigInt:", tErr);
          }
          
          const owner = doc.owner || doc[3] || '';

          return {
            ipfsHash,
            fileName,
            uploadTime,
            owner,
          };
        })
        .filter((d) => d && d.ipfsHash)
        .reverse();

      console.log("[DocuChain] Formatted documents:", formattedDocs);
      setDocuments(formattedDocs);
    } catch (err) {
      console.error("[DocuChain] Error in fetchDocuments:", err);
      setError(err.message || 'Failed to fetch documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!walletAddress) setDocuments([]);
    else fetchDocuments();
  }, [walletAddress]);

  const closeUnlockModal = useCallback(() => {
    setUnlockDoc(null);
    setUnlockPassword('');
    setUnlockError('');
    setUnlockBusy(false);
  }, []);

  const applyDecryptedSuccess = useCallback((result, fileName, actionType = 'view') => {
    let safeBlobUrl;

    if (result.kind === 'dataurl') {
      const blob = dataURItoBlob(result.dataUrl);
      safeBlobUrl = URL.createObjectURL(blob);
      setDecryptedPreview({ dataUrl: result.dataUrl, fileName });
    } else {
      const mime = guessMimeFromName(fileName);
      const blob = new Blob([result.data], { type: mime });
      safeBlobUrl = URL.createObjectURL(blob);
      setDecryptedPreview({ data: result.data, fileName });
    }

    if (actionType === 'view') {
      window.open(safeBlobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(safeBlobUrl), 120_000);
    } else if (actionType === 'download') {
      const link = document.createElement('a');
      link.href = safeBlobUrl;
      link.download = fileName || "decrypted_document";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(safeBlobUrl), 10_000);
    }
  }, []);

  const tryDecryptWithWallet = useCallback(async (doc) => {
    if (!window.ethereum) throw new Error('MetaMask not available.');
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const sig = await signer.signMessage(DOCUCHAIN_SIGN_MESSAGE);
    if (typeof sig !== 'string' || !sig) {
      throw new Error('Wallet did not return a signature string.');
    }
    const key = deriveKeyFromSignature(sig);
    if (doc.payloadKind === 'binary') {
      const r = decryptFileBuffer(doc.buffer, key);
      if (r.ok) return { ok: true, kind: 'binary', data: r.data };
      return r;
    }
    const encryptedText = doc.encryptedText;
    if (typeof encryptedText !== 'string') {
      return { ok: false, error: DECRYPT_FAIL_USER_MSG };
    }
    try {
      const dataUrl = decryptDataUrlCipherToDataUrl(encryptedText.trim(), key);
      return { ok: true, kind: 'dataurl', dataUrl };
    } catch {
      return { ok: false, error: DECRYPT_FAIL_USER_MSG };
    }
  }, []);

  const handleUnlockWalletClick = async () => {
    if (!unlockDoc) return;
    if (unlockDoc.payloadKind === 'binary' && !unlockDoc.buffer) return;
    if (unlockDoc.payloadKind === 'text' && typeof unlockDoc.encryptedText !== 'string') return;
    setUnlockBusy(true);
    setUnlockError('');
    try {
      const result = await tryDecryptWithWallet(unlockDoc);
      if (result.ok) {
        applyDecryptedSuccess(result, unlockDoc.fileName, unlockDoc.actionType);
        closeUnlockModal();
      } else {
        setUnlockError(result.error || DECRYPT_FAIL_USER_MSG);
      }
    } catch (e) {
      const errMsg = e?.message || '';
      const isRejected = e?.code === 4001 || e?.code === 'ACTION_REJECTED' || errMsg.toLowerCase().includes('user rejected') || errMsg.toLowerCase().includes('user denied');
      const msg = isRejected ? 'Wallet signature rejected by user.' : errMsg || 'Wallet unlock failed.';
      setUnlockError(msg);
    } finally {
      setUnlockBusy(false);
    }
  };

  const handleUnlockPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!unlockDoc || !unlockPassword.trim()) return;
    if (unlockDoc.payloadKind === 'binary' && !unlockDoc.buffer) return;
    if (unlockDoc.payloadKind === 'text' && typeof unlockDoc.encryptedText !== 'string') return;
    setUnlockBusy(true);
    setUnlockError('');
    try {
      const passwordInput = unlockPassword.trim();
      const key = deriveKeyFromPassword(passwordInput);
      if (unlockDoc.payloadKind === 'binary') {
        const result = decryptFileBuffer(unlockDoc.buffer, key);
        if (result.ok) {
          applyDecryptedSuccess({ kind: 'binary', data: result.data }, unlockDoc.fileName, unlockDoc.actionType);
          setUnlockPassword('');
          closeUnlockModal();
        } else {
          setUnlockError(DECRYPT_FAIL_USER_MSG);
        }
      } else {
        const encryptedText = unlockDoc.encryptedText;
        try {
          const dataUrl = decryptDataUrlCipherToDataUrl(encryptedText.trim(), key);
          applyDecryptedSuccess({ kind: 'dataurl', dataUrl }, unlockDoc.fileName, unlockDoc.actionType);
          setUnlockPassword('');
          closeUnlockModal();
        } catch {
          setUnlockError(DECRYPT_FAIL_USER_MSG);
        }
      }
    } finally {
      setUnlockBusy(false);
    }
  };



  const handleDocAction = async (doc, actionType) => {
    const url = `https://gateway.pinata.cloud/ipfs/${doc.ipfsHash}`;
    try {
      setViewLoadingHash(doc.ipfsHash);
      setError('');
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch document from IPFS.');
      const buf = await res.arrayBuffer();

      if (isDocuChainEncryptedFile(buf)) {
        setUnlockDoc({ ipfsHash: doc.ipfsHash, fileName: doc.fileName, buffer: buf, payloadKind: 'binary', actionType });
        setUnlockPassword('');
        setUnlockError('');
        setDecryptedPreview(null);
        return;
      }

      if (isLikelyPlainMediaFile(buf)) {
        const mime = guessMimeFromName(doc.fileName);
        const blob = new Blob([buf], { type: mime });
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
        return;
      }

      const encryptedText = await arrayBufferToCiphertextString(buf);

      if (encryptedText.trim().startsWith('data:')) {
        applyDecryptedSuccess({ kind: 'dataurl', dataUrl: encryptedText.trim() }, doc.fileName, actionType);
        setDecryptedPreview(null);
        return;
      }

      setUnlockDoc({
        ipfsHash: doc.ipfsHash,
        fileName: doc.fileName,
        payloadKind: 'text',
        encryptedText: encryptedText.trim(),
        actionType,
      });
      setUnlockPassword('');
      setUnlockError('');
      setDecryptedPreview(null);
    } catch (e) {
      setError(e.message || 'Failed to open document.');
    } finally {
      setViewLoadingHash(null);
    }
  };

  const handleDownloadDecrypted = () => {
    if (!decryptedPreview) return;
    if (decryptedPreview.dataUrl) {
      const link = document.createElement('a');
      link.href = decryptedPreview.dataUrl;
      link.download = decryptedPreview.fileName || 'decrypted_file';
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }
    if (decryptedPreview.data) {
      const mime = guessMimeFromName(decryptedPreview.fileName);
      const blob = new Blob([decryptedPreview.data], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = decryptedPreview.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  return (
    <section className="w-full max-w-6xl mx-auto my-16 z-10 space-y-12 pb-24 relative">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-2 text-center sm:text-left">
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 tracking-tight">
            The Ledger Vault
          </h2>
          <p className="text-slate-600 dark:text-slate-400">Your decentralized repository of truth.</p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100/90 dark:bg-indigo-500/15 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-500/30 text-xs font-semibold tracking-wide mt-2">
            Military Grade AES-256 + Wallet Authentication Active
          </div>
        </div>
        <div className="flex gap-4">
          <button
            type="button"
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
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-xl bg-rose-100 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 flex items-center gap-3"
        >
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
        <div
          className="text-center p-16 border-2 border-dashed border-slate-300 dark:border-white/20 rounded-3xl bg-white/70 dark:bg-[#131315]/80 backdrop-blur-xl hover:border-indigo-400 transition-colors cursor-pointer shadow-2xl"
          onClick={() => window.scrollTo(0, 0)}
          onKeyDown={(e) => e.key === 'Enter' && window.scrollTo(0, 0)}
          role="button"
          tabIndex={0}
        >
          <Database className="w-16 h-16 text-slate-400 dark:text-slate-500 mx-auto mb-6" strokeWidth={1.5} />
          <p className="text-slate-900 dark:text-white text-2xl font-bold">Your ledger is empty</p>
          <p className="text-slate-500 mt-3 text-lg">Upload a document above to securely link it forever.</p>
        </div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {documents.map((doc, idx) => {
            const metadata = getDocMetadata(doc.fileName);
            return (
            <TiltGlassCard
              key={idx}
              className="group relative overflow-hidden bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-white/10 p-8 flex flex-col gap-6 transition-all shadow-xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:shadow-2xl hover:border-indigo-500/50"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-transparent to-teal-400/0 group-hover:from-indigo-500/5 group-hover:to-teal-400/5 transition-colors duration-500 -z-10 pointer-events-none" />

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
                <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate" title={metadata.cleanName}>
                  {metadata.cleanName}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" strokeWidth={1.5} />
                  {formatDate(doc.uploadTime)}
                </p>
              </div>

              <div className="mt-auto flex flex-col gap-3 pt-6 z-50 pointer-events-auto w-full relative">
                <div className="flex items-center gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => handleDocAction(doc, 'view')}
                    disabled={viewLoadingHash === doc.ipfsHash}
                    className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-all duration-200 text-sm cursor-pointer border border-violet-400/30"
                  >
                    {viewLoadingHash === doc.ipfsHash ? (
                      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                    ) : (
                      <Eye className="w-4 h-4" strokeWidth={1.5} />
                    )}
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDocAction(doc, 'download')}
                    disabled={viewLoadingHash === doc.ipfsHash}
                    className="bg-emerald-500 hover:bg-emerald-400 text-white p-3 rounded-xl flex items-center justify-center hover:scale-[1.02] transition-all duration-200 cursor-pointer border border-emerald-400/30 disabled:opacity-60"
                    title="Decrypt and Download"
                  >
                    {viewLoadingHash === doc.ipfsHash ? (
                      <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />
                    ) : (
                      <Download className="w-5 h-5" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveChatDoc({ cid: doc.ipfsHash, name: doc.fileName })}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-all duration-200 text-sm cursor-pointer border border-indigo-400/30"
                >
                  <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
                  Chat with AI
                </button>
              </div>
            </TiltGlassCard>
            );
          })}
        </motion.div>
      )}

      {documents.length > 0 && walletAddress && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 pt-16 border-t border-slate-200 dark:border-white/10 z-10"
        >
          <div className="p-6 rounded-2xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 shadow-sm text-center md:text-left">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold tracking-widest uppercase">Vault Documents</span>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{documents.length}</div>
          </div>
          <div className="p-6 rounded-2xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 shadow-sm text-center md:text-left">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold tracking-widest uppercase">Encryption</span>
            <div className="text-lg font-extrabold text-teal-600 dark:text-teal-400 mt-1 leading-tight">AES-256 + Wallet</div>
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

      <AnimatePresence>
        {unlockDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unlock-title"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl"
            >
              <div className="flex justify-between items-start gap-4 mb-4">
                <div>
                  <h3 id="unlock-title" className="text-lg font-bold text-slate-900 dark:text-white">
                    Decrypt document
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-[280px]" title={getDocMetadata(unlockDoc.fileName).cleanName}>
                    {getDocMetadata(unlockDoc.fileName).cleanName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeUnlockModal}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 px-3 py-2">
                Military Grade AES-256 + Wallet Authentication Active — keys stay in memory only.
              </p>

              {unlockBusy && (
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-sm mb-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Trying wallet signature first…
                </div>
              )}

              {unlockError && (
                <div className="text-sm text-rose-600 dark:text-rose-400 mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
                  {unlockError}
                </div>
              )}

              <div className="space-y-3">
                {(!getDocMetadata(unlockDoc.fileName).isPassword) && (
                  <button
                    type="button"
                    onClick={handleUnlockWalletClick}
                    disabled={unlockBusy}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white border border-indigo-500/50"
                  >
                    <Wallet className="w-5 h-5" strokeWidth={1.5} />
                    Unlock with Wallet
                  </button>
                )}

                {(!getDocMetadata(unlockDoc.fileName).isWallet) && (
                  <form onSubmit={handleUnlockPasswordSubmit} className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <label htmlFor="vault-password" className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5" />
                      Enter password (password-secured uploads)
                    </label>
                    <input
                      id="vault-password"
                      type="password"
                      value={unlockPassword}
                      onChange={(e) => setUnlockPassword(e.target.value)}
                      autoComplete="off"
                      placeholder="Password"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="submit"
                      disabled={unlockBusy || !unlockPassword.trim()}
                      className="w-full py-2.5 rounded-xl font-semibold bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white"
                    >
                      Unlock with Password
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {decryptedPreview && (
        <div className="fixed bottom-6 right-6 z-[90] flex flex-col gap-2 items-end">
          <button
            type="button"
            onClick={handleDownloadDecrypted}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold shadow-lg"
          >
            <Download className="w-4 h-4" />
            Download last decrypted file
          </button>
          <button
            type="button"
            onClick={() => setDecryptedPreview(null)}
            className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {activeChatDoc && (
        <AIChatModal documentCid={activeChatDoc.cid} documentName={activeChatDoc.name} onClose={() => setActiveChatDoc(null)} />
      )}
    </section>
  );
};

export default DocumentVault;
