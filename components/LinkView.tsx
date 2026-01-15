import React, { useState, useEffect } from 'react';
import { SecureLink } from '../types';
import { Lock, Unlock, CheckCircle, ChevronLeft, ArrowRight, Loader2, Building2, CreditCard, Banknote, Clock } from 'lucide-react';
import { secureLinksService } from '../services/secureLinksService';
import { supabase } from '../lib/supabase';

interface LinkViewProps {
    linkData: SecureLink;
    onBack: () => void;
}

const NIGERIAN_BANKS = [
    { code: '044', name: 'Access Bank' },
    { code: '050', name: 'EcoBank' },
    { code: '070', name: 'Fidelity Bank' },
    { code: '011', name: 'First Bank' },
    { code: '058', name: 'GTBank' },
    { code: '030', name: 'Heritage Bank' },
    { code: '301', name: 'Jaiz Bank' },
    { code: '082', name: 'Keystone Bank' },
    { code: '076', name: 'Polaris Bank' },
    { code: '221', name: 'Stanbic IBTC' },
    { code: '068', name: 'Standard Chartered' },
    { code: '232', name: 'Sterling Bank' },
    { code: '032', name: 'Union Bank' },
    { code: '033', name: 'United Bank for Africa (UBA)' },
    { code: '035', name: 'Wema Bank' },
    { code: '057', name: 'Zenith Bank' }
];

export const LinkView: React.FC<LinkViewProps> = ({ linkData, onBack }) => {
    const [passcode, setPasscode] = useState('');
    const [step, setStep] = useState<'VERIFY' | 'DETAILS' | 'SUBMITTING' | 'WAITING' | 'SUCCESS'>('VERIFY');
    const [error, setError] = useState<string | null>(null);

    // Form Details
    const [amount, setAmount] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [bankName, setBankName] = useState('');

    // Realtime Subscription
    useEffect(() => {
        // If link is already approved/rejected, show success immediately
        if (linkData.status === 'approved' || linkData.status === 'rejected') {
            setStep('SUCCESS');
            return;
        }

        if (step !== 'WAITING') return;

        const channel = (supabase as any)
            .channel('link_approval')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'secure_links',
                    filter: `id=eq.${linkData.id}`
                },
                (payload: any) => {
                    console.log('Link updated:', payload);
                    if (payload.new.status === 'approved' || payload.new.status === 'rejected') {
                        setStep('SUCCESS');
                    }
                }
            )
            .subscribe();

        return () => {
            (supabase as any).removeChannel(channel);
        };
    }, [step, linkData.id, linkData.status]);

    const handleVerify = (e: React.FormEvent) => {
        e.preventDefault();
        if (passcode.length === 4) {
            setStep('DETAILS');
        }
    };

    const handleSubmitRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !accountNumber || !bankName) {
            setError('Please fill all fields');
            return;
        }

        setStep('SUBMITTING');
        setError(null);

        try {
            await secureLinksService.submitRequest(
                linkData.link_code,
                passcode,
                Number(amount),
                accountNumber,
                bankName
            );
            setStep('WAITING');
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Submission failed');
            setStep('DETAILS');
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden text-white">
            {/* Dynamic Background */}
            <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-indigo-600/30 rounded-full blur-[120px] animate-pulse-slow"></div>
            <div className="absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] bg-purple-600/30 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '1.5s' }}></div>

            <button onClick={onBack} className="absolute top-8 left-8 text-white/50 hover:text-white flex items-center gap-2 z-20 transition-colors group">
                <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 border border-white/5 backdrop-blur-sm">
                    <ChevronLeft size={20} />
                </div>
                <span className="text-sm font-medium">Back</span>
            </button>

            <div className="relative z-10 w-full max-w-sm">
                {step === 'SUCCESS' ? (
                    <div className="glass-dark border-emerald-500/30 p-10 rounded-[2.5rem] text-center shadow-2xl">
                        <div className="w-24 h-24 bg-gradient-to-tr from-emerald-400 to-teal-300 rounded-full flex items-center justify-center mx-auto mb-8 shadow-emerald-900/40">
                            <CheckCircle size={48} className="text-white" strokeWidth={3} />
                        </div>
                        <h2 className="text-3xl font-bold mb-2">Approved!</h2>
                        <p className="text-emerald-200/60 mb-8">The ₦{Number(amount).toLocaleString()} payment has been processed successfully.</p>
                        <button
                            onClick={onBack}
                            className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl border border-white/10"
                        >
                            Done
                        </button>
                    </div>
                ) : step === 'WAITING' ? (
                    <div className="glass-dark border-amber-500/30 p-10 rounded-[2.5rem] text-center shadow-2xl animate-fade-in">
                        <div className="w-24 h-24 bg-gradient-to-tr from-amber-400 to-orange-400 rounded-full flex items-center justify-center mx-auto mb-8 shadow-amber-900/40 relative">
                            <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-25"></div>
                            <Clock size={48} className="text-white relative z-10" strokeWidth={3} />
                        </div>
                        <h2 className="text-2xl font-bold mb-2 tracking-tight">Waiting for Approval</h2>
                        <p className="text-amber-200/60 mb-8 text-sm px-4">Your request for ₦{Number(amount).toLocaleString()} is being reviewed. This screen will update automatically.</p>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-8">
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Request Details</p>
                            <p className="text-sm font-bold text-white">{bankName}</p>
                            <p className="text-xs text-white/60 font-mono tracking-widest">{accountNumber}</p>
                        </div>

                        <button
                            onClick={onBack}
                            className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl border border-white/10"
                        >
                            Cancel Request
                        </button>
                    </div>
                ) : step === 'VERIFY' ? (
                    <div className="glass-dark p-8 rounded-[2.5rem] shadow-2xl">
                        <div className="text-center mb-10">
                            <div className="w-20 h-20 bg-indigo-500 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-3">
                                <Lock size={36} className="text-white" strokeWidth={2.5} />
                            </div>
                            <h2 className="text-2xl font-bold">Secure Access</h2>
                            <p className="text-indigo-200/50 text-sm mt-2">Enter the 4-digit passcode</p>
                        </div>
                        <form onSubmit={handleVerify}>
                            <input
                                type="text"
                                value={passcode}
                                onChange={(e) => setPasscode(e.target.value)}
                                maxLength={4}
                                placeholder="••••"
                                className="w-full bg-slate-900/50 border border-white/10 text-center text-5xl tracking-[0.5em] font-mono py-6 rounded-2xl mb-8 focus:border-indigo-400 focus:outline-none"
                            />
                            <button
                                type="submit"
                                disabled={passcode.length < 4}
                                className="w-full bg-white text-slate-950 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform disabled:opacity-50"
                            >
                                Continue <ArrowRight size={20} />
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="glass-dark p-8 rounded-[2.5rem] shadow-2xl animate-fade-in">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Request Payment</h2>
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></span>
                                <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Active Link</span>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-3 px-4 rounded-xl mb-6 text-center">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmitRequest} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-white/40 uppercase tracking-widest pl-1">Amount</label>
                                <div className="relative">
                                    <Banknote size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="₦ How much?"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-lg font-bold focus:border-indigo-500/50 focus:outline-none placeholder:text-white/10"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-white/40 uppercase tracking-widest pl-1">Bank Name</label>
                                <div className="relative">
                                    <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                                    <select
                                        value={bankName}
                                        onChange={(e) => setBankName(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-indigo-500/50 focus:outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="" className="bg-slate-900">Select Bank</option>
                                        {NIGERIAN_BANKS.map(bank => (
                                            <option key={bank.code} value={bank.name} className="bg-slate-900">{bank.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-white/40 uppercase tracking-widest pl-1">Account Number</label>
                                <div className="relative">
                                    <CreditCard size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                                    <input
                                        type="text"
                                        value={accountNumber}
                                        onChange={(e) => setAccountNumber(e.target.value)}
                                        placeholder="0000000000"
                                        maxLength={10}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-lg font-bold tracking-widest focus:border-indigo-500/50 focus:outline-none placeholder:text-white/10"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={step === 'SUBMITTING'}
                                className="w-full bg-white text-slate-950 font-bold py-5 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-indigo-500/10 mt-4 disabled:opacity-50"
                            >
                                {step === 'SUBMITTING' ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} /> Sending Request...
                                    </>
                                ) : (
                                    <>
                                        Send Request <ArrowRight size={20} />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};