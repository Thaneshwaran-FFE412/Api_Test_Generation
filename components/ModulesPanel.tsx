import { SavedModule, SwaggerProject } from "@/types";
import React, { useState } from "react";

interface ModulesPanelProps {
  modules: SavedModule[];
  project: SwaggerProject;
  onDelete: (ids: string[]) => void;
  onDownload: (id: string, withAutomation: boolean) => void;
  onExportPostman: (id: string) => void;
  onExportFireflink: (id: string) => void;
  isExecuting: boolean;
}

const ModulesPanel: React.FC<ModulesPanelProps> = ({
  modules,
  project,
  onDelete,
  onDownload,
  onExportPostman,
  onExportFireflink,
  isExecuting,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectAll = () => {
    if (selectedIds.size === modules.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(modules.map((m) => m.id)));
    }
  };

  const toggleItemSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Delete ${selectedIds.size} modules?`)) {
      onDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Header & Actions */}
      <div className="p-3 border-b theme-border theme-bg-main flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-end">
          <span className="text-[10px] theme-bg-main px-2 py-0.5 rounded-full border theme-border theme-text-secondary font-mono">
            {selectedIds.size} / {modules.length} Selected
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2">
          <button
            onClick={() => {
              if (selectedIds.size === 1) {
                onDownload(Array.from(selectedIds)[0], false);
              }
            }}
            disabled={selectedIds.size !== 1 || isExecuting}
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 theme-accent-text transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-indigo-500/30"
            title="Download Module Data"
          >
            <i className="fas fa-download text-sm mb-1"></i>
            <span className="text-[8px] font-bold uppercase">Download</span>
          </button>

          <button
            onClick={() => {
              if (selectedIds.size === 1) {
                onDownload(Array.from(selectedIds)[0], true);
              }
            }}
            disabled={selectedIds.size !== 1 || isExecuting}
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-emerald-500/30"
            title="Download with Automation"
          >
            <i className={`fas ${isExecuting ? 'fa-spinner fa-spin' : 'fa-robot'} text-sm mb-1`}></i>
            <span className="text-[8px] font-bold uppercase">With Auto</span>
          </button>

          <button
            onClick={() => {
              if (selectedIds.size === 1) {
                onExportPostman(Array.from(selectedIds)[0]);
              }
            }}
            disabled={selectedIds.size !== 1 || isExecuting}
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-amber-500/30"
            title="Export Postman Collection"
          >
            <i className="fas fa-file-export text-sm mb-1"></i>
            <span className="text-[8px] font-bold uppercase">Postman</span>
          </button>

          <button
            onClick={() => {
              if (selectedIds.size === 1) {
                onExportFireflink(Array.from(selectedIds)[0]);
              }
            }}
            disabled={selectedIds.size !== 1 || isExecuting}
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-violet-500/30"
            title="Export to Fireflink"
          >
            <i className="fas fa-external-link-alt text-sm mb-1"></i>
            <span className="text-[8px] font-bold uppercase">Fireflink</span>
          </button>

          <button
            onClick={handleDelete}
            disabled={selectedIds.size === 0 || isExecuting}
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-rose-500/30"
            title="Delete Selected"
          >
            <i className="fas fa-trash-alt text-sm mb-1"></i>
            <span className="text-[8px] font-bold uppercase">Delete</span>
          </button>
        </div>
      </div>

      {/* List View */}
      <div className="flex-1 overflow-y-auto p-2">
        {modules.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30">
            <i className="fas fa-cubes text-4xl mb-3"></i>
            <p className="text-xs font-medium">No saved modules</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-3 py-2 mb-2 border-b theme-border opacity-60 hover:opacity-100 transition-opacity">
              <input
                type="checkbox"
                className="accent-indigo-500 rounded cursor-pointer"
                checked={
                  selectedIds.size > 0 && selectedIds.size === modules.length
                }
                onChange={toggleSelectAll}
                ref={(input) => {
                  if (input)
                    input.indeterminate =
                      selectedIds.size > 0 && selectedIds.size < modules.length;
                }}
              />
              <span className="text-xs font-bold uppercase tracking-wider">
                Select All
              </span>
            </div>

            <div className="space-y-1">
              {modules.map((mod) => (
                <div
                  key={mod.id}
                  className={`flex flex-col p-3 rounded-lg border transition-colors ${
                    selectedIds.has(mod.id)
                      ? "border-indigo-500 bg-indigo-500/5"
                      : "theme-border theme-bg-workbench/20 hover:theme-bg-surface"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="accent-indigo-500 rounded cursor-pointer"
                      checked={selectedIds.has(mod.id)}
                      onChange={() => toggleItemSelection(mod.id)}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-bold theme-text-primary">
                        {mod.name}
                      </div>
                      <div className="text-[10px] theme-text-secondary mt-1">
                        {new Date(mod.createdAt).toLocaleString()} •{" "}
                        {mod.testCaseIds.length} Scenarios
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ModulesPanel;
