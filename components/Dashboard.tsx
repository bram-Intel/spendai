import React, { useState } from 'react';
import { User, Transaction, ChatMessage, SecureLink } from '../types';
import { Copy, ArrowUpRight, ArrowDownLeft, Send, Sparkles, Loader2, Link as LinkIcon, Lock, Eye, Wallet, CreditCard, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DashboardProps {
    user: User;
    transactions: Transaction[];
    activeLink: SecureLink | null;
    onCreateLink: (amount: number, code: string) => void;
    onPreviewLink: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, transactions, activeLink, onCreateLink, onPreviewLink }) => {
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        {
            role: 'model',
            text: `Hello ${user.name.split(' ')[0]}! 🌟 I noticed you spent a bit more on Food this week. Want to set up a budget or generate a Secure Link for pocket money?`,
            timestamp: new Date()
        }
    ]);
    const [inputMessage, setInputMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Link Creation State
    const [linkAmount, setLinkAmount] = useState('');
    const [linkCode, setLinkCode] = useState('');

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    /* 
       REPLACE: Using Edge Function for AI instead of local service
    */
    // Import supabase at top (we'll add import in next step or assume it exists/we add it)
    // For now let's assume we pass supabase or import it. We should import it.

    const handleCreateLink = async () => {
        if (!linkAmount || !linkCode) return;

        try {
            const { data, error } = await supabase.rpc('create_payment_link', {
                amount: Number(linkAmount) * 100, // Convert to kobo
                description: 'Secure Link Transfer' // Default description
            });

            if (error) {
                console.error(error);
                alert('Failed to create link: ' + error.message);
                return;
            }

            onCreateLink(Number(linkAmount), data.link_code); // Update parent state if needed
            setLinkCode('');
            setLinkAmount('');
            // Maybe show success toast
        } catch (err) {
            console.error(err);
        }
    };

    const handleSendMessage = async () => {
        if (!inputMessage.trim()) return;

        const newUserMsg: ChatMessage = { role: 'user', text: inputMessage, timestamp: new Date() };
        setChatMessages(prev => [...prev, newUserMsg]);
        setInputMessage('');
        setIsTyping(true);

        try {
            // CALL EDGE FUNCTION
            const { data, error } = await supabase.functions.invoke('ask-financial-advisor', {
                body: { prompt: inputMessage }
            });

            if (error) throw error;

            const botText = data.response || "I'm having trouble connecting to my brain right now.";
            const newBotMsg: ChatMessage = { role: 'model', text: botText, timestamp: new Date() };
            setChatMessages(prev => [...prev, newBotMsg]);
        } catch (e) {
            console.error(e);
            const errorMsg: ChatMessage = { role: 'model', text: "Sorry, I encountered an error.", timestamp: new Date() };
            setChatMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">

            {/* LEFT COLUMN (Finance Core) - Spans 8 cols */}
            <div className="lg:col-span-8 flex flex-col gap-6">

                {/* Bento Row 1: Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Primary Balance Card (Glass/Mesh Effect) */}
                    <div className="relative rounded-[2rem] p-8 shadow-2xl overflow-hidden text-white mesh-gradient group hover:shadow-[0_20px_50px_-12px_rgba(20,184,166,0.3)] transition-all duration-300">
                        {/* Noise Texture Overlay */}
                        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>

                        <div className="relative z-10 h-full flex flex-col justify-between min-h-[240px]">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-white/80 text-sm font-medium tracking-wide uppercase">Total Balance</p>
                                    <h2 className="text-5xl font-bold mt-2 tracking-tight">₦{user.walletBalance.toLocaleString()}</h2>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                                    <Wallet className="text-white" size={24} />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex gap-3 mt-4">
                                    <button className="flex-1 bg-white text-brand-900 hover:bg-slate-50 active:scale-95 transition-all py-3.5 rounded-xl text-sm font-bold shadow-lg flex items-center justify-center gap-2">
                                        <ArrowDownLeft size={18} /> Add Money
                                    </button>
                                    <button className="flex-1 bg-black/20 hover:bg-black/30 text-white border border-white/20 active:scale-95 transition-all py-3.5 rounded-xl text-sm font-bold backdrop-blur-sm flex items-center justify-center gap-2">
                                        <ArrowUpRight size={18} /> Transfer
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Secure Link Generator (Futuristic Dark Card) */}
                    <div className="relative rounded-[2rem] p-1 shadow-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 overflow-hidden group">
                        <div className="absolute inset-0 bg-slate-900 m-[2px] rounded-[1.9rem] flex flex-col p-6 relative overflow-hidden">
                            {/* Background glows */}
                            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"></div>
                            <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl"></div>

                            <div className="relative z-10 flex flex-col h-full">
                                <div className="flex items-center gap-2 mb-6">
                                    <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                                        <LinkIcon size={20} className="text-indigo-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg leading-tight">Secure Link</h3>
                                        <p className="text-slate-400 text-xs">Send cash via code</p>
                                    </div>
                                </div>

                                {!activeLink ? (
                                    <div className="space-y-4 mt-auto">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="group/input">
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block group-focus-within/input:text-indigo-400 transition-colors">Amount</label>
                                                <input
                                                    type="number"
                                                    placeholder="5000"
                                                    value={linkAmount}
                                                    onChange={(e) => setLinkAmount(e.target.value)}
                                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 focus:bg-slate-800 transition-all placeholder:text-slate-600 font-medium"
                                                />
                                            </div>
                                            <div className="group/input">
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block group-focus-within/input:text-indigo-400 transition-colors">Passcode</label>
                                                <input
                                                    type="text"
                                                    placeholder="1234"
                                                    maxLength={4}
                                                    value={linkCode}
                                                    onChange={(e) => setLinkCode(e.target.value)}
                                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 focus:bg-slate-800 transition-all font-mono tracking-widest text-center placeholder:text-slate-600"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleCreateLink}
                                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/50"
                                        >
                                            <Lock size={16} /> Generate Link
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-auto space-y-4 animate-fade-in">
                                        <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700 backdrop-blur-sm">
                                            <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-semibold">Active Link</p>
                                            <div className="flex justify-between items-end">
                                                <span className="text-2xl font-bold text-white">₦{activeLink.amount.toLocaleString()}</span>
                                                <div className="flex items-center gap-2 bg-slate-700/50 px-2 py-1 rounded text-xs font-mono text-indigo-300 border border-indigo-500/20">
                                                    <Lock size={10} />
                                                    {activeLink.code}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <button className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm font-medium transition-colors border border-slate-700">
                                                Copy
                                            </button>
                                            <button
                                                onClick={onPreviewLink}
                                                className="flex-1 bg-white text-slate-900 hover:bg-indigo-50 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Eye size={16} /> Preview
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Account Details & Transactions Bento */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Account Info (1/3) */}
                    <div className="md:col-span-1 bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col justify-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-slate-50 rounded-2xl text-slate-400">
                                <CreditCard size={24} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-semibold uppercase">Virtual Bank</p>
                                <p className="font-bold text-slate-900">{user.virtualAccount?.bankName}</p>
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 group cursor-pointer hover:border-brand-200 transition-colors" onClick={() => handleCopy(user.virtualAccount?.accountNumber || '')}>
                            <p className="text-xs text-slate-400 mb-1">Account Number</p>
                            <div className="flex justify-between items-center">
                                <p className="text-xl font-mono font-bold text-slate-800 tracking-wider">{user.virtualAccount?.accountNumber}</p>
                                <Copy size={14} className="text-slate-400 group-hover:text-brand-600" />
                            </div>
                        </div>
                    </div>

                    {/* Transactions List (2/3) */}
                    <div className="md:col-span-2 bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-900 text-lg">Transactions</h3>
                            <button className="text-sm font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                                View All <ChevronRight size={14} />
                            </button>
                        </div>
                        <div className="space-y-1">
                            {transactions.map((tx) => (
                                <div key={tx.id} className="group p-3 -mx-3 hover:bg-slate-50 rounded-2xl transition-colors flex items-center justify-between cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${tx.type === 'credit'
                                            ? 'bg-emerald-100 text-emerald-600'
                                            : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {tx.type === 'credit' ? <ArrowDownLeft size={20} strokeWidth={2.5} /> : <ArrowUpRight size={20} strokeWidth={2.5} />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900">{tx.description}</p>
                                            <p className="text-xs text-slate-500 font-medium mt-0.5">{tx.category} • {new Date(tx.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <span className={`font-bold text-base tracking-tight ${tx.type === 'credit' ? 'text-emerald-600' : 'text-slate-900'
                                        }`}>
                                        {tx.type === 'credit' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN (AI Assistant) - Spans 4 cols */}
            <div className="lg:col-span-4 h-full min-h-[500px] flex flex-col">
                <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 flex flex-col h-full overflow-hidden relative">
                    {/* Header */}
                    <div className="p-6 pb-4 bg-white z-10 border-b border-slate-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-400 to-purple-400 flex items-center justify-center shadow-md">
                                <Sparkles size={18} className="text-white" fill="white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">AI Assistant</h3>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <p className="text-xs text-slate-500 font-medium">Online & Ready</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                        {chatMessages.map((msg, idx) => (
                            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                    ? 'bg-slate-900 text-white rounded-br-none'
                                    : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'
                                    }`}>
                                    {msg.text}
                                </div>
                                <span className="text-[10px] text-slate-400 mt-1 px-1">
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 rounded-bl-none flex gap-1.5 items-center shadow-sm">
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-slate-50">
                        <div className="relative">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Ask me anything..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-4 pr-12 py-3.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all text-slate-800 placeholder:text-slate-400"
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={isTyping || !inputMessage.trim()}
                                className="absolute right-2 top-2 p-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl disabled:opacity-50 disabled:bg-slate-300 transition-all shadow-md shadow-brand-500/20"
                            >
                                {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};