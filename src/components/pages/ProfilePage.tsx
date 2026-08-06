import React from 'react';
import {
  User,
  Shield,
  Briefcase,
  Key,
  Globe2,
  CheckCircle2,
  Settings,
  LogOut
} from 'lucide-react';

interface ProfilePageProps {
  onNavigate: (path: string) => void;
  onLogout?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigate, onLogout }) => {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto font-sans">
      {/* Profile Header */}
      <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-600 p-1 shadow-lg shrink-0">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256"
            alt="John Doe"
            className="w-full h-full rounded-xl object-cover"
          />
        </div>

        <div className="space-y-1 text-center sm:text-left flex-1">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <h1 className="text-2xl font-extrabold text-white">John Doe</h1>
            <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded font-mono font-bold">
              PREMIUM PLAN
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono">Senior Risk Analyst • Black Swan Capital LP</p>
          <p className="text-xs text-slate-500 font-mono">j.doe@blackswan-intel.com</p>
        </div>

        <button
          onClick={() => onNavigate('/settings')}
          className="px-4 py-2 rounded-xl bg-[#161B2C] border border-[#232A3D] text-slate-200 text-xs font-bold hover:border-slate-500 transition-all flex items-center gap-2"
        >
          <Settings className="w-4 h-4" /> Edit Profile
        </button>
      </div>

      {/* Account Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" /> Subscription & Limits
          </h3>
          <div className="space-y-2 text-xs text-slate-300 font-mono">
            <div className="flex justify-between py-1 border-b border-[#232A3D]">
              <span className="text-slate-500">Plan:</span>
              <span className="text-purple-400 font-bold">Enterprise Intelligence</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#232A3D]">
              <span className="text-slate-500">AI Reports / Mo:</span>
              <span className="text-emerald-400 font-bold">Unlimited</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#232A3D]">
              <span className="text-slate-500">Real-Time Feeds:</span>
              <span className="text-slate-200">Enabled</span>
            </div>
          </div>
        </div>

        <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Key className="w-4 h-4 text-purple-400" /> Security & API Access
          </h3>
          <div className="space-y-2 text-xs text-slate-300 font-mono">
            <div className="flex justify-between py-1 border-b border-[#232A3D]">
              <span className="text-slate-500">2-Factor Auth:</span>
              <span className="text-emerald-400 font-bold">Enforced (YubiKey)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#232A3D]">
              <span className="text-slate-500">API Key:</span>
              <span className="text-slate-200">bs_live_••••••••39A</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
