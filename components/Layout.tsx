import React, { useState } from 'react';
import { 
  Wallet, 
  CreditCard, 
  PieChart, 
  Settings, 
  LogOut, 
  Bot,
  Bell,
  Menu,
  X
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  userEmail: string;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, userEmail, onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50/50 flex font-sans text-slate-900 selection:bg-brand-100 selection:text-brand-900">
      
      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 md:hidden animate-fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Responsive */}
      <aside className={`
        fixed md:relative z-40 inset-y-0 left-0
        flex flex-col w-[280px] h-full md:h-auto md:min-h-[calc(100vh-2rem)]
        bg-slate-900 text-slate-300
        md:m-4 md:rounded-3xl shadow-2xl shadow-slate-900/10
        overflow-hidden border-r md:border border-slate-800
        transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Abstract Background Element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 blur-[80px] rounded-full pointer-events-none"></div>

        {/* Mobile Close Button */}
        <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white md:hidden z-20"
        >
            <X size={24} />
        </button>

        <div className="p-8 pb-4 flex items-center gap-3 relative z-10 mt-2 md:mt-0">
          <div className="w-10 h-10 bg-gradient-to-tr from-brand-400 to-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/30 text-white">
            <Bot className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white block">Spend.AI</span>
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Future Finance</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 relative z-10">
          <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Menu</p>
          <NavItem icon={<Wallet size={20} />} label="Overview" active />
          <NavItem icon={<CreditCard size={20} />} label="Cards" />
          <NavItem icon={<PieChart size={20} />} label="Analytics" />
          <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mt-8 mb-2">System</p>
          <NavItem icon={<Settings size={20} />} label="Settings" />
        </nav>

        <div className="p-4 relative z-10">
          <div className="glass-dark rounded-2xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm font-bold text-white shadow-inner">
                {userEmail.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{userEmail}</p>
                <p className="text-xs text-slate-400">Pro Plan</p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="flex items-center justify-center gap-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-all w-full py-2.5 rounded-xl text-sm font-medium"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header with Hamburger */}
        <header className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center z-20 shadow-md shrink-0 border-b border-slate-800">
             <div className="flex items-center gap-3">
                <button 
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2 -ml-2 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                >
                    <Menu size={24} />
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
                        <Bot className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-lg font-bold tracking-tight">Spend.AI</span>
                </div>
            </div>
            <button onClick={onLogout} className="p-2 bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700">
                <LogOut size={20} />
            </button>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            {/* Top Bar (Desktop) */}
            <div className="hidden md:flex justify-between items-center mb-8 animate-fade-in">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
                    <p className="text-slate-500 text-sm mt-1">Good morning! Here's your financial overview.</p>
                </div>
                <div className="flex items-center gap-4">
                     <button className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-brand-600 hover:border-brand-200 transition-colors shadow-sm relative">
                        <Bell size={20} />
                        <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                    </button>
                </div>
            </div>
            
            {/* Page Content */}
            <div className="max-w-7xl mx-auto h-full animate-slide-up">
                {children}
            </div>
        </div>
      </main>
    </div>
  );
};

const NavItem: React.FC<{ icon: React.ReactNode; label: string; active?: boolean }> = ({ icon, label, active }) => (
  <button 
    className={`flex items-center gap-3 w-full px-4 py-3.5 rounded-xl transition-all duration-200 group ${
      active 
        ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20 font-medium' 
        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
    }`}
  >
    <div className={`transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
        {icon}
    </div>
    <span className="text-sm">{label}</span>
    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50"></div>}
  </button>
);