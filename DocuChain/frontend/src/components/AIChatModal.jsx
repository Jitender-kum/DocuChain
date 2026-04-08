import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Bot, User, Clock } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../utils/db';

const AIChatModal = ({ documentCid, documentName, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
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
      console.error("Failed to load chat history:", err);
    } finally {
      setIsFetchingHistory(false);
    }
  };

  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    loadMessages(0).then(() => {
      setTimeout(scrollToBottom, 50);
    });
  }, [documentCid]);

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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    setIsLoading(true);
    
    // Save User Msg
    const userMsgObj = await saveMessage('user', userText);
    
    setMessages(prev => {
       const filtered = prev.filter(m => !m.isInitial);
       return [...filtered, userMsgObj];
    });
    
    setTimeout(scrollToBottom, 10);

    try {
      // 1. Fetch file from IPFS Gateway
      const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${documentCid}`;
      const response = await fetch(ipfsUrl);
      if (!response.ok) throw new Error("Failed to fetch document from IPFS gateway.");
      const blob = await response.blob();

      // 2. Determine MIME Type
      let mimeType = blob.type;
      if (!mimeType) {
         if (documentName.toLowerCase().endsWith('.png')) mimeType = 'image/png';
         else if (documentName.toLowerCase().endsWith('.jpg') || documentName.toLowerCase().endsWith('.jpeg')) mimeType = 'image/jpeg';
         else if (documentName.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';
         else mimeType = 'application/pdf'; // fallback
      }

      // Convert Blob to Base64
      const getBase64 = (blob) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const base64Data = await getBase64(blob);
      const imagePart = {
        inlineData: { data: base64Data, mimeType: mimeType || 'application/pdf' },
      };

      // 3. Call Gemini API
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API key is not configured.");
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `Answer this request based on the provided document: ${userText}`;
      
      const result = await model.generateContent([prompt, imagePart]);
      const resultResponse = await result.response;
      const text = resultResponse.text();

      // Save AI response
      const aiMsgObj = await saveMessage('ai', text);
      setMessages(prev => [...prev, aiMsgObj]);
      setTimeout(scrollToBottom, 10);

    } catch (error) {
      console.error("Chat Error:", error);
      const errorMsg = `Sorry, I encountered an error: ${error.message}`;
      setMessages(prev => [...prev, { role: 'ai', text: errorMsg }]);
      setTimeout(scrollToBottom, 10);
    } finally {
      setIsLoading(false);
    }
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
      </div>
    </div>
  );
};

export default AIChatModal;
