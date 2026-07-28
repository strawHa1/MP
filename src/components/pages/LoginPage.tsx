import React, { useState } from 'react';

const CORRECT_PASSWORD = '1234';

interface LoginPageProps {
  onLogin: (username: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    if (password !== CORRECT_PASSWORD) {
      setError('wrong password');
      return;
    }

    setError('');
    onLogin(username.trim());
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-black text-lg">
              ∆
            </div>
            <span className="font-extrabold tracking-wider text-sm font-mono text-white">BLACK SWAN</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Sign In</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#0F1420] border border-[#232A3D] rounded-2xl p-6 space-y-4 shadow-xl">
          <div>
            <label htmlFor="username" className="block text-xs font-medium text-slate-400 mb-1.5">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              className="w-full px-3 py-2.5 rounded-lg bg-[#161B2C] border border-[#232A3D] text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="Enter username"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-slate-400 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              className={`w-full px-3 py-2.5 rounded-lg bg-[#161B2C] border text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 ${
                error ? 'border-red-500' : 'border-[#232A3D]'
              }`}
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
            {error && (
              <p className="text-red-400 text-xs mt-1.5">{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};
