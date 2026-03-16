import React, { useState } from "react";

interface VariablesPanelProps {
  variables: Record<string, string>;
  onVariablesChange: (vars: Record<string, string>) => void;
}

const VariablesPanel: React.FC<VariablesPanelProps> = ({
  variables,
  onVariablesChange,
}) => {
  const [newVarKey, setNewVarKey] = useState("");
  const [newVarValue, setNewVarValue] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVarKey.trim()) return;
    onVariablesChange({ ...variables, [newVarKey.trim()]: newVarValue });
    setNewVarKey("");
    setNewVarValue("");
  };

  const handleDelete = (key: string) => {
    const newVars = { ...variables };
    delete newVars[key];
    onVariablesChange(newVars);
  };

  const handleUpdate = (oldKey: string, newValue: string) => {
    onVariablesChange({ ...variables, [oldKey]: newValue });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b theme-border bg-white/5">
        <form
          onSubmit={handleAdd}
          className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end"
        >
          <div className="space-y-1.5">
            <label className="text-[10px] font-black theme-text-secondary uppercase tracking-[0.2em] ml-1">
              Variable Key
            </label>
            <input
              type="text"
              placeholder="e.g. baseUrl"
              className="w-full theme-bg-main border theme-border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500/50 outline-none font-mono theme-text-primary transition-all"
              value={newVarKey}
              onChange={(e) => setNewVarKey(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black theme-text-secondary uppercase tracking-[0.2em] ml-1">
              Value
            </label>
            <input
              type="text"
              placeholder="Value"
              className="w-full theme-bg-main border theme-border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500/50 outline-none font-mono theme-text-primary transition-all"
              value={newVarValue}
              onChange={(e) => setNewVarValue(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="theme-accent-bg text-white px-6 rounded-lg text-xs font-black tracking-widest hover:opacity-90 transition-all shadow-lg h-[34px] active:scale-95"
          >
            ADD
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {Object.keys(variables).length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 grayscale">
            <div className="w-12 h-12 theme-bg-main border-2 theme-border rounded-xl flex items-center justify-center mb-4 shadow-xl rotate-3">
              <i className="fas fa-code text-xl theme-accent-text"></i>
            </div>
            <p className="theme-text-secondary text-[10px] font-black uppercase tracking-widest">
              No variables defined
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_40px] gap-4 text-[10px] font-black theme-text-secondary px-3 uppercase tracking-[0.2em] opacity-60 mb-2">
              <span>Variable Key</span>
              <span>Value</span>
              <span></span>
            </div>
            <div className="space-y-1">
              {Object.entries(variables).map(([key, value]) => (
                <div
                  key={key}
                  className="grid grid-cols-[1fr_1fr_40px] gap-4 items-center theme-bg-surface/30 p-2 rounded-xl border border-transparent hover:border-indigo-500/30 transition-all group"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold text-indigo-400 font-mono truncate">
                      ${key}
                    </span>
                    <span className="text-[8px] theme-text-secondary font-mono opacity-50 truncate">
                      {"{{" + key + "}}"}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handleUpdate(key, e.target.value)}
                    className="theme-bg-main border theme-border rounded-lg px-3 py-1.5 text-xs font-mono theme-text-primary focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                  />
                  <div className="flex justify-center">
                    <button
                      onClick={() => handleDelete(key)}
                      className="text-rose-500 opacity-20 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-90"
                    >
                      <i className="fas fa-trash-alt text-[11px]"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-indigo-500/5 border-t theme-border">
        <p className="text-[9px] theme-text-secondary leading-relaxed font-medium italic">
          <i className="fas fa-info-circle mr-1.5 text-indigo-400"></i>
          Variables are shared across all requests. Use{" "}
          <span className="text-indigo-400 font-bold">$key</span> to reference
          them.
        </p>
      </div>
    </div>
  );
};

export default VariablesPanel;
