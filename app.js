import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, Upload, BarChart2, Zap, BookOpen, 
  ChevronRight, ChevronDown, CheckCircle, AlertTriangle, 
  X, FileText, Code, Server, BrainCircuit, Target, 
  ArrowLeft, ArrowRight, Download, Menu, HelpCircle, Layers, AlertCircle
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, 
  CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

// --- MOCK DATA GENERATOR ---
const generateSyntheticLogs = () => {
  const timestamp = new Date();
  let logs = [];
  const baseTime = timestamp.getTime();

  logs.push(`[${new Date(baseTime).toISOString()}] [INFO] Application startup complete on port 8080.`);
  
  for(let i=0; i<20; i++) {
    const t = new Date(baseTime + (i * 1000)).toISOString();
    const cpu = 10 + (i * 4) + Math.floor(Math.random() * 5); // Rising CPU
    const mem = 400 + (i * 20);
    
    logs.push(`[${t}] [METRICS] CPU: ${cpu}% | MEM: ${mem}MB | DB_CONN: ${5 + i}`);
    
    if (i > 8 && i < 12) {
      logs.push(`[${t}] [WARN] Query execution time: ${400 + (i*10)}ms (Threshold: 200ms)`);
    }
    if (i > 15) {
      logs.push(`[${t}] [ERROR] ConnectionTimeoutException: Database pool exhausted. Active connections: 50/50.`);
    }
  }
  logs.push(`[${new Date(baseTime + 21000).toISOString()}] [CRITICAL] Garbage Collection (Stop-the-world) triggered. Duration: 1200ms.`);
  
  return logs.join('\n');
};

// --- MAIN APP COMPONENT ---
export default function App() {
  // Global State
  const [currentView, setCurrentView] = useState('upload'); // 'upload' | 'pre-analysis' | 'recommendations' | 'manual'
  const [files, setFiles] = useState([]);
  const [rawText, setRawText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  
  // Analysis Data State
  const [preAnalysis, setPreAnalysis] = useState(null);
  const [llmAnalysis, setLlmAnalysis] = useState(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState(null);

  // --- HANDLERS ---

  const handleFileUpload = (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    setFiles(selected);
    // Preview first file
    const reader = new FileReader();
    reader.onload = (ev) => setRawText(ev.target.result);
    reader.readAsText(selected[0]);
  };

  const loadSyntheticData = () => {
    setRawText(generateSyntheticLogs());
    setError(null);
  };

  const runAnalysis = async () => {
    if (!rawText.trim() && files.length === 0) {
      setError("Please upload logs or generate synthetic data first.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Try to hit local backend
      const response = await fetch('http://localhost:5000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: rawText }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Server Error');

      setPreAnalysis(data.pre_analysis);
      setLlmAnalysis(data.llm_analysis);
      setLastAnalyzedAt(new Date().toISOString());
      setCurrentView('pre-analysis');

    } catch (err) {
      console.error(err);
      // Fallback for Demo purposes if backend is missing
      setError(`Backend Error: ${err.message}. (Ensure server.py is running on port 5000)`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- RENDERER ---
  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        hasAnalysis={!!preAnalysis}
        lastAnalyzedAt={lastAnalyzedAt}
      />
      
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {/* Mobile Header Placeholder (hidden on desktop) */}
        <div className="lg:hidden h-16 bg-slate-950 border-b border-white/5 flex items-center px-4">
           <Activity className="text-indigo-500 w-6 h-6 mr-2" />
           <span className="font-bold">BottleneckAnalyzer</span>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth">
          {currentView === 'upload' && (
            <UploadView 
              rawText={rawText}
              setRawText={setRawText}
              files={files}
              onUpload={handleFileUpload}
              onGenerate={loadSyntheticData}
              onAnalyze={runAnalysis}
              isAnalyzing={isAnalyzing}
              error={error}
            />
          )}
          {currentView === 'pre-analysis' && (
            <PreAnalysisView 
              data={preAnalysis} 
              onNext={() => setCurrentView('recommendations')} 
            />
          )}
          {currentView === 'recommendations' && (
            <RecommendationsView 
              data={llmAnalysis} 
              preData={preAnalysis}
              onBack={() => setCurrentView('pre-analysis')} 
            />
          )}
          {currentView === 'manual' && (
            <UserManualView onStart={() => setCurrentView('upload')} />
          )}
        </div>
      </main>
    </div>
  );
}

// ==========================================
// 1. SIDEBAR COMPONENT
// ==========================================
function Sidebar({ currentView, setCurrentView, hasAnalysis, lastAnalyzedAt }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems = [
    { id: 'upload', label: 'Upload & Analyze', icon: <Upload size={20} />, desc: 'Ingest logs & metrics' },
    { id: 'pre-analysis', label: 'Analysis Results', icon: <BarChart2 size={20} />, desc: 'Metrics & Clusters', disabled: !hasAnalysis },
    { id: 'recommendations', label: 'AI Insights', icon: <Zap size={20} />, desc: 'Root cause & fixes', disabled: !hasAnalysis },
    { id: 'manual', label: 'User Guide', icon: <BookOpen size={20} />, desc: 'Documentation' },
  ];

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-slate-800 rounded-lg border border-slate-700"
      >
        <Menu size={24} />
      </button>

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-72 bg-slate-950 border-r border-white/5 flex flex-col
        transition-transform duration-300 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header */}
        <div className="p-6 flex items-center gap-3 mb-2">
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
            <Activity className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Bottleneck</h1>
            <p className="text-[10px] font-bold text-indigo-400 tracking-widest uppercase">Analyzer Pro</p>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 px-4 space-y-2 py-4">
          <p className="px-4 text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">Platform</p>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { if(!item.disabled) { setCurrentView(item.id); setIsMobileOpen(false); } }}
              disabled={item.disabled}
              className={`
                w-full flex items-center gap-4 p-3 rounded-xl text-left transition-all duration-200 border border-transparent group
                ${currentView === item.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 border-indigo-500/50' 
                  : item.disabled 
                    ? 'opacity-40 cursor-not-allowed text-slate-500' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }
              `}
            >
              <div className={currentView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}>
                {item.icon}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{item.label}</div>
                <div className={`text-[10px] ${currentView === item.id ? 'text-indigo-200' : 'text-slate-600 group-hover:text-slate-400'}`}>
                  {item.desc}
                </div>
              </div>
              {currentView === item.id && <ChevronRight size={16} className="text-indigo-200" />}
            </button>
          ))}
        </div>

        {/* Status Footer */}
        <div className="p-4 m-4 rounded-2xl bg-slate-900 border border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <span className={`relative flex h-2 w-2`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasAnalysis ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${hasAnalysis ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">
              {hasAnalysis ? 'System Ready' : 'Idle'}
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Last Scan</span>
            <span className="font-mono text-slate-400">
              {lastAnalyzedAt ? new Date(lastAnalyzedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}

// ==========================================
// 2. UPLOAD VIEW
// ==========================================
function UploadView({ rawText, setRawText, files, onUpload, onGenerate, onAnalyze, isAnalyzing, error }) {
  const fileInputRef = useRef(null);

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Performance Diagnostics</h1>
        <p className="text-slate-400 text-lg">Ingest server logs, metrics, or debug traces to identify bottlenecks.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 h-[550px]">
        {/* Editor */}
        <div className="lg:col-span-2 flex flex-col space-y-4 h-full">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 flex flex-col flex-1 overflow-hidden shadow-xl">
            <div className="bg-slate-900/50 p-3 border-b border-slate-700 flex justify-between items-center">
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                <FileText size={14} className="text-indigo-400" />
                {files.length > 0 ? `${files.length} Files` : 'Raw Input'}
              </span>
              <button onClick={onGenerate} className="text-xs flex items-center gap-1.5 text-indigo-300 hover:text-indigo-200 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-colors">
                <Code size={14} /> Generate Sample
              </button>
            </div>
            
            <div className="flex-1 relative group">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste logs here..."
                className="w-full h-full bg-slate-900/50 text-xs font-mono text-slate-300 p-6 resize-none focus:outline-none focus:bg-slate-900/80 transition-colors"
              />
              {!rawText && files.length === 0 && (
                <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-[1px] cursor-pointer hover:bg-slate-900/30 transition-colors">
                  <div className="bg-slate-800 p-5 rounded-full mb-4 shadow-xl border border-slate-700 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-indigo-400" />
                  </div>
                  <p className="text-slate-300 font-medium">Click to upload or paste logs</p>
                  <p className="text-slate-500 text-xs mt-2">.log, .txt, .csv, .json</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" multiple onChange={onUpload} className="hidden" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col space-y-6">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-5"><Zap className="w-32 h-32 text-indigo-500" /></div>
            <h3 className="text-lg font-bold text-white mb-4 relative z-10">Start Analysis</h3>
            <p className="text-sm text-slate-400 mb-6 relative z-10">The AI engine will parse data, extract metrics, and identify root causes.</p>
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-3 rounded-lg text-xs flex gap-2 mb-4">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              onClick={onAnalyze}
              disabled={isAnalyzing || (!rawText && files.length === 0)}
              className={`w-full py-4 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all relative z-10 ${isAnalyzing || (!rawText && files.length === 0) ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-indigo-500/25 active:scale-95'}`}
            >
              {isAnalyzing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Zap size={18} /> Run Diagnostics</>}
            </button>
          </div>

          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6 flex-1">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Capabilities</h4>
            <ul className="space-y-4">
              <CapabilityItem icon={<Activity size={16} className="text-emerald-400" />} title="Pattern Clustering" desc="Groups repeated logs." />
              <CapabilityItem icon={<Server size={16} className="text-cyan-400" />} title="Metric Extraction" desc="Parses CPU/Mem from text." />
              <CapabilityItem icon={<AlertTriangle size={16} className="text-amber-400" />} title="Anomaly Detection" desc="Flags outliers." />
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function CapabilityItem({ icon, title, desc }) {
  return (
    <li className="flex gap-3 items-start">
      <div className="mt-1 p-1.5 rounded-lg bg-slate-900 border border-slate-700">{icon}</div>
      <div>
        <p className="text-slate-200 text-sm font-semibold">{title}</p>
        <p className="text-slate-500 text-xs">{desc}</p>
      </div>
    </li>
  );
}

// ==========================================
// 3. PRE-ANALYSIS VIEW
// ==========================================
function PreAnalysisView({ data, onNext }) {
  if (!data) return <div className="p-8 text-center text-slate-500">No Data</div>;

  const metrics = data.metrics_summary || {};
  const anomalies = data.anomalies || [];
  
  // Chart Data Preparation
  const cpuData = metrics.cpu_series ? metrics.cpu_series.map((v, i) => ({ idx: i, value: v })) : [];
  const memData = metrics.memory_series ? metrics.memory_series.map((v, i) => ({ idx: i, value: v })) : [];

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white">Analysis Results</h1>
          <p className="text-slate-400 mt-1">Deterministic insights from {data.parsed_entries} log entries.</p>
        </div>
        <button onClick={onNext} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95">
          View AI Insights <ArrowRight size={18} />
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Avg CPU" value={`${metrics.avg_cpu?.toFixed(1) || 0}%`} color="text-indigo-400" />
        <MetricCard label="Max CPU" value={`${metrics.max_cpu || 0}%`} color={metrics.max_cpu > 80 ? 'text-red-400' : 'text-emerald-400'} />
        <MetricCard label="Avg Mem" value={`${metrics.avg_memory?.toFixed(0) || 0}MB`} color="text-purple-400" />
        <MetricCard label="Max Latency" value={`${metrics.max_latency || 0}ms`} color={metrics.max_latency > 1000 ? 'text-amber-400' : 'text-slate-200'} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="CPU Usage Trend">
          {cpuData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={cpuData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{background:'#1e293b', border:'none', color:'#fff'}} />
                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="h-full flex items-center justify-center text-slate-500 text-xs">No CPU Data</div>}
        </ChartCard>

        <ChartCard title="Memory Usage Trend">
          {memData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={memData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{background:'#1e293b', border:'none', color:'#fff'}} />
                <Line type="monotone" dataKey="value" stroke="#d946ef" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="h-full flex items-center justify-center text-slate-500 text-xs">No Memory Data</div>}
        </ChartCard>
      </div>

      {/* Anomalies */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50 flex items-center gap-2">
          <AlertCircle size={18} className="text-red-400" />
          <h3 className="font-bold text-white">Detected Anomalies ({anomalies.length})</h3>
        </div>
        <div className="p-6 space-y-3">
          {anomalies.length > 0 ? anomalies.map((anom, idx) => (
            <div key={idx} className="bg-slate-900/50 border border-red-500/20 p-4 rounded-lg flex gap-4 items-start">
              <div className="bg-red-500/10 p-2 rounded shrink-0 text-red-400"><AlertTriangle size={16} /></div>
              <div>
                <h4 className="text-sm font-bold text-red-200">Statistical Anomaly</h4>
                <p className="text-sm text-slate-400 mt-1">{typeof anom === 'string' ? anom : anom.description}</p>
              </div>
            </div>
          )) : (
            <p className="text-slate-500 italic text-center">No anomalies detected.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-3xl font-mono font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 h-[300px] flex flex-col">
      <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">{title}</h4>
      <div className="flex-1 w-full">{children}</div>
    </div>
  );
}

// ==========================================
// 4. RECOMMENDATIONS VIEW
// ==========================================
function RecommendationsView({ data, preData, onBack }) {
  if (!data) return <div className="p-8 text-center text-slate-500">Analysis Pending...</div>;

  const score = data.overall_health_score || 0;
  const healthColor = score > 80 ? 'text-emerald-400' : score > 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-start justify-between">
        <div>
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white mb-2 text-sm transition-colors"><ArrowLeft size={14}/> Back to Metrics</button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white">AI Diagnostic Report</h1>
            <span className="bg-indigo-500/10 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-500/20 uppercase">GPT-4o Mini</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Health Score</p>
          <p className={`text-5xl font-black ${healthColor}`}>{score}%</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Executive Summary</h3>
        <p className="text-slate-200 leading-relaxed text-lg">{data.summary || data.executive_summary}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <div className="flex items-center gap-2 mb-4 text-indigo-400">
              <BrainCircuit size={20} />
              <h3 className="font-bold uppercase text-xs tracking-widest">Root Cause Analysis</h3>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">{data.root_cause}</p>
            {data.affected_component && (
              <div className="bg-slate-900 rounded border border-slate-700 p-3 flex items-center gap-3">
                <Target size={16} className="text-red-400"/>
                <span className="text-xs text-slate-400 uppercase font-bold">Affected Component:</span>
                <span className="text-white font-mono text-sm">{data.affected_component}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-4 text-emerald-400">
            <CheckCircle size={20} />
            <h3 className="font-bold uppercase text-xs tracking-widest">Remediation Plan</h3>
          </div>
          <div className="space-y-4">
            <RecommendationItem label="Immediate" color="red" items={data.immediate_actions || data.immediate_recommendations} />
            <RecommendationItem label="Short Term" color="amber" items={data.short_term_fixes || data.short_term_recommendations} />
          </div>
        </div>
      </div>
    </div>
  );
}

function RecommendationItem({ label, color, items }) {
  const colors = { red: 'text-red-400 border-red-500/20 bg-red-500/5', amber: 'text-amber-400 border-amber-500/20 bg-amber-500/5' };
  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <h4 className={`font-bold text-xs uppercase mb-2 opacity-80`}>{label} Actions</h4>
      <ul className="space-y-2">
        {Array.isArray(items) && items.map((it, i) => (
          <li key={i} className="text-sm flex gap-2"><span className="opacity-50">•</span> {it}</li>
        ))}
      </ul>
    </div>
  );
}

// ==========================================
// 5. USER MANUAL VIEW
// ==========================================
function UserManualView({ onStart }) {
  return (
    <div className="max-w-4xl mx-auto space-y-12 py-8 animate-in fade-in duration-500">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-black text-white">System Documentation</h1>
        <p className="text-slate-400 text-lg">Master the workflow in 3 simple steps.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <ManualStep step="01" title="Ingest" icon={<Upload className="text-indigo-400"/>} desc="Upload logs (txt, log) or metrics (csv, json)." />
        <ManualStep step="02" title="Analyze" icon={<BarChart2 className="text-cyan-400"/>} desc="Python engine extracts metrics deterministically." />
        <ManualStep step="03" title="Solve" icon={<Zap className="text-amber-400"/>} desc="AI synthesizes data to predict fixes." />
      </div>

      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><HelpCircle size={20} /> Troubleshooting</h2>
          <div className="grid gap-4">
            <FAQItem q="Backend Error?" a="Ensure server.py runs on port 5000. Check console for CORS." />
            <FAQItem q="Empty Insights?" a="LLM needs pre-analysis data. If no metrics are found, context is empty." />
          </div>
        </div>
      </div>

      <div className="bg-indigo-600 rounded-2xl p-8 text-center shadow-xl shadow-indigo-500/20">
        <h2 className="text-2xl font-bold text-white mb-4">Ready to optimize?</h2>
        <button onClick={onStart} className="bg-white text-indigo-600 px-8 py-3 rounded-xl font-bold hover:bg-slate-100 transition-colors inline-flex items-center gap-2">
          Start Analysis <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function ManualStep({ step, title, icon, desc }) {
  return (
    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl font-black text-slate-500">{step}</div>
      <div className="mb-4 bg-slate-900 w-12 h-12 rounded-lg flex items-center justify-center border border-slate-700">{icon}</div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function FAQItem({ q, a }) {
  return (
    <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
      <h4 className="text-slate-200 font-bold text-sm mb-1">{q}</h4>
      <p className="text-slate-400 text-sm">{a}</p>
    </div>
  );
}