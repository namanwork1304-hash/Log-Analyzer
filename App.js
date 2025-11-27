import React, { useState, useRef, useEffect } from 'react';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie 
} from 'recharts';
import { 
  Activity, AlertTriangle, CheckCircle, Cpu, Server, Upload, Zap, FileText, Terminal, Play, Shield, 
  ArrowRight, Menu, X, Home, BookOpen, Download, Database, Layers, Search, AlertOctagon, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility for Tailwind ---
function cn(...inputs) {
  return twMerge(clsx(...inputs));
}

// --- Mock Data Generator (For Demo Mode) ---
const generateMockData = () => {
  const points = 24;
  const cpuSeries = Array.from({ length: points }, (_, i) => 20 + Math.floor(Math.random() * 40) + (i > 18 ? 30 : 0)); 
  const latSeries = cpuSeries.map(c => c * 8 + Math.floor(Math.random() * 200)); 
  const memSeries = Array.from({ length: points }, () => 400 + Math.floor(Math.random() * 200));

  // Add a specific spike event
  cpuSeries[20] = 98;
  latSeries[20] = 3200;

  return {
    files: [
      { filename: 'application.log', type: 'log', bytes: 10240 },
      { filename: 'metrics.csv', type: 'csv', rows: 450 }
    ],
    pre_analysis: {
      health_score: 42,
      log_levels: { INFO: 2450, WARN: 340, ERROR: 85, CRITICAL: 12 },
      components: ['PaymentGateway', 'UserAuth', 'InventoryDB', 'FrontendLB'],
      metrics_summary: {
        cpu_series: cpuSeries,
        memory_series: memSeries,
        latency_series: latSeries,
        max_cpu: 98,
        max_latency: 3200,
        avg_cpu: 45
      },
      anomalies: [
        "Critical CPU Spike detected: 98% at 14:20:05",
        "High Latency detected: 3200ms in PaymentGateway",
        "Memory Leak suspected in InventoryDB service"
      ],
      correlations: ["Strong correlation: Database Errors (Deadlocks) are perfectly aligned with Latency spikes."]
    },
    llm_analysis: {
      summary: "The system is exhibiting classic signs of 'Cascading Failure' triggered by database contention. High concurrency on the inventory table is causing row-locking, backing up the connection pool, and spiking API latency.",
      bottlenecks: [
        {
          title: "Database Row-Lock Contention",
          severity: "Critical",
          description: "Exclusive row locks on the 'inventory_items' table are holding connections open for >2s.",
          root_cause: "Missing index on 'sku_id' combined with long-running transactions in the update loop.",
          recommendation: "1. Add index: CREATE INDEX idx_sku ON inventory_items(sku_id);\n2. Refactor update loop to batch commits.",
          affected_component: "InventoryDB"
        },
        {
          title: "Connection Pool Exhaustion",
          severity: "High",
          description: "Application is maxing out the pool size of 50 connections during peak load.",
          root_cause: "Connections are not being returned to the pool due to unhandled exceptions in the payment retry logic.",
          recommendation: "Implement a 'finally' block in the PaymentService to ensure connection closure. Increase pool size to 100 temporarily.",
          affected_component: "Infrastructure"
        },
        {
          title: "N+1 Query Problem",
          severity: "Medium",
          description: "Fetching user history triggers 1 query for user and N queries for orders.",
          root_cause: "ORM lazy loading enabled on the 'orders' relationship.",
          recommendation: "Use eager loading (e.g., .include('orders')) in the UserAuth service repository.",
          affected_component: "UserAuth"
        }
      ]
    }
  };
};

// --- Reusable UI Components ---

const Card = ({ children, className, onClick }) => (
  <div 
    onClick={onClick}
    className={cn(
      "bg-slate-900 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm transition-all", 
      onClick ? "cursor-pointer hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-900/10" : "",
      className
    )}
  >
    {children}
  </div>
);

const Badge = ({ severity, className }) => {
  const colors = {
    Critical: "bg-red-500/10 text-red-400 border-red-500/20",
    High: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    Medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    Low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Info: "bg-slate-700 text-slate-300 border-slate-600"
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-medium border", colors[severity] || colors.Info, className)}>
      {severity}
    </span>
  );
};

const Button = ({ children, onClick, variant = 'primary', className, disabled, icon: Icon }) => {
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",
    danger: "bg-red-600 hover:bg-red-500 text-white",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white"
  };
  
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

// --- View Components ---

// 1. Sidebar Component
const Sidebar = ({ activePage, setActivePage, isMobileOpen, setIsMobileOpen, status }) => {
  const menuItems = [
    { id: 'upload', label: 'Upload & Analyze', icon: Upload },
    { id: 'pre-analysis', label: 'Pre-Analysis', icon: Activity, disabled: status === 'idle' },
    { id: 'llm-analysis', label: 'LLM Insights', icon: Zap, disabled: status === 'idle' },
    { id: 'manual', label: 'User Manual', icon: BookOpen },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setIsMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static top-0 left-0 z-50 h-full w-64 bg-slate-950 border-r border-slate-800 flex flex-col transition-transform duration-300 transform",
        isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-900/50">
              <Shield className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight leading-tight">Performance <br/><span className="text-blue-500">Bottleneck Analyzer</span></h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Perf. Engine</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if(!item.disabled) {
                  setActivePage(item.id);
                  setIsMobileOpen(false);
                }
              }}
              disabled={item.disabled}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                activePage === item.id 
                  ? "bg-blue-600/10 text-blue-400 border border-blue-600/20" 
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200",
                item.disabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
              )}
            >
              <item.icon size={18} />
              {item.label}
              {item.disabled && <span className="ml-auto text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">LOCKED</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-900 rounded-lg p-3 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-medium">SYSTEM STATUS</span>
              <span className={cn("h-2 w-2 rounded-full shadow-[0_0_8px]", status === 'analyzing' ? "bg-yellow-500 shadow-yellow-500/50 animate-pulse" : status === 'ready' ? "bg-emerald-500 shadow-emerald-500/50" : "bg-slate-600")} />
            </div>
            <p className="text-xs text-slate-300">
              {status === 'idle' && "Waiting for Data"}
              {status === 'analyzing' && "Processing Logs..."}
              {status === 'ready' && "Analysis Complete"}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

// 2. Page 1: Upload & Analyze
const UploadView = ({ onAnalyze, isLoading }) => {
  const [mode, setMode] = useState('paste'); // paste | upload
  const [text, setText] = useState('');
  const fileInputRef = useRef(null);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pt-8">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-white mb-2">Ingest Telemetry Data</h2>
        <p className="text-slate-400">Upload raw logs, metrics CSVs, or JSON payloads for instant diagnostic analysis.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <button 
          onClick={() => setMode('paste')}
          className={cn("p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2", mode === 'paste' ? "border-blue-500 bg-blue-500/5 text-blue-400" : "border-slate-800 bg-slate-900 text-slate-500 hover:border-slate-700")}
        >
          <Terminal size={24} />
          <span className="font-medium">Raw Text / Paste</span>
        </button>
        <button 
          onClick={() => setMode('upload')}
          className={cn("p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2", mode === 'upload' ? "border-blue-500 bg-blue-500/5 text-blue-400" : "border-slate-800 bg-slate-900 text-slate-500 hover:border-slate-700")}
        >
          <Upload size={24} />
          <span className="font-medium">File Upload</span>
        </button>
      </div>

      <Card className="p-1 min-h-[300px]">
        {mode === 'paste' ? (
          <textarea 
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-[300px] bg-slate-950 p-4 text-xs font-mono text-slate-300 focus:outline-none resize-none placeholder:text-slate-700"
            placeholder="Paste your server logs, stack traces, or metric dumps here..."
          />
        ) : (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="h-[300px] border-2 border-dashed border-slate-800 rounded-lg bg-slate-950/50 flex flex-col items-center justify-center cursor-pointer hover:border-slate-600 hover:bg-slate-900 transition-all group"
          >
            <input type="file" multiple className="hidden" ref={fileInputRef} onChange={(e) => onAnalyze(null, e.target.files)} />
            <div className="p-4 bg-slate-900 rounded-full mb-4 group-hover:scale-110 transition-transform">
              <Upload className="text-blue-500" size={32} />
            </div>
            <p className="text-slate-300 font-medium">Click or Drag files to upload</p>
            <p className="text-slate-500 text-sm mt-2">Supports .log, .txt, .json, .csv</p>
          </div>
        )}
      </Card>

      <div className="flex gap-4">
        <Button 
          variant="primary" 
          className="flex-1 py-4 text-lg" 
          disabled={isLoading || (mode === 'paste' && !text)}
          onClick={() => onAnalyze(text)}
          icon={isLoading ? ArrowRight : Zap}
        >
          {isLoading ? 'Analyzing Neural Patterns...' : 'Start Analysis'}
        </Button>
        <Button variant="secondary" onClick={() => onAnalyze(null, null, true)} className="px-6" icon={Play}>
          Load Demo
        </Button>
      </div>
    </div>
  );
};

// 3. Page 2: Pre-Analysis (Sensing Layer)
const PreAnalysisView = ({ data }) => {
  if (!data) return null;
  const { pre_analysis } = data;

  const chartData = pre_analysis.metrics_summary.cpu_series.map((cpu, i) => ({
    time: i,
    cpu: cpu,
    latency: pre_analysis.metrics_summary.latency_series[i] || 0
  }));

  const handleExportJSON = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      pre_analysis: pre_analysis
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pre-analysis-${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Sensing Layer Analysis</h2>
          <p className="text-slate-400 text-sm">Raw metrics extraction, anomaly detection, and correlation mapping.</p>
        </div>
        <Button variant="secondary" icon={Download} className="text-xs" onClick={handleExportJSON}>Export JSON</Button>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold">System Health</p>
              <h3 className={cn("text-3xl font-bold mt-1", pre_analysis.health_score > 70 ? "text-emerald-400" : pre_analysis.health_score > 40 ? "text-orange-400" : "text-red-400")}>
                {pre_analysis.health_score}/100
              </h3>
            </div>
            <Activity className="text-slate-600" />
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-400 uppercase font-semibold">Max Latency</p>
          <h3 className="text-2xl font-bold text-white mt-1">{pre_analysis.metrics_summary.max_latency}ms</h3>
          <span className="text-xs text-red-400">+120% vs avg</span>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-400 uppercase font-semibold">Anomalies</p>
          <h3 className="text-2xl font-bold text-white mt-1">{pre_analysis.anomalies.length}</h3>
          <span className="text-xs text-orange-400">Requires Attention</span>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-400 uppercase font-semibold">Logs Parsed</p>
          <h3 className="text-2xl font-bold text-white mt-1">2,887</h3>
          <span className="text-xs text-blue-400">100% Processed</span>
        </Card>
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers size={18} className="text-blue-500" />
              Metric Correlation (CPU vs Latency)
            </h3>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> CPU %</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Latency</span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorLat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis yAxisId="left" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }} />
                <Area yAxisId="left" type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
                <Area yAxisId="right" type="monotone" dataKey="latency" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorLat)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Anomalies List */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertOctagon size={18} className="text-red-500" />
            Detected Anomalies
          </h3>
          <div className="space-y-3 overflow-y-auto max-h-72 pr-2 custom-scrollbar">
            {pre_analysis.anomalies.map((anomaly, idx) => (
              <div key={idx} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex gap-3">
                   <AlertTriangle className="text-red-400 shrink-0 mt-1" size={16} />
                   <p className="text-xs text-red-200 leading-relaxed">{anomaly}</p>
                </div>
              </div>
            ))}
            {pre_analysis.correlations.map((corr, idx) => (
               <div key={`c-${idx}`} className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <div className="flex gap-3">
                   <Zap className="text-purple-400 shrink-0 mt-1" size={16} />
                   <p className="text-xs text-purple-200 leading-relaxed">{corr}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

// 4. Page 3: LLM Analysis (Reasoning Layer)
const LLMAnalysisView = ({ data }) => {
  if (!data) return null;
  const { llm_analysis } = data;

  const handleExportReport = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: llm_analysis.summary,
      bottlenecks: llm_analysis.bottlenecks
    };
    
    // Generate HTML report
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Performance Bottleneck Analysis Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
          .container { max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; }
          h2 { color: #1e3a8a; margin-top: 30px; }
          .summary { background: #eff6ff; padding: 20px; border-left: 4px solid #0284c7; margin: 20px 0; border-radius: 4px; }
          .bottleneck { background: #f8fafc; padding: 20px; margin: 15px 0; border: 1px solid #e2e8f0; border-radius: 4px; }
          .severity { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; margin-bottom: 10px; }
          .severity.critical { background: #fee2e2; color: #991b1b; }
          .severity.high { background: #fed7aa; color: #92400e; }
          .severity.medium { background: #fef08a; color: #78350f; }
          .severity.low { background: #dbeafe; color: #1e3a8a; }
          .root-cause { background: #f3f4f6; padding: 10px; margin: 10px 0; border-radius: 4px; font-style: italic; }
          .recommendation { background: #ecfdf5; padding: 10px; margin: 10px 0; border-radius: 4px; color: #065f46; font-family: monospace; white-space: pre-wrap; }
          .timestamp { color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Performance Bottleneck Analysis Report</h1>
          <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
          
          <h2>Executive Summary</h2>
          <div class="summary">${llm_analysis.summary}</div>
          
          <h2>Identified Bottlenecks</h2>
          ${llm_analysis.bottlenecks.map((item, idx) => `
            <div class="bottleneck">
              <h3>${idx + 1}. ${item.title}</h3>
              <span class="severity ${item.severity.toLowerCase()}">${item.severity}</span>
              <p><strong>Description:</strong> ${item.description}</p>
              <div class="root-cause"><strong>Root Cause:</strong> ${item.root_cause}</div>
              <div class="recommendation"><strong>Recommendation:</strong> ${item.recommendation}</div>
              <p><strong>Affected Component:</strong> ${item.affected_component}</p>
            </div>
          `).join('')}
          
          <hr style="margin: 40px 0; border: none; border-top: 1px solid #e2e8f0;">
          <p class="timestamp">This report was automatically generated by the Performance Bottleneck Analyzer.</p>
        </div>
      </body>
      </html>
    `;
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${new Date().getTime()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white">Reasoning Layer Insights</h2>
          <p className="text-slate-400 text-sm">GPT-4o powered root cause analysis and mitigation strategies.</p>
        </div>
        <Button variant="secondary" icon={Download} className="text-xs" onClick={handleExportReport}>Export Report</Button>
      </div>

      {/* Executive Summary */}
      <Card className="p-8 border-l-4 border-l-blue-500 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Zap size={120} className="text-blue-500" />
        </div>
        <h3 className="text-xl font-bold text-white mb-4">Executive Summary</h3>
        <p className="text-slate-300 leading-relaxed text-lg max-w-4xl relative z-10">
          {llm_analysis.summary}
        </p>
      </Card>

      {/* Bottlenecks Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Search size={18} className="text-emerald-500" />
          Identified Bottlenecks & Fixes
        </h3>
        
        {llm_analysis.bottlenecks.map((item, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="p-0 group">
              <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900/50">
                <div className="flex items-start gap-4">
                   <div className="mt-1 p-2 bg-slate-800 rounded-lg text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                     <Database size={20} />
                   </div>
                   <div>
                     <h4 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">{item.title}</h4>
                     <p className="text-slate-400 text-sm mt-1">{item.description}</p>
                   </div>
                </div>
                <Badge severity={item.severity} className="text-sm px-3 py-1" />
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/30">
                <div>
                   <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Root Cause Analysis</span>
                   <div className="text-sm text-slate-300 bg-slate-900 p-3 rounded border border-slate-800">
                      {item.root_cause}
                   </div>
                </div>
                <div>
                   <span className="text-xs font-bold text-emerald-500/70 uppercase tracking-wider mb-2 block">Recommended Fix</span>
                   <div className="text-sm text-emerald-100 bg-emerald-900/10 p-3 rounded border border-emerald-900/20 font-mono">
                      {item.recommendation}
                   </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// 5. Page 4: User Manual
const UserManualView = () => (
  <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in">
    <div className="text-center mb-10">
      <h2 className="text-3xl font-bold text-white mb-2">Performance Bottleneck Analyzer User Manual</h2>
      <p className="text-slate-400">Documentation for the Autonomous Performance Engineer system.</p>
    </div>

    <div className="space-y-6">
      <section>
        <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-xs">1</div>
          Data Ingestion
        </h3>
        <Card className="p-6 text-slate-300 leading-relaxed">
          <p>Sentinel accepts <b>.log</b>, <b>.txt</b>, <b>.json</b>, and <b>.csv</b> formats.</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
            <li>For CSV files, ensure headers include 'timestamp' and metric names (cpu, memory).</li>
            <li>For JSON, standard structured logging formats (ECS, GELF) are auto-detected.</li>
            <li>Use the "Demo Mode" to explore features without uploading real data.</li>
          </ul>
        </Card>
      </section>

      <section>
        <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-xs">2</div>
          Interpreting Pre-Analysis
        </h3>
        <Card className="p-6 text-slate-300 leading-relaxed">
          <p>The "Sensing Layer" (Python) performs deterministic analysis before AI reasoning.</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
            <li><b>Health Score:</b> Calculated based on error rates and anomaly frequency (0-100).</li>
            <li><b>Correlation Graph:</b> Overlays CPU/Memory usage with Application Latency to find "Smoke and Fire" patterns.</li>
            <li><b>Anomalies:</b> Statistical outliers detected using standard deviation thresholds ({'>'}2 sigma).</li>
          </ul>
        </Card>
      </section>

      <section>
        <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-xs">3</div>
          LLM Reasoning Insights
        </h3>
        <Card className="p-6 text-slate-300 leading-relaxed">
          <p>The "Reasoning Layer" (GPT-4o) contextualizes the raw metrics.</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
            <li>Look for <b>Critical</b> severity items first—these cause immediate downtime.</li>
            <li>The <b>Recommendations</b> provided are often copy-paste SQL commands or code snippets.</li>
            <li>Use the Export button to generate a PDF report for stakeholders.</li>
          </ul>
        </Card>
      </section>
    </div>
  </div>
);

// --- Main App Orchestrator ---

export default function App() {
  const [activePage, setActivePage] = useState('upload');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | analyzing | ready
  const [error, setError] = useState(null);

  const handleAnalyze = async (text, files, isDemo = false) => {
    setStatus('analyzing');
    setError(null);

    if (isDemo) {
      setTimeout(() => {
        setData(generateMockData());
        setStatus('ready');
        setActivePage('pre-analysis');
      }, 2500);
      return;
    }

    try {
      let response;
      if (files) {
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) formData.append('files', files[i]);
        response = await fetch('http://localhost:5000/api/analyze-multi', { method: 'POST', body: formData });
      } else {
        response = await fetch('http://localhost:5000/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logs: text })
        });
      }

      if (!response.ok) throw new Error("Analysis failed");
      const result = await response.json();
      setData(result);
      setStatus('ready');
      setActivePage('pre-analysis');
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex overflow-hidden selection:bg-blue-500/30">
      
      {/* Sidebar Navigation */}
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        isMobileOpen={isMobileOpen} 
        setIsMobileOpen={setIsMobileOpen}
        status={status}
      />

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-y-auto relative">
        
        {/* Mobile Header */}
        <div className="lg:hidden p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 sticky top-0 z-30">
          <div className="flex items-center gap-2">
             <Shield className="text-blue-500" size={20} />
             <span className="font-bold text-white">Performance Bottleneck Analyzer</span>
          </div>
          <button onClick={() => setIsMobileOpen(true)} className="p-2 text-slate-400">
            <Menu size={24} />
          </button>
        </div>

        {/* Content Container */}
        <div className="p-6 lg:p-10 max-w-7xl mx-auto pb-20">
          
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-3 text-red-200 animate-pulse">
              <AlertTriangle size={20} />
              {error}
              <button className="ml-auto underline" onClick={() => handleAnalyze(null, null, true)}>Try Demo Mode?</button>
            </div>
          )}

          {activePage === 'upload' && <UploadView onAnalyze={handleAnalyze} isLoading={status === 'analyzing'} />}
          {activePage === 'pre-analysis' && <PreAnalysisView data={data} />}
          {activePage === 'llm-analysis' && <LLMAnalysisView data={data} />}
          {activePage === 'manual' && <UserManualView />}

        </div>
      </main>
    </div>
  );
}