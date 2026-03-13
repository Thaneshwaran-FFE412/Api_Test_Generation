
import React, { useState } from 'react';
import { ExecutionResult } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from 'recharts';

interface ReportModalProps {
  results: ExecutionResult[];
  onClose: () => void;
}

const ReportModal: React.FC<ReportModalProps> = ({ results, onClose }) => {
  const [selectedResult, setSelectedResult] = useState<ExecutionResult | null>(results[0]);

  const stats = {
    total: results.length,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status !== 'pass').length,
    avgTime: Math.round(results.reduce((acc, r) => acc + r.responseTime, 0) / results.length)
  };

  const chartData = [
    { name: 'Passed', value: stats.passed, color: '#10b981' },
    { name: 'Failed', value: stats.failed, color: '#f43f5e' }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-6xl h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <i className="fas fa-robot text-indigo-400"></i>
              Automated Fuzzing Report
            </h2>
            <p className="text-slate-500 text-sm mt-1">Generated {results.length} permutations at {new Date().toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Summary Sidebar */}
          <div className="w-80 border-r border-slate-800 bg-slate-950/30 p-6 space-y-8 overflow-y-auto">
            <div>
              <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Summary Statistics</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                  <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Passed</p>
                  <p className="text-2xl font-bold text-emerald-400">{stats.passed}</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                  <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Failed/Issues</p>
                  <p className="text-2xl font-bold text-rose-400">{stats.failed}</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 col-span-2">
                  <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Avg Response Time</p>
                  <p className="text-2xl font-bold text-indigo-400">{stats.avgTime}ms</p>
                </div>
              </div>
            </div>

            <div className="h-48">
              <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Distribution</h3>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ReTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest">Test Permutations</h3>
              <div className="space-y-2">
                {results.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedResult(r)}
                    className={`w-full text-left p-3 rounded-lg border text-sm transition-all flex items-center gap-3 ${selectedResult?.id === r.id ? 'bg-indigo-600/20 border-indigo-500/50' : 'bg-slate-800/30 border-slate-800 hover:border-slate-700'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${r.status === 'pass' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}></div>
                    <div className="flex-1 truncate">
                      <p className="font-bold truncate text-xs text-slate-200">{r.testCaseName.split('-').pop()?.trim()}</p>
                      <p className="text-[10px] text-slate-500 truncate">{r.testCaseName.split('-').shift()}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Result Detail */}
          <div className="flex-1 p-8 overflow-y-auto bg-slate-950">
            {selectedResult ? (
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-3xl font-bold mb-2">{selectedResult.testCaseName}</h3>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={`px-3 py-1 rounded-full font-bold uppercase text-xs ${selectedResult.status === 'pass' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-rose-400/10 text-rose-400'}`}>
                        {selectedResult.status}ed
                      </span>
                      <span className="text-slate-500 font-mono">ID: {selectedResult.id}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold uppercase text-slate-500 tracking-wider">Request Variation</h4>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                       <div>
                         <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Method & URL</p>
                         <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-indigo-400 uppercase">{selectedResult.request.method}</span>
                            <span className="text-xs text-slate-300 font-mono truncate">{selectedResult.request.url}</span>
                         </div>
                       </div>
                       <div>
                         <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Injected Payload / Headers</p>
                         <pre className="text-xs bg-slate-950 p-3 rounded border border-slate-800 text-indigo-300 max-h-40 overflow-auto">
                            {/* Display Body if present, else headers if interesting */}
                            {selectedResult.request.body ? JSON.stringify(typeof selectedResult.request.body === 'string' ? JSON.parse(selectedResult.request.body) : selectedResult.request.body, null, 2) : "No Body modified"}
                         </pre>
                       </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold uppercase text-slate-500 tracking-wider">Validation Logic</h4>
                    <div className="space-y-2">
                       {selectedResult.assertionResults.map((ar, i) => (
                         <div key={i} className={`p-4 rounded-xl border flex items-center gap-4 ${ar.passed ? 'bg-emerald-400/5 border-emerald-400/20' : 'bg-rose-400/5 border-rose-400/20'}`}>
                            <div className={`p-2 rounded-full ${ar.passed ? 'bg-emerald-400/20 text-emerald-400' : 'bg-rose-400/20 text-rose-400'}`}>
                              <i className={`fas fa-${ar.passed ? 'check' : 'times'}`}></i>
                            </div>
                            <div className="flex-1">
                               <p className="text-xs font-bold text-slate-200">Validation #{i+1}</p>
                               <p className="text-xs text-slate-400">{ar.assertion.type.replace('_', ' ').toUpperCase()}: {ar.assertion.expected}</p>
                            </div>
                            <div className="text-right">
                                <span className={`text-[10px] font-bold uppercase block ${ar.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {ar.passed ? 'Passed' : 'Failed'}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">
                                Actual: {ar.actual}
                                </span>
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                    <h4 className="text-sm font-bold uppercase text-slate-500 tracking-wider">Response Details</h4>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                       <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-800 flex justify-between text-[10px] font-bold text-slate-400">
                          <span>BODY</span>
                          <span>JSON</span>
                       </div>
                       <pre className="p-6 text-sm font-mono text-emerald-400 bg-slate-950 overflow-auto max-h-80">
                          {typeof selectedResult.response.body === 'object' ? JSON.stringify(selectedResult.response.body, null, 2) : selectedResult.response.body}
                       </pre>
                    </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-700">
                Select an execution to view details
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
           <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-all border border-slate-700">
             <i className="fas fa-file-pdf mr-2"></i> Download Report
           </button>
           <button onClick={onClose} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-bold transition-all">
             Done
           </button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;