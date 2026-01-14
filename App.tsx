import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { AuthForm } from './components/AuthForm';
import { KYCForm } from './components/KYCForm';
import { Dashboard } from './components/Dashboard';
import { LinkView } from './components/LinkView';
import { AppPhase, User, SecureLink } from './types';
import { MOCK_TRANSACTIONS, MOCK_VIRTUAL_ACCOUNT } from './constants';
import { authService } from './services/authService';
import { databaseService } from './services/databaseService';
import { koboToNaira } from './lib/currency';

const App: React.FC = () => {
  const [phase, setPhase] = useState<AppPhase>('AUTH');
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // State to simulate database user
  const [user, setUser] = useState<User>({
    id: 'usr_123',
    name: 'Chinedu Okafor',
    email: 'chinedu@example.com',
    kycVerified: false,
    walletBalance: 0,
    virtualAccount: null,
  });

  // State for Secure Link
  const [activeLink, setActiveLink] = useState<SecureLink | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const session = await authService.getSession();
    if (session?.user) {
      setUserId(session.user.id);
      await loadUserData(session.user.id);
    }
    setIsLoading(false);
  };

  const loadUserData = async (uid: string) => {
    const userData = await databaseService.getUserData(uid);
    if (userData) {
      setUser({
        id: userData.profile.id,
        name: userData.profile.full_name,
        email: userData.profile.email,
        kycVerified: userData.profile.kyc_verified || false,
        walletBalance: koboToNaira(userData.wallet.balance || 0), // Convert from kobo
        virtualAccount: userData.wallet.nuban_account_number ? {
          bankName: userData.wallet.nuban_bank_name || '',
          accountNumber: userData.wallet.nuban_account_number,
          accountName: userData.wallet.nuban_account_name || '',
        } : null,
      });

      // Determine phase based on KYC status
      if (userData.profile.kyc_verified) {
        setPhase('DASHBOARD');
      } else {
        setPhase('KYC');
      }
    }
  };

  // Flow Handlers
  const handleAuthSuccess = async (uid: string) => {
    setUserId(uid);
    await loadUserData(uid);
  };

  const handleKYCSuccess = async () => {
    if (!userId) return;

    // Update profile KYC status in database
    await databaseService.updateProfile(userId, {
      kyc_verified: true,
      kyc_tier: 1,
    });

    // Reload user data
    await loadUserData(userId);
  };

  const handleLogout = async () => {
    await authService.signOut();
    setPhase('AUTH');
    setUserId(null);
    setUser({
      id: '',
      name: '',
      email: '',
      kycVerified: false,
      walletBalance: 0,
      virtualAccount: null,
    });
    setActiveLink(null);
  };

  const handleCreateLink = (amount: number, code: string) => {
      setActiveLink({
          amount,
          code,
          id: `lnk_${Date.now()}`,
          createdAt: new Date(),
          isUsed: false
      });
      // Deduct from balance for realism
      setUser(prev => ({ ...prev, walletBalance: prev.walletBalance - amount }));
  };

  // Render Logic
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (phase === 'AUTH') {
    return <AuthForm onSuccess={handleAuthSuccess} />;
  }

  if (phase === 'KYC') {
    return <KYCForm onSuccess={handleKYCSuccess} />;
  }

  if (phase === 'LINK_VIEW' && activeLink) {
      return <LinkView linkData={activeLink} onBack={() => setPhase('DASHBOARD')} />;
  }

  return (
    <Layout userEmail={user.email} onLogout={handleLogout}>
      <Dashboard 
        user={user} 
        transactions={MOCK_TRANSACTIONS} 
        activeLink={activeLink}
        onCreateLink={handleCreateLink}
        onPreviewLink={() => setPhase('LINK_VIEW')}
      />
    </Layout>
  );
};

export default App;