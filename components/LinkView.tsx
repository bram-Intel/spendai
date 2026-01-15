import React, { useState, useEffect } from 'react';
import { SecureLink } from '../types';
import { Lock, Unlock, CheckCircle, ChevronLeft, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LinkViewProps {
    linkData: SecureLink;
    onBack: () => void;
}

export const LinkView: React.FC<LinkViewProps> = ({ linkData, onBack }) => {
    const [passcode, setPasscode] = useState('');
    const [status, setStatus] = useState<'LOCKED' | 'UNLOCKING' | 'SUCCESS' | 'ERROR'>('LOCKED');

    /* REPLACE: Use RPC to claim */
    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passcode.length < 4) return;

        setStatus('UNLOCKING');

        // Local check first if we have linkData (which we do if passed as prop), but real security is backend.
        // If we are claiming via ID/Code entered manually, we might not have linkData.
        // Here we have linkData from props, so we are "claiming" the one being viewed.
        // BUT typically the "code" is the secret key. 
        // If linkData.code is visible to the user before unlocking, then it's not a secret.
        // In our simplified model, the 'code' is the passcode.

        // We call RPC `claim_payment_link`.

        try {
            const { data, error } = await (supabase as any).rpc('claim_payment_link', {
                p_link_code: linkData.link_code, // Updated to link_code from types.ts
                p_passcode: passcode      // The 4-digit secret
            });

            if (error) {
                console.error(error);
                setStatus('ERROR');
                setTimeout(() => setStatus('LOCKED'), 1000);
                return;
            }

            setStatus('SUCCESS');
            // Optionally callback to refresh user balance
            // onClaimSuccess(); 
        } catch (err) {
            console.error(err);
            setStatus('ERROR');
            setTimeout(() => setStatus('LOCKED'), 1000);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden text-white">
            {/* Dynamic Background */}
            <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-indigo-600/30 rounded-full blur-[120px] animate-pulse-slow"></div>
            <div className="absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] bg-purple-600/30 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '1.5s' }}></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05]"></div>

            {/* Back Navigation */}
            <button onClick={onBack} className="absolute top-8 left-8 text-white/50 hover:text-white flex items-center gap-2 z-20 transition-colors group">
                <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 border border-white/5 backdrop-blur-sm">
                    <ChevronLeft size={20} />
                </div>
                <span className="text-sm font-medium">Dashboard</span>
            </button>

            <div className="relative z-10 w-full max-w-sm">
                {status === 'SUCCESS' ? (
                    <div className="relative animate-fade-in">
                        {/* Success Card */}
                        <div className="glass-dark border-emerald-500/30 p-10 rounded-[2.5rem] text-center shadow-2xl shadow-emerald-900/40 relative overflow-hidden">
                            <div className="absolute inset-0 bg-emerald-500/10 mix-blend-overlay"></div>

                            <div className="relative z-10">
                                <div className="w-24 h-24 bg-gradient-to-tr from-emerald-400 to-teal-300 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(52,211,153,0.5)] animate-slide-up">
                                    <CheckCircle size={48} className="text-white drop-shadow-md" strokeWidth={3} />
                                </div>

                                <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">Unlocked!</h2>
                                <p className="text-emerald-200/80 font-medium mb-8">Funds claimed successfully</p>

                                <div className="bg-emerald-950/50 border border-emerald-500/20 rounded-2xl py-6 px-4 mb-6">
                                    <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">Amount Received</p>
                                    <div className="text-5xl font-bold text-white tracking-tighter">
                                        ₦{linkData.amount.toLocaleString()}
                                    </div>
                                </div>

                                <p className="text-xs text-slate-400">Transaction ID: {linkData.id.toUpperCase()}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={`glass-dark p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden ${status === 'ERROR' ? 'animate-shake border-red-500/50' : ''}`}>

                        <div className="text-center mb-10 relative z-10">
                            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/30 transform rotate-3">
                                {status === 'UNLOCKING' ? (
                                    <Unlock size={36} className="text-white animate-bounce" strokeWidth={2.5} />
                                ) : (
                                    <Lock size={36} className="text-white" strokeWidth={2.5} />
                                )}
                            </div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Secure Transfer</h2>
                            <p className="text-indigo-200/70 text-sm mt-2 font-medium">Enter the 4-digit code to unlock</p>
                        </div>

                        <form onSubmit={handleUnlock} className="relative z-10">
                            <div className="mb-8">
                                <input
                                    type="text"
                                    value={passcode}
                                    onChange={(e) => setPasscode(e.target.value)}
                                    maxLength={4}
                                    placeholder="••••"
                                    className={`w-full bg-slate-900/50 border text-center text-5xl tracking-[0.5em] font-mono py-6 rounded-2xl focus:outline-none transition-all placeholder:text-white/10 ${status === 'ERROR'
                                        ? 'border-red-500/50 text-red-400'
                                        : 'border-white/10 text-white focus:border-indigo-400/50 focus:ring-4 focus:ring-indigo-500/10'
                                        }`}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={status === 'UNLOCKING' || passcode.length < 4}
                                className="group w-full bg-white text-slate-950 font-bold py-4 rounded-2xl transition-all shadow-lg hover:shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                            >
                                {status === 'UNLOCKING' ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="animate-spin" size={20} /> Verifying...
                                    </span>
                                ) : (
                                    <>
                                        Unlock Funds <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Security Badge */}
                        <div className="mt-8 flex justify-center items-center gap-2 opacity-40">
                            <Lock size={12} />
                            <span className="text-[10px] uppercase tracking-widest font-bold">End-to-End Encrypted</span>
                        </div>
                    </div>
                )}
            </div>

            {/* CSS for shake animation */}
            <style>{`
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                20%, 40%, 60%, 80% { transform: translateX(4px); }
            }
            .animate-shake {
                animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
            }
        `}</style>
        </div>
    );
};