import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Bot, User, Clock } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../utils/db';
import { ethers } from 'ethers';
import {
  DOCUCHAIN_SIGN_MESSAGE,
  deriveKeyFromPassword,
  deriveKeyFromSignature,
  decryptDataUrlCipherToDataUrl,
} from '../utils/cryptoUtils';
const extractTextFromPdf = (pdfString) => {
  try {
    const matches = pdfString.match(/\(([^)]+)\)/g);
    if (!matches) return "";
    
    const textSegments = matches
      .map(m => m.slice(1, -1))
      .filter(t => {
        if (t.length < 2) return false;
        if (t.startsWith('/')) return false;
        return true;
      });
      
    return textSegments.join(" ").replace(/\s+/g, ' ').trim();
  } catch (err) {
    console.error("[DocuChain Chat] Error parsing PDF text streams:", err);
    return "";
  }
};

const isLowComplexity = (text) => {
  const clean = text.trim().toLowerCase();
  if (clean.length < 15) return true;
  const shortPhrases = ['hi', 'hello', 'hey', 'ok', 'okay', 'thanks', 'thank you', 'cool', 'yes', 'no', 'good', 'bye'];
  return shortPhrases.includes(clean);
};

const AIChatModal = ({ documentCid, documentName, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  
  const [unlockedContent, setUnlockedContent] = useState(null);
  const [isFetchingDoc, setIsFetchingDoc] = useState(true);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [extractedText, setExtractedText] = useState(null);
  
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const chatSessionRef = useRef(null);
  const activeModelNameRef = useRef("gemini-2.5-flash");
  const PAGE_SIZE = 15;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async (offset = 0) => {
    try {
      setIsFetchingHistory(true);
      const allHistory = await db.chats.where('documentCid').equals(documentCid).toArray();
      // Sort newest first
      allHistory.sort((a, b) => b.timestamp - a.timestamp);
      
      const paginated = allHistory.slice(offset, offset + PAGE_SIZE);
      const normalized = paginated.reverse(); // Standard oldest to newest for chat UI
      
      if (paginated.length < PAGE_SIZE) {
        setHasMore(false);
      }

      setMessages(prev => {
        if (offset === 0) {
          if (allHistory.length === 0) {
            return [{ role: 'ai', text: `Hi! I'm ready to answer any questions about "${documentName}". What would you like to know?`, isInitial: true }];
          }
          return normalized;
        } else {
          // Prepended the fetched ones to existing ones mapping
          return [...normalized, ...prev];
        }
      });
      
    } catch (err) {
      // Ignore
    } finally {
      setIsFetchingHistory(false);
    }
  };

  useEffect(() => {
    chatSessionRef.current = null;
    const initDoc = async () => {
      setIsFetchingDoc(true);
      try {
        if (documentName.startsWith('[U]-')) {
          const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${documentCid}`;
          const response = await fetch(ipfsUrl);
          if (!response.ok) throw new Error("Failed to fetch document");
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const decryptedDataUrl = reader.result;
            setUnlockedContent(decryptedDataUrl);
            
            // Extract text content for public files
            try {
              const mimeType = decryptedDataUrl.split(',')[0].split(':')[1].split(';')[0];
              const base64Data = decryptedDataUrl.split(',')[1];
              const rawData = atob(base64Data);

              if (mimeType === 'text/plain') {
                setExtractedText(rawData);
              } else if (mimeType === 'application/pdf') {
                const pdfText = extractTextFromPdf(rawData);
                if (pdfText && pdfText.trim().length > 10) {
                  setExtractedText(pdfText);
                  console.log("[DocuChain Chat] Public-stage extracted PDF text content length:", pdfText.length);
                }
              }
            } catch (extErr) {
              console.warn("[DocuChain Chat] Failed to extract text from public file:", extErr);
            }
            
            setIsFetchingDoc(false);
          };
          reader.readAsDataURL(blob);
          return;
        } else {
          setUnlockedContent(null);
          setExtractedText(null);
        }
      } catch (e) {
        // Ignore
      }
      setIsFetchingDoc(false);
    };

    setMessages([]);
    setHasMore(true);
    initDoc();
    loadMessages(0).then(() => {
      setTimeout(scrollToBottom, 50);
    });
  }, [documentCid, documentName]);

  useEffect(() => {
    const checkAndGenerateSummary = async () => {
      if (!unlockedContent) return;
      
      try {
        const existingCount = await db.chats.where('documentCid').equals(documentCid).count();
        if (existingCount === 0) {
          setIsLoading(true);
          
          const mimeType = unlockedContent.split(',')[0].split(':')[1].split(';')[0];
          const base64Data = unlockedContent.split(',')[1];
          const rawData = atob(base64Data);

          // Try text extraction synchronously
          let localExtractedText = null;
          if (mimeType === 'text/plain') {
            localExtractedText = rawData;
          } else if (mimeType === 'application/pdf') {
            const pdfText = extractTextFromPdf(rawData);
            if (pdfText && pdfText.trim().length > 10) {
              localExtractedText = pdfText;
              setExtractedText(pdfText); // Also sync to state for future chat messages
            }
          }

          const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
          if (!apiKey) throw new Error("Gemini API key is not configured.");
          
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
          });

          const systemPrompt = `Analyze the document and provide a response.
You MUST output the response in one of these two formats:

Format A (Preferred JSON):
{
  "summary": "Provide a clear, 3-bullet point summary of this document formatted using standard Markdown bullet points.",
  "questions": [
    "Suggested Question 1?",
    "Suggested Question 2?",
    "Suggested Question 3?"
  ]
}

Format B (Text fallback with delimiters):
Summary: [Your 3 bullets here] ||| Q1: [Question 1] ||| Q2: [Question 2] ||| Q3: [Question 3]`;

          let result;
          if (localExtractedText) {
            const finalPrompt = `Context Document Content:\n${localExtractedText}\n\n${systemPrompt}`;
            result = await model.generateContent([finalPrompt]);
          } else {
            // Binary fallback
            if (base64Data.length > 2800000) {
               throw new Error("Document is too large for the AI to process.");
            }
            const documentPart = {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            };
            result = await model.generateContent([systemPrompt, documentPart]);
          }

          const resultResponse = await result.response;
          const text = resultResponse.text();
          
          let summary = "";
          let questions = [];

          try {
            const parsed = JSON.parse(text.trim());
            summary = parsed.summary || "";
            questions = parsed.questions || [];
          } catch (jsonErr) {
            console.warn("[DocuChain Chat] JSON parse failed, trying delimiters.", jsonErr);
            if (text.includes("|||")) {
              const parts = text.split("|||");
              summary = parts[0].replace(/Summary:/i, "").trim();
              questions = parts.slice(1).map(q => q.replace(/Q\d+:/i, "").trim());
            } else {
              summary = text;
            }
          }

          if (!questions || questions.length === 0) {
            questions = [
              'Summarize the main purpose of this document.',
              'What are the key terms or deadlines mentioned?',
              'Identify the target audience or owner of this file.'
            ];
          }

          const welcomeMsgObj = await saveMessage('ai', summary || text);
          setMessages([welcomeMsgObj]);
          setSuggestedQuestions(questions);
          setTimeout(scrollToBottom, 50);
        }
      } catch (err) {
        console.error("[DocuChain Chat] Error generating auto-summary:", err);
        const fallbackText = `Hi! I'm ready to answer any questions about "${documentName}". What would you like to know?`;
        const welcomeMsgObj = await saveMessage('ai', fallbackText);
        setMessages([welcomeMsgObj]);
        setSuggestedQuestions([
          'Summarize the main purpose of this document.',
          'What are the key terms or deadlines mentioned?',
          'Identify the target audience or owner of this file.'
        ]);
        setTimeout(scrollToBottom, 50);
      } finally {
        setIsLoading(false);
      }
    };

    checkAndGenerateSummary();
  }, [unlockedContent, documentCid, documentName]);

  const handleDecryptAndUnlock = async (key) => {
    setUnlockBusy(true);
    setUnlockError('');
    try {
      const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${documentCid}`;
      const response = await fetch(ipfsUrl);
      if (!response.ok) throw new Error("Failed to fetch document from IPFS.");
      const encryptedText = await response.text();

      const decryptedDataUrl = decryptDataUrlCipherToDataUrl(encryptedText, key);
      setUnlockedContent(decryptedDataUrl);
      
      // Perform text extraction synchronously here so it is immediately populated for existing/new encrypted chats
      try {
        const mimeType = decryptedDataUrl.split(',')[0].split(':')[1].split(';')[0];
        const base64Data = decryptedDataUrl.split(',')[1];
        const rawData = atob(base64Data);

        if (mimeType === 'text/plain') {
          setExtractedText(rawData);
        } else if (mimeType === 'application/pdf') {
          const pdfText = extractTextFromPdf(rawData);
          if (pdfText && pdfText.trim().length > 10) {
            setExtractedText(pdfText);
            console.log("[DocuChain Chat] Decryption-stage extracted PDF text content length:", pdfText.length);
          }
        }
      } catch (extErr) {
        console.warn("[DocuChain Chat] Failed to extract text during decryption stage:", extErr);
      }
    } catch (e) {
      setUnlockError(e.message || "Decryption failed.");
    } finally {
      setUnlockBusy(false);
    }
  };

  const handleUnlockPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!unlockPassword.trim()) return;
    const key = deriveKeyFromPassword(unlockPassword.trim());
    await handleDecryptAndUnlock(key);
  };

  const handleUnlockWalletClick = async () => {
    try {
      setUnlockBusy(true);
      setUnlockError('');
      if (!window.ethereum) throw new Error("MetaMask is not installed.");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(DOCUCHAIN_SIGN_MESSAGE);
      const key = deriveKeyFromSignature(signature);
      await handleDecryptAndUnlock(key);
    } catch (e) {
      setUnlockError(e.message || "Wallet unlock failed.");
      setUnlockBusy(false);
    }
  };

  const handleScroll = async () => {
    if (!chatContainerRef.current || isFetchingHistory || !hasMore) return;
    
    if (chatContainerRef.current.scrollTop === 0) {
      const scrollHeight = chatContainerRef.current.scrollHeight;
      const dbLoadedCount = messages.filter(m => !m.isInitial).length;
      
      await loadMessages(dbLoadedCount);
      
      // Restore scroll position so user stays on the same message they were viewing
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight - scrollHeight;
        }
      }, 0);
    }
  };

  const saveMessage = async (role, text) => {
    const newMsg = {
      documentCid,
      role,
      text,
      timestamp: Date.now()
    };
    newMsg.id = await db.chats.add(newMsg);
    return newMsg;
  };

  const sendMessageToGemini = async (userText, userMsgId) => {
    try {
      // Parse the Data URL
      const mimeType = unlockedContent.split(',')[0].split(':')[1].split(';')[0];
      const base64Data = unlockedContent.split(',')[1];

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API key is not configured.");
      
      const genAI = new GoogleGenerativeAI(apiKey);

      const primaryModelName = isLowComplexity(userText) ? "gemini-1.5-flash" : "gemini-2.5-flash";
      activeModelNameRef.current = primaryModelName;
      
      const model = genAI.getGenerativeModel({ model: primaryModelName });

      if (!chatSessionRef.current) {
        // Fetch all history from IndexedDB to build the chat history
        const dbHistory = await db.chats.where('documentCid').equals(documentCid).toArray();
        // Exclude the current user message we just saved
        const allHistory = dbHistory.filter(m => m.id !== userMsgId);
        allHistory.sort((a, b) => a.timestamp - b.timestamp); // Sort oldest first
        
        const formattedHistory = [];
        let lastRole = null;
        
        for (const msg of allHistory) {
          const role = msg.role === 'user' ? 'user' : 'model';
          
          if (role === lastRole) {
            if (formattedHistory.length > 0) {
              formattedHistory[formattedHistory.length - 1].parts[0].text += "\n" + msg.text;
            }
            continue;
          }
          
          formattedHistory.push({
            role: role,
            parts: [{ text: msg.text }]
          });
          lastRole = role;
        }

        // Attach document context
        if (extractedText) {
          // Optimization: Send extracted text context in the first user message parts
          const textContext = `Context Document Content:\n${extractedText}\n\nAnalyze the attached document content.`;
          
          if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
            formattedHistory.unshift({
              role: 'user',
              parts: [{ text: textContext }]
            });
          } else if (formattedHistory.length > 0 && formattedHistory[0].role === 'user') {
            formattedHistory[0].parts[0].text = `${textContext}\n\n${formattedHistory[0].parts[0].text}`;
          } else {
            formattedHistory.push({
              role: 'user',
              parts: [{ text: textContext }]
            });
          }
        } else {
          // Fallback: Send binary inlineData (only for first message of the chat session)
          if (base64Data.length > 2800000) { 
             throw new Error("Document is too large for the AI to process on the current tier. Please upload a smaller document.");
          }
          const documentPart = {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          };

          if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
            formattedHistory.unshift({
              role: 'user',
              parts: [
                { text: "Analyze the attached document." },
                documentPart.inlineData
              ]
            });
          } else if (formattedHistory.length > 0 && formattedHistory[0].role === 'user') {
            formattedHistory[0].parts.push(documentPart.inlineData);
          } else {
            formattedHistory.push({
              role: 'user',
              parts: [
                { text: "Analyze the attached document." },
                documentPart.inlineData
              ]
            });
          }
        }
        
        chatSessionRef.current = model.startChat({
          history: formattedHistory
        });
      }

      let result;
      try {
        console.log(`[DocuChain Chat] Sending query to ${activeModelNameRef.current}...`);
        result = await chatSessionRef.current.sendMessage(userText);
      } catch (sendError) {
        const errText = sendError?.message || '';
        const is429 = errText.includes('429') || errText.toLowerCase().includes('rate limit') || errText.toLowerCase().includes('quota');
        
        if (is429 && activeModelNameRef.current === "gemini-2.5-flash") {
          console.warn("[DocuChain Chat] Primary model 429 rate limited. Switching to gemini-1.5-flash fallback...");
          activeModelNameRef.current = "gemini-1.5-flash";
          
          const fallbackModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          
          const dbHistory = await db.chats.where('documentCid').equals(documentCid).toArray();
          const allHistory = dbHistory.filter(m => m.id !== userMsgId);
          allHistory.sort((a, b) => a.timestamp - b.timestamp);
          
          const formattedHistory = [];
          let lastRole = null;
          for (const msg of allHistory) {
            const role = msg.role === 'user' ? 'user' : 'model';
            if (role === lastRole) {
              if (formattedHistory.length > 0) {
                formattedHistory[formattedHistory.length - 1].parts[0].text += "\n" + msg.text;
              }
              continue;
            }
            formattedHistory.push({
              role: role,
              parts: [{ text: msg.text }]
            });
            lastRole = role;
          }

          if (extractedText) {
            const textContext = `Context Document Content:\n${extractedText}\n\nAnalyze the attached document content.`;
            if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
              formattedHistory.unshift({ role: 'user', parts: [{ text: textContext }] });
            } else if (formattedHistory.length > 0 && formattedHistory[0].role === 'user') {
              formattedHistory[0].parts[0].text = `${textContext}\n\n${formattedHistory[0].parts[0].text}`;
            } else {
              formattedHistory.push({ role: 'user', parts: [{ text: textContext }] });
            }
          } else {
            const documentPart = {
              inlineData: { data: base64Data, mimeType: mimeType }
            };
            if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
              formattedHistory.unshift({
                role: 'user',
                parts: [{ text: "Analyze the attached document." }, documentPart.inlineData]
              });
            } else if (formattedHistory.length > 0 && formattedHistory[0].role === 'user') {
              formattedHistory[0].parts.push(documentPart.inlineData);
            } else {
              formattedHistory.push({
                role: 'user',
                parts: [{ text: "Analyze the attached document." }, documentPart.inlineData]
              });
            }
          }

          chatSessionRef.current = fallbackModel.startChat({
            history: formattedHistory
          });

          console.log("[DocuChain Chat] Retrying query on fallback model: gemini-1.5-flash...");
          result = await chatSessionRef.current.sendMessage(userText);
        } else {
          throw sendError;
        }
      }

      const resultResponse = await result.response;
      const text = resultResponse.text();

      // Save AI response
      const aiMsgObj = await saveMessage('ai', text);
      setMessages(prev => [...prev, aiMsgObj]);
      setTimeout(scrollToBottom, 10);

    } catch (error) {
      console.error("[DocuChain Chat] Error sending message:", error);
      const errText = error?.message || '';
      const is429 = errText.includes('429') || errText.toLowerCase().includes('rate limit') || errText.toLowerCase().includes('quota');
      
      const errorMsg = is429
        ? "System: All AI Tiers are currently heavily loaded. Please provide a new API key or try again shortly."
        : `Sorry, I encountered an error: ${error.message}`;
        
      setMessages(prev => [...prev, { role: 'ai', text: errorMsg }]);
      setTimeout(scrollToBottom, 10);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    setSuggestedQuestions([]); // Clear suggestions as soon as user types/sends a custom message
    setIsLoading(true);
    
    // Save User Msg
    const userMsgObj = await saveMessage('user', userText);
    
    setMessages(prev => {
       const filtered = prev.filter(m => !m.isInitial);
       return [...filtered, userMsgObj];
    });
    
    setTimeout(scrollToBottom, 10);

    await sendMessageToGemini(userText, userMsgObj.id);
  };

  const handleSuggestedQuestionClick = async (questionText) => {
    if (isLoading) return;
    
    setSuggestedQuestions([]); // Hide suggestions for the rest of the session
    setIsLoading(true);
    
    // Save User Msg
    const userMsgObj = await saveMessage('user', questionText);
    
    setMessages(prev => {
       const filtered = prev.filter(m => !m.isInitial);
       return [...filtered, userMsgObj];
    });
    
    setTimeout(scrollToBottom, 10);

    await sendMessageToGemini(questionText, userMsgObj.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-2xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.1)] dark:shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col h-[80vh] max-h-[800px] overflow-hidden relative transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/80 z-10 transition-colors">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-100 dark:bg-indigo-500/20 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-inner">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-slate-900 dark:text-white font-bold text-lg leading-tight transition-colors">DocuChain AI</h3>
              <p className="text-indigo-600 dark:text-indigo-300 text-xs truncate max-w-[200px] sm:max-w-xs transition-colors">{documentName}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors hover:bg-rose-100 dark:hover:bg-rose-500/10 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isFetchingDoc ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-slate-500 dark:text-slate-400">Fetching document status...</p>
          </div>
        ) : !unlockedContent ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900/50">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 max-w-sm w-full">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2 text-center">Encrypted Document</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center">Unlock this document to enable AI chat.</p>
              
              {unlockError && (
                <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm rounded-xl border border-rose-200 dark:border-rose-500/20">
                  {unlockError}
                </div>
              )}

              {documentName.startsWith('[W]-') ? (
                <button
                  type="button"
                  onClick={handleUnlockWalletClick}
                  disabled={unlockBusy}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white"
                >
                  {unlockBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  Unlock with Wallet
                </button>
              ) : (
                <form onSubmit={handleUnlockPasswordSubmit} className="space-y-4">
                  <input
                    type="password"
                    value={unlockPassword}
                    onChange={(e) => setUnlockPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={unlockBusy || !unlockPassword.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white"
                  >
                    {unlockBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Unlock with Password'}
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Chat History */}
            <div 
              ref={chatContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-900/50 scroll-smooth transition-colors"
            >
              {isFetchingHistory && hasMore && (
                <div className="flex justify-center py-4">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 shadow-sm transition-colors">
                    <Loader2 className="w-4 h-4 text-indigo-500 dark:text-indigo-400 animate-spin" />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading older messages...</span>
                  </div>
                </div>
              )}
              
              {messages.map((m, i) => (
                <div key={m.id || i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'ai' && (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex-shrink-0 flex items-center justify-center text-white shadow-md mt-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                  <div className={`p-4 rounded-2xl max-w-[85%] transition-colors ${
                    m.role === 'user' 
                      ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-tr-none shadow-md' 
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-tl-none shadow-sm'
                  }`}>
                    <p className="text-sm md:text-base whitespace-pre-wrap leading-relaxed">{m.text}</p>
                    {m.timestamp && (
                      <div className={`text-[10px] mt-2 flex items-center justify-end gap-1 ${m.role === 'user' ? 'text-teal-100/70' : 'text-slate-400 dark:text-slate-500'}`}>
                        <Clock className="w-3 h-3" />
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                  {m.role === 'user' && (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-emerald-400 flex-shrink-0 flex items-center justify-center text-white shadow-md mt-1">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4 justify-start animate-in fade-in zoom-in slide-in-from-bottom-2 duration-300">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex-shrink-0 flex items-center justify-center text-white shadow-md mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-tl-none shadow-sm flex items-center gap-3 transition-colors">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500 dark:text-indigo-400" />
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">AI is reading your document...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested Questions */}
            {suggestedQuestions && suggestedQuestions.length > 0 && (
              <div className="px-6 py-3 flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800/30 transition-colors">
                <p className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">Suggested Questions</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSuggestedQuestionClick(q)}
                      disabled={isLoading}
                      className="text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 px-3.5 py-2 rounded-full transition-all duration-200 text-left hover:scale-[1.01] hover:shadow-sm"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/80 z-10 transition-colors">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex items-center gap-3 relative max-w-3xl mx-auto"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question about this document..."
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-5 py-3.5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 pr-14 transition-all shadow-inner"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="absolute right-2 p-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:shadow-[0_4px_15px_rgba(99,102,241,0.4)] dark:hover:shadow-[0_0_15px_rgba(99,102,241,0.5)] disabled:opacity-50 disabled:hover:shadow-none transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AIChatModal;
