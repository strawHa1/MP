import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Globe2,
  Shield,
  ArrowRight,
  Lock,
  Mail,
  CheckCircle2
} from 'lucide-react';

interface AuthPageProps {
  onNavigate: (path: string) => void;
  mode?: 'login' | 'signup';
}

export const LoginPage: React.FC<AuthPageProps> = ({ onNavigate, mode = 'login' }) => {
  const isLogin = mode === 'login';
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('j.doe@blackswan-intel.com');
  const [password, setPassword] = useState('••••••••••••');
  const [name, setName] = useState('John Doe');
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex font-sans">
      {/* Left Form Area */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-8 sm:p-12 lg:p-16 border-r border-[#232A3D] z-10 bg-[#0A0E17]">
        {/* Brand */}
        <div 
          onClick={() => onNavigate('/')}
          className="flex items-center gap-3 cursor-pointer w-fit"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-lg">
            ∆
          </div>
          <span className="font-extrabold tracking-wider text-base font-mono">BLACK SWAN</span>
        </div>

        {/* Form Content */}
        <div className="max-w-md w-full mx-auto my-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              {isLogin ? 'Welcome Back' : 'Create Enterprise Account'}
            </h1>
            <p className="text-slate-400 text-sm mt-2">
              {isLogin
                ? 'Sign in to access your financial risk intelligence terminal.'
                : 'Start monitoring global events and real-time market tail risks.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#161B2C] border border-[#232A3D] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm transition-colors"
                  placeholder="John Doe"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Corporate Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 pl-10 rounded-xl bg-[#161B2C] border border-[#232A3D] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm transition-colors font-mono"
                  placeholder="analyst@firm.com"
                  required
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pl-10 pr-10 rounded-xl bg-[#161B2C] border border-[#232A3D] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm transition-colors font-mono"
                  placeholder="••••••••••••"
                  required
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isLogin && (
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded bg-[#161B2C] border-[#232A3D] text-blue-600 focus:ring-0"
                  />
                  <span>Remember this device</span>
                </label>

                <a href="#forgot" className="text-blue-400 hover:underline font-semibold">
                  Forgot Password?
                </a>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-blue-500/25 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {isLogin ? 'Sign In to Terminal' : 'Create Account'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#232A3D]" />
            </div>
            <span className="relative bg-[#0A0E17] px-3 text-xs text-slate-500 uppercase tracking-widest font-mono">
              or continue with
            </span>
          </div>

          {/* OAuth Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onNavigate('/dashboard')}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#161B2C] border border-[#232A3D] hover:border-slate-600 text-xs font-semibold text-slate-200 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Google
            </button>

            <button
              onClick={() => onNavigate('/dashboard')}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#161B2C] border border-[#232A3D] hover:border-slate-600 text-xs font-semibold text-slate-200 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
              Microsoft
            </button>
          </div>

          <p className="mt-8 text-center text-xs text-slate-400">
            {isLogin ? (
              <>
                Don't have an enterprise account?{' '}
                <button
                  onClick={() => onNavigate('/signup')}
                  className="text-blue-400 hover:underline font-bold"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already registered?{' '}
                <button
                  onClick={() => onNavigate('/login')}
                  className="text-blue-400 hover:underline font-bold"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>

        <div className="text-xs text-slate-500 text-center font-mono">
          SECURE 256-BIT ENCRYPTED PLATFORM AUTHENTICATION
        </div>
      </div>

      {/* Right Graphic Preview Area */}
      <div className="hidden lg:flex w-1/2 bg-[#0F1420] p-12 relative flex-col justify-between overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-600/20 to-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="z-10 flex items-center justify-between text-xs font-mono text-slate-400 border-b border-[#232A3D] pb-4">
          <span>BLACK SWAN THREAT NETWORK</span>
          <span className="text-emerald-400">STATUS: ONLINE</span>
        </div>

        {/* Interactive Globe Graphic */}
        <div className="z-10 my-auto text-center relative">
          <div className="w-72 h-72 mx-auto rounded-full border border-blue-500/20 flex items-center justify-center relative animate-pulse">
            <div className="w-56 h-56 rounded-full border border-purple-500/30 flex items-center justify-center">
              <div className="w-40 h-40 rounded-full border border-pink-500/30 flex items-center justify-center">
                <Globe2 className="w-20 h-20 text-blue-400/80" />
              </div>
            </div>
          </div>

          <h3 className="text-xl font-bold text-white mt-8">Real-Time Risk Scoring Engine</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2">
            Continuous scanning of global maritime corridors, raw material embargoes, and corporate earnings tail risk.
          </p>
        </div>

        <div className="z-10 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span>ISO 27001 COMPLIANT</span>
          <span>ENTERPRISE GATEWAY</span>
        </div>
      </div>
    </div>
  );
};
