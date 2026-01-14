import React, { useState } from 'react';
import { ShieldCheck, Calendar, UserCheck, Loader2, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface KYCFormProps {
    onSuccess: () => void;
    onLogout: () => void;
}

export const KYCForm: React.FC<KYCFormProps> = ({ onSuccess, onLogout }) => {
    const [bvn, setBvn] = useState('');
    const [dob, setDob] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (bvn.length !== 11) {
            setError("BVN must be 11 digits.");
            return;
        }
        setError(null);
        setIsVerifying(true);

        try {
            const { data, error } = await supabase.functions.invoke('verify-identity', {
                body: { bvn, dob }
            });

            if (error) throw error;

            if (data && !data.success) {
                throw new Error(data.error || 'Verification failed');
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message || "An error occurred during verification.");
            setIsVerifying(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col relative animate-fade-in">
                {/* Header / Graphic */}
                <div className="h-40 bg-slate-900 relative overflow-hidden flex items-center justify-center">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-brand-900 to-slate-900"></div>
                    <div className="absolute top-[-50%] left-[-20%] w-[300px] h-[300px] bg-brand-500/20 rounded-full blur-[60px]"></div>

                    <div className="relative z-10 text-center">
                        <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/10 shadow-lg">
                            <ShieldCheck className="text-brand-300" size={32} />
                        </div>
                        <h2 className="text-white font-bold text-xl tracking-tight">Identity Verification</h2>
                    </div>
                </div>

                <div className="p-8 pt-10">
                    <p className="text-slate-600 text-center mb-8 leading-relaxed text-sm">
                        We need to verify your identity to issue your virtual account. This is a one-time process secured by Paystack.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Bank Verification Number</label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    required
                                    maxLength={11}
                                    value={bvn}
                                    onChange={(e) => setBvn(e.target.value.replace(/\D/g, ''))}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-mono tracking-[0.2em] text-lg text-slate-800"
                                    placeholder="00000000000"
                                />
                                <UserCheck className="absolute left-4 top-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" size={20} />
                            </div>
                            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                                Dial *565*0# to check
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date of Birth</label>
                            <div className="relative group">
                                <input
                                    type="date"
                                    required
                                    value={dob}
                                    onChange={(e) => setDob(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-slate-800"
                                />
                                <Calendar className="absolute left-4 top-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" size={20} />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl border border-red-100 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isVerifying}
                            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-brand-500/30 active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            {isVerifying ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    Verifying securely...
                                </>
                            ) : 'Verify Identity'}
                        </button>
                    </form>

                    <div className="mt-8 flex flex-col items-center gap-4">
                        <div className="flex justify-center items-center gap-2 text-slate-400 opacity-60">
                            <Lock size={12} />
                            <span className="text-[10px] uppercase font-bold tracking-wider">256-Bit SSL Secured</span>
                        </div>
                        <button onClick={onLogout} className="text-slate-400 text-xs hover:text-slate-600 underline">
                            Log Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};