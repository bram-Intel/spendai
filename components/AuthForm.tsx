import React, { useState } from 'react';
import { ArrowRight, Bot, Lock, Mail } from 'lucide-react';
import { authService } from '../services/authService';

interface AuthFormProps {
    onSuccess: (userId: string) => void;
}

export const AuthForm: React.FC<AuthFormProps> = ({ onSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [checkEmail, setCheckEmail] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            let result;
            if (isSignUp) {
                result = await authService.signUp(email, password, fullName);
            } else {
                result = await authService.signIn(email, password);
            }

            if (result.error) {
                setError(result.error.message);
                setIsLoading(false);
                return;
            }

            if (isSignUp) {
                setCheckEmail(true);
                setIsLoading(false);
            } else if (result.user) {
                onSuccess(result.user.id);
            }
        } catch (err) {
            setError('An unexpected error occurred');
            setIsLoading(false);
        }
    };

    if (checkEmail) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl w-full max-w-md text-center animate-fade-in border border-slate-100">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Mail size={32} className="text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">Check your inbox</h2>
                    <p className="text-slate-600 mb-8 leading-relaxed">
                        We've sent a confirmation link to <strong>{email}</strong>.<br />
                        Please click the link to verify your account and sign in.
                    </p>
                    <button
                        onClick={() => setCheckEmail(false)}
                        className="text-brand-600 font-bold hover:underline"
                    >
                        Back to Sign In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-white font-sans">
            {/* Left Side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16">
                <div className="w-full max-w-md space-y-8 animate-fade-in">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center text-white">
                            <Bot className="w-6 h-6" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-slate-900">Spend.AI</span>
                    </div>

                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
                        <p className="text-slate-500 mt-2">Enter your details to access your smart wallet.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        {isSignUp && (
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-slate-700">Full Name</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full pl-4 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                                        placeholder="John Doe"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-700">Email</label>
                            <div className="relative group">
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                                    placeholder="name@example.com"
                                />
                                <Mail className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-brand-600 transition-colors" size={20} />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-700">Password</label>
                            <div className="relative group">
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                                    placeholder="••••••••"
                                />
                                <Lock className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-brand-600 transition-colors" size={20} />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl transition-all active:scale-[0.99] flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Authenticating...' : (
                                <>
                                    {isSignUp ? 'Sign Up' : 'Sign In'} <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-sm text-slate-400">
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                        <span
                            className="text-brand-600 font-semibold cursor-pointer hover:underline"
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setError(null);
                            }}
                        >
                            {isSignUp ? 'Sign in' : 'Sign up'}
                        </span>
                    </p>
                </div>
            </div>

            {/* Right Side - Visual */}
            <div className="hidden lg:flex w-1/2 bg-slate-900 relative overflow-hidden items-center justify-center p-12">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-500/20 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/20 rounded-full blur-[120px]"></div>

                <div className="relative z-10 text-center max-w-lg">
                    <div className="glass-dark p-8 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-xl mb-8 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-brand-400 to-brand-600"></div>
                            <div className="h-4 w-32 bg-white/10 rounded-full"></div>
                        </div>
                        <div className="space-y-3">
                            <div className="h-3 w-full bg-white/5 rounded-full"></div>
                            <div className="h-3 w-5/6 bg-white/5 rounded-full"></div>
                            <div className="h-3 w-4/6 bg-white/5 rounded-full"></div>
                        </div>
                        <div className="mt-8 flex justify-between items-center">
                            <div className="h-8 w-24 bg-brand-500/20 rounded-lg border border-brand-500/30"></div>
                            <div className="h-8 w-8 bg-white/10 rounded-full"></div>
                        </div>
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4">Banking for the future generation</h2>
                    <p className="text-slate-400 text-lg leading-relaxed">Experience seamless transactions, AI-powered insights, and secure links with Spend.AI.</p>
                </div>
            </div>
        </div>
    );
};