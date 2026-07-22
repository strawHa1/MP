import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Globe2,
  Calendar,
  User,
  Zap,
  Tag,
  CheckCircle2,
  X
} from 'lucide-react';
import { ReportItem } from '../../types';
import { INITIAL_REPORTS } from '../../data/mockData';
import { SeverityBadge } from '../common/SeverityBadge';
import { PDFReportExporter } from '../common/PDFReportExporter';

interface ReportsPageProps {
  onNavigate: (path: string) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ onNavigate }) => {
  const [reports, setReports] = useState<ReportItem[]>(INITIAL_REPORTS);
  const [selectedReportId, setSelectedReportId] = useState<string>(INITIAL_REPORTS[0].id);

  // Custom AI Report Generator Modal State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [topicInput, setTopicInput] = useState('Taiwan Semiconductor Shipping Lead Times');
  const [focusAreaInput, setFocusAreaInput] = useState('Asia-Pacific Maritime Logistics');
  const [generating, setGenerating] = useState(false);

  const selectedReport =
    reports.find((r) => r.id === selectedReportId) || reports[0];

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicInput, focusArea: focusAreaInput })
      });

      if (response.ok) {
        const newReport: ReportItem = await response.json();
        setReports([newReport, ...reports]);
        setSelectedReportId(newReport.id);
        setShowGenerateModal(false);
      }
    } catch (err) {
      console.error('Failed to generate AI report:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-purple-400 font-bold uppercase tracking-wider">
            <FileSpreadsheet className="w-4 h-4" />
            AI-Generated Financial Threat Intelligence Reports
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">AI Reports Studio</h1>
          <p className="text-slate-400 text-xs mt-0.5">Automated synthesis, PDF exporter, and quantitative tail-risk briefs</p>
        </div>

        <button
          onClick={() => setShowGenerateModal(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2 w-fit"
        >
          <Plus className="w-4 h-4" />
          Generate New AI Report
        </button>
      </div>

      {/* Main Split Layout: Report List Left, Detail Panel Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Reports List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Available Reports Archive</h3>

          {reports.map((rep) => (
            <div
              key={rep.id}
              onClick={() => setSelectedReportId(rep.id)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                selectedReportId === rep.id
                  ? 'bg-[#161B2C] border-purple-500 shadow-xl'
                  : 'bg-[#0F1420] border-[#232A3D] hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <SeverityBadge severity={rep.severityTag} size="sm" />
                <span className="text-[10px] text-slate-400 font-mono">{rep.createdAt}</span>
              </div>
              <h4 className="text-xs font-bold text-slate-100 line-clamp-2">{rep.title}</h4>
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{rep.summary}</p>
            </div>
          ))}
        </div>

        {/* Right Selected Report Detail Panel */}
        <div className="lg:col-span-2 bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#232A3D]">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={selectedReport.severityTag} size="md" />
                <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Published {selectedReport.createdAt}
                </span>
              </div>

              <h2 className="text-2xl font-extrabold text-white tracking-tight">{selectedReport.title}</h2>
              <div className="text-xs text-slate-400 font-mono flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-purple-400" /> Author: {selectedReport.author}
              </div>
            </div>

            {/* PDF Exporter Button Component */}
            <PDFReportExporter report={selectedReport} />
          </div>

          {/* Executive Summary Box */}
          <div className="p-4 rounded-xl bg-[#161B2C] border border-[#232A3D] space-y-1">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider font-mono">Executive Summary</span>
            <p className="text-xs text-slate-300 leading-relaxed">{selectedReport.summary}</p>
          </div>

          {/* Report Content Sections */}
          <div className="space-y-6">
            {selectedReport.sections.map((sec, idx) => (
              <div key={idx} className="space-y-2">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider border-b border-[#232A3D] pb-1.5">
                  {sec.heading}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line font-sans">
                  {sec.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Generate Custom Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1420] border border-[#232A3D] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowGenerateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Generate AI Financial Intelligence Brief</h3>
                <p className="text-xs text-slate-400">Specify report topic and focus area for automated synthesis</p>
              </div>
            </div>

            <form onSubmit={handleGenerateReport} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">Report Topic</label>
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  className="w-full bg-[#161B2C] border border-[#232A3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">Focus Area / Sector</label>
                <input
                  type="text"
                  value={focusAreaInput}
                  onChange={(e) => setFocusAreaInput(e.target.value)}
                  className="w-full bg-[#161B2C] border border-[#232A3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#161B2C] text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold shadow-lg"
                >
                  {generating ? 'Synthesizing Intelligence...' : 'Generate Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
