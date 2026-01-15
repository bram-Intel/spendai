import React, { useState } from 'react';
import { User, Transaction, ChatMessage, SecureLink } from '../types';
import { Copy, ArrowUpRight, ArrowDownLeft, Send, Sparkles, Loader2, Link as LinkIcon, Lock, Eye, Wallet, CreditCard, ChevronRight, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { geminiService } from '../services/geminiService';
import { secureLinksService } from '../services/secureLinksService';

interface DashboardProps {
    user: User;
    transactions: Transaction[];
    activeLink: SecureLink | null;
    onCreateLink: (link: SecureLink) => void;
    onPreviewLink: () => void;
    onRefresh: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, transactions, activeLink, onCreateLink, onPreviewLink, onRefresh }) => {
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        {
            role: 'model',
            text: `Hello ${user.name.split(' ')[0]}! 🌟 I noticed you spent a bit more on Food this week. Want to set up a budget or generate a Secure Link for pocket money?`,
            timestamp: new Date()
        }
    ]);
    const [inputMessage, setInputMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
    const chatEndRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isTyping]);

    // Link Creation State
    const [linkAmount, setLinkAmount] = useState('');
    const [linkCode, setLinkCode] = useState('');

    const [showCopied, setShowCopied] = useState(false);

    const handleCopy = (text: string) => {
        // Create a full URL for the link (mocking the base URL for now)
        const fullUrl = `${window.location.origin}/link/${text}`;
        navigator.clipboard.writeText(fullUrl);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
    };

    /* 
       REPLACE: Using Edge Function for AI instead of local service
    */
    // Import supabase at top (we'll add import in next step or assume it exists/we add it)
    // For now let's assume we pass supabase or import it. We should import it.

    const [pendingLinks, setPendingLinks] = useState<SecureLink[]>([]);
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
    const [pin, setPin] = useState('');
    const [isApproving, setIsApproving] = useState(false);
    const [isLive, setIsLive] = useState(false);

    // Fetch pending links and setup real-time subscription
    React.useEffect(() => {
        fetchPending();

        // 360° Real-time Subscription for the Owner
        const channel = (supabase as any)
            .channel('dashboard_sync')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'secure_links' },
                (payload: any) => {
                    console.log('Real-time update on dashboard:', payload.eventType);
                    fetchPending();
                    onRefresh();
                }
            )
            .subscribe((status: string) => {
                setIsLive(status === 'SUBSCRIBED');
            });

        return () => {
            (supabase as any).removeChannel(channel);
        };
    }, []);

    const fetchPending = async () => {
        try {
            const data = await secureLinksService.getPendingApprovals();
            setPendingLinks(data);
        } catch (err) {
            console.error('Failed to fetch pending requests', err);
        }
    };

    const handleCreateLink = async () => {
        if (!linkAmount || !linkCode) return;

        try {
            const link = await secureLinksService.createLink(Number(linkAmount), linkCode, 'Spend Request Link');
            onCreateLink(link);
            setLinkCode('');
            setLinkAmount('');
        } catch (err: any) {
            console.error(err);
            alert('Failed to create link: ' + err.message);
        }
    };

    const handleApprove = async () => {
        if (!selectedLinkId || pin.length < 4) return;
        setIsApproving(true);
        try {
            await secureLinksService.approveRequest(selectedLinkId, pin);
            setIsPinModalOpen(false);
            setPin('');
            setSelectedLinkId(null);
            fetchPending();
            onRefresh();
        } catch (err: any) {
            alert(err.message || 'Approval failed. Check your PIN.');
        } finally {
            setIsApproving(false);
        }
    };

    const handleDecline = async (linkId: string) => {
        if (!confirm('Are you sure you want to decline this request? The funds will be returned to your balance.')) return;
        try {
            await secureLinksService.rejectRequest(linkId);
            fetchPending();
            onRefresh();
        } catch (err: any) {
            alert(err.message || 'Decline failed.');
        }
    };

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isTyping) return;

        const userMsg: ChatMessage = {
            role: 'user',
            text: inputMessage,
            timestamp: new Date()
        };

        setChatMessages(prev => [...prev, userMsg]);
        setInputMessage('');
        setIsTyping(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(`${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/ask-financial-advisor`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ prompt: inputMessage })
            });

            const result = await response.json();

            if (result.success) {
                const aiMsg: ChatMessage = {
                    role: 'model',
                    text: result.response,
                    action: result.action,
                    timestamp: new Date()
                };
                setChatMessages(prev => [...prev, aiMsg]);
            } else {
                throw new Error(result.details || result.error || 'Failed to get AI response');
            }
        } catch (err: any) {
            setChatMessages(prev => [...prev, {
                role: 'model',
                text: "I'm having trouble connecting right now. Please try again later.",
                timestamp: new Date()
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleExecuteAiAction = async (action: any) => {
        if (action.type === 'CREATE_LINK') {
            try {
                // Set the link creation state
                setLinkAmount(action.params.amount.toString());
                // Trigger the creation logic (we can call the service directly)
                const link = await secureLinksService.createLink(
                    action.params.amount,
                    '1234', // Default for AI generation
                    action.params.description || 'AI Generated Link'
                );
                onCreateLink(link);

                // Add follow up message
                setChatMessages(prev => [...prev, {
                    role: 'model',
                    text: `Done! 🚀 I've generated a link for ₦${action.params.amount.toLocaleString()}. You can copy it above.`,
                    timestamp: new Date()
                }]);
            } catch (err) {
                console.error('AI Link creation failed:', err);
            }
        } else if (action.type === 'INITIATE_TRANSFER') {
            // Since Paystack is not LIVE, we simulation it by recording a transaction
            // But first, we need the user to approve with PIN? 
            // For now, let's just trigger a "Success" message and record it.
            // In a real app, this would open a 'Review Transfer' modal.

            // For the Demo, let's just show a success message as if it happened.
            setChatMessages(prev => [...prev, {
                role: 'model',
                text: `Transfer of ₦${action.params.amount?.toLocaleString()} to ${action.params.bank_name} (${action.params.account_number}) has been initiated simulation-style! In production, this would use Paystack.`,
                timestamp: new Date()
            }]);
            onRefresh();
        }
    };

    return (
        <div className="flex flex-col gap-6 pb-12">
            {/* Ambient AI Insight Header */}
            <div
                onClick={() => setIsAiDrawerOpen(true)}
                className="p-4 rounded-3xl bg-gradient-to-r from-brand-900 via-slate-900 to-brand-950 border border-brand-800/30 shadow-2xl cursor-pointer group hover:scale-[1.005] active:scale-[0.995] transition-all duration-500 relative overflow-hidden"
            >
                {/* Animated Background Glow */}
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-brand-500/10 rounded-full blur-[80px] group-hover:bg-brand-500/20 transition-all duration-700"></div>

                <div className="flex items-center gap-5 relative z-10">
                    <div className="p-3 bg-brand-500/10 rounded-2xl border border-brand-500/20 group-hover:border-brand-500/40 transition-colors">
                        <Sparkles size={22} className="text-brand-400 animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <p className="text-[10px] uppercase font-bold text-brand-400 tracking-[0.25em]">Ambient Intelligence</p>
                            <span className="w-1 h-1 rounded-full bg-brand-400/40"></span>
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Live Analysis</p>
                        </div>
                        <p className="text-white text-sm md:text-base font-medium leading-relaxed truncate">
                            {chatMessages.length > 0
                                ? chatMessages[chatMessages.length - 1].role === 'model'
                                    ? chatMessages[chatMessages.length - 1].text
                                    : "Analyzing your recent transfers... Tap for details."
                                : "Hello Abraham! I've analyzed your spending. Want to see some insights?"}
                        </p>
                    </div>
                    <div className="hidden md:flex items-center gap-3 pr-2">
                        <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest group-hover:text-white/60 transition-colors">Open Agent</span>
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                            <ChevronRight size={18} className="text-white/40 group-hover:text-white transition-all group-hover:translate-x-0.5" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* LEFT COLUMN (Finance Core) - Now full width for cleaner layout */}
                <div className="flex flex-col gap-6">

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
                                                        {activeLink.link_code}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 relative">
                                                {showCopied && (
                                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg animate-bounce z-50">
                                                        LINK COPIED!
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => handleCopy(activeLink.link_code)}
                                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm font-medium transition-colors border border-slate-700"
                                                >
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

                    {/* PENDING APPROVALS SECTION */}
                    {pendingLinks.length > 0 && (
                        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 animate-slide-up">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                                        <Sparkles size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-slate-900">Incoming Requests</h3>
                                            {isLive && (
                                                <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                                    LIVE
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500">Links waiting for your approval</p>
                                    </div>
                                </div>
                                <span className="bg-amber-100 text-amber-600 text-xs font-bold px-3 py-1 rounded-full">{pendingLinks.length} New</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pendingLinks.map(link => (
                                    <div key={link.id} className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-between group hover:border-brand-200 transition-all">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Requested Amount</p>
                                                <p className="text-2xl font-bold text-slate-900 tracking-tight">₦{link.requested_amount?.toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">To Bank</p>
                                                <p className="text-sm font-bold text-slate-700">{link.target_bank_name}</p>
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-slate-200/50 flex gap-3">
                                            <button
                                                onClick={() => { setSelectedLinkId(link.id); setIsPinModalOpen(true); }}
                                                className="flex-1 bg-brand-900 text-white py-3 rounded-xl text-sm font-bold hover:bg-black active:scale-95 transition-all shadow-lg"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleDecline(link.id)}
                                                className="px-4 bg-slate-200 text-slate-600 py-3 rounded-xl text-sm font-bold hover:bg-red-50 hover:text-red-600 transition-all"
                                            >
                                                Decline
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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
            </div>

            {/* PIN MODAL FOR APPROVAL */}
            {/* Floating AI Orb */}
            {!isAiDrawerOpen && (
                <button
                    onClick={() => setIsAiDrawerOpen(true)}
                    className="fixed bottom-8 right-8 p-4 bg-brand-900 text-white rounded-full shadow-2xl hover:bg-slate-800 hover:scale-110 active:scale-95 transition-all duration-300 z-40 group border border-brand-700/50 animate-orb-glow"
                >
                    <div className="relative">
                        <Sparkles size={24} />
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-brand-400 rounded-full border-2 border-brand-900 animate-ping"></span>
                    </div>
                    <span className="absolute right-full mr-4 bg-brand-900 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg border border-brand-700/50 uppercase tracking-widest">
                        Ask AI Assistant
                    </span>
                </button>
            )}

            {/* AI Assistant Drawer */}
            {isAiDrawerOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] z-50 transition-opacity duration-300 animate-in fade-in"
                        onClick={() => setIsAiDrawerOpen(false)}
                    />

                    {/* Side Panel */}
                    <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[60] flex flex-col animate-in slide-in-from-right duration-500 ease-out border-l border-brand-100">
                        {/* Drawer Header */}
                        <div className="p-6 border-b border-brand-50 flex justify-between items-center bg-brand-50/50">
                            <div>
                                <h2 className="text-lg font-bold text-brand-900 flex items-center gap-2">
                                    <Sparkles size={18} className="text-brand-500" />
                                    Spend.AI Agent
                                </h2>
                                <p className="text-[10px] text-brand-600 font-bold uppercase tracking-widest leading-none mt-1">Intelligence Powered</p>
                            </div>
                            <button
                                onClick={() => setIsAiDrawerOpen(false)}
                                className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-brand-900"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-brand-50/20 to-white">
                            {chatMessages.map((msg, index) => (
                                <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                    <div className={`max-w-[85%] p-4 rounded-2xl ${msg.role === 'user'
                                        ? 'bg-brand-900 text-white rounded-tr-none shadow-lg'
                                        : 'bg-white border border-brand-100 text-brand-900 rounded-tl-none shadow-sm'
                                        }`}>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                                        {/* Action Card */}
                                        {msg.action && (
                                            <div className="mt-4 p-4 rounded-xl bg-brand-50 border border-brand-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="p-1.5 bg-brand-500 rounded-lg">
                                                        <Sparkles size={14} className="text-white" />
                                                    </div>
                                                    <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">AI Proposal</p>
                                                </div>

                                                {msg.action.type === 'CREATE_LINK' ? (
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-brand-900/40">Amount</span>
                                                            <span className="font-bold text-brand-900">₦{msg.action.params.amount?.toLocaleString()}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleExecuteAiAction(msg.action!)}
                                                            className="w-full bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold py-2.5 rounded-lg transition-all"
                                                        >
                                                            Generate Link
                                                        </button>
                                                    </div>
                                                ) : msg.action.type === 'INITIATE_TRANSFER' ? (
                                                    <div className="space-y-3">
                                                        <div className="bg-white/50 rounded-lg p-2 space-y-1">
                                                            <p className="text-xs font-bold text-brand-900">{msg.action.params.bank_name}</p>
                                                            <p className="text-[10px] text-brand-900/60 font-mono tracking-tighter">{msg.action.params.account_number}</p>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-brand-900/40 text-[10px]">Amount</span>
                                                            <span className="font-bold text-brand-900">₦{msg.action.params.amount?.toLocaleString() || '---'}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleExecuteAiAction(msg.action!)}
                                                            className="w-full bg-brand-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 rounded-lg transition-all"
                                                        >
                                                            Confirm & Pay
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-1 px-1 font-medium">
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex items-center gap-2 p-4 bg-brand-50/50 rounded-2xl w-fit animate-pulse border border-brand-100/50">
                                    <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-6 bg-white border-t border-brand-50">
                            <form
                                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                                className="flex gap-3"
                            >
                                <input
                                    type="text"
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    placeholder="Ask about spending or transfers..."
                                    className="flex-1 bg-brand-50 border-none rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-brand-500 placeholder:text-brand-900/30"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputMessage.trim() || isTyping}
                                    className="bg-brand-900 hover:bg-slate-800 text-white p-3.5 rounded-xl disabled:opacity-50 transition-all shadow-lg active:scale-95"
                                >
                                    <Send size={18} />
                                </button>
                            </form>
                        </div>
                    </div>
                </>
            )}

            {isPinModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-slate-950/40 animate-fade-in">
                    <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-slate-100 flex flex-col items-center">
                        <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 mb-6">
                            <Lock size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2 text-center">Enter PIN</h3>
                        <p className="text-slate-500 text-sm mb-8 text-center px-4">Provide your transaction PIN to approve this payment request.</p>

                        <div className="w-full mb-8">
                            <input
                                type="password"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                maxLength={4}
                                placeholder="••••"
                                className="w-full bg-slate-50 border border-slate-200 text-center text-4xl tracking-[0.5em] font-mono py-5 rounded-2xl focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all"
                                autoFocus
                            />
                        </div>

                        <div className="flex flex-col w-full gap-3">
                            <button
                                onClick={handleApprove}
                                disabled={pin.length < 4 || isApproving}
                                className="w-full bg-brand-900 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-black active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isApproving ? <Loader2 className="animate-spin" size={20} /> : 'Approve Payment'}
                            </button>
                            <button
                                onClick={() => { setIsPinModalOpen(false); setPin(''); }}
                                className="w-full text-slate-400 font-bold py-3 text-sm hover:text-slate-600 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* End of Main Container */}
        </div>
    );
};
