import React, { useState, useMemo, useEffect } from "react";
import { SavedTestCase, SwaggerProject } from "../types";
import { BASE_URL } from "@/pages/LandingPage";
import toast from "react-hot-toast";

interface TestCasesPanelProps {
  testCases: SavedTestCase[];
  getEndpointList: () => void;
  executionList: any[];
  onGenerateMTC: (
    ids: string[],
    testCases: SavedTestCase[] | [],
    executionName: string,
  ) => Promise<boolean>;
  onSaveModule: (ids: string[], name: string) => void;
  isGeneratingMTC: boolean;
  project: SwaggerProject;
  generatedMTCData: Record<string, { rows: any[]; rawRows: any[] }>;
}

const TestCasesPanel: React.FC<TestCasesPanelProps> = ({
  testCases,
  getEndpointList,
  onGenerateMTC,
  executionList,
  onSaveModule,
  isGeneratingMTC,
  project,
  generatedMTCData,
}) => {
  console.log("testCases");
  console.log(testCases);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const groupedCases = useMemo(() => {
    const groups: Record<string, SavedTestCase[]> = {};

    testCases.forEach((tc) => {
      const endpoint = project.endpoints.find(
        (e) => e.tags[0] === tc.controller,
      );
      const groupName =
        endpoint?.tags && endpoint.tags.length > 0
          ? endpoint.tags[0]
          : "General";

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(tc);
    });
    return groups;
  }, [testCases, project.endpoints]);

  const groupKeys = Object.keys(groupedCases).sort();

  const toggleSelectAll = () => {
    if (selectedIds.size === testCases.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(testCases.map((tc) => tc.id)));
    }
  };

  const toggleGroupSelection = (groupName: string) => {
    const groupItems = groupedCases[groupName];
    const allSelected = groupItems.every((tc) => selectedIds.has(tc.id));

    const newSelected = new Set(selectedIds);
    if (allSelected) {
      groupItems.forEach((tc) => newSelected.delete(tc.id));
    } else {
      groupItems.forEach((tc) => newSelected.add(tc.id));
    }
    setSelectedIds(newSelected);
  };

  const toggleItemSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleGroupExpand = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) newExpanded.delete(groupName);
    else newExpanded.add(groupName);
    setExpandedGroups(newExpanded);
  };

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [moduleName, setModuleName] = useState("");

  // --- Actions ---

  const handleMTC = async () => {
    setModuleName("");
    setIsSaveModalOpen(true);
  };
  const deleteEndpoint = async (payload: string[]) => {
    const data: any = await fetch(`${BASE_URL}/endpoint/delete`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const response = await data.json();
    if (response.responseCode === 200) {
      toast.success(response.responseMessage || "Deleted successfully");
      getEndpointList();
    } else {
      toast.error(response.message);
    }
  };

  const handleDelete = () => {
    if (selectedIds.size === 0) return;
    const deleteId: string[] = [];
    selectedIds.forEach((id) => {
      const tc = testCases.find((t) => t.id === id);
      if (tc) {
        deleteId.push(tc.id);
      }
    });
    if (deleteId.length > 0) {
      deleteEndpoint(deleteId);
    }
  };

  const handleExportSwagger = () => {
    const selectedCases = testCases.filter((tc) => selectedIds.has(tc.id));
    if (selectedCases.length === 0) return;

    const paths: any = {};

    selectedCases.forEach((tc) => {
      const endpoint = project.endpoints.find((e) => e.id === tc.id);
      if (!endpoint) return;

      if (!paths[endpoint.path]) {
        paths[endpoint.path] = {};
      }

      paths[endpoint.path][tc.request.method.toLowerCase()] = {
        summary: tc.endpointName,
        description: `Exported from ${project.name}`,
        parameters: endpoint.parameters,
        requestBody: endpoint.requestBody,
        responses: endpoint.responses,
      };
    });

    const swagger = {
      openapi: "3.0.0",
      info: {
        title: `${project.name} - Export`,
        version: "1.0.0",
      },
      paths: paths,
      components: project.spec.components,
    };

    const blob = new Blob([JSON.stringify(swagger, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, "_")}_swagger.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET":
        return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
      case "POST":
        return "text-indigo-500 bg-indigo-500/10 border-indigo-500/20";
      case "PUT":
        return "text-amber-500 bg-amber-500/10 border-amber-500/20";
      case "DELETE":
        return "text-rose-500 bg-rose-500/10 border-rose-500/20";
      default:
        return "theme-text-secondary theme-bg-workbench border theme-border";
    }
  };

  const isMTCGeneratedForSelected =
    selectedIds.size > 0 &&
    Array.from(selectedIds).every(
      (id) =>
        generatedMTCData[id] &&
        generatedMTCData[id].rawRows &&
        generatedMTCData[id].rawRows.length > 0,
    );

  const handleSaveModule = () => {
    if (selectedIds.size === 0) return;
    setModuleName("");
    setIsSaveModalOpen(true);
  };

  const confirmSaveModule = async (moduleName: string) => {
    if (!moduleName.trim()) return;
    if (selectedIds.size === 0) return;
    const mtcData = await onGenerateMTC(
      Array.from(selectedIds),
      testCases,
      moduleName,
    );
    if (mtcData) {
      toast.success("Module saved successfully!");
    }
    setIsSaveModalOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Header & Actions */}
      <div className="p-3 border-b theme-border theme-bg-main flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-end">
          <span className="text-[10px] theme-bg-main px-2 py-0.5 rounded-full border theme-border theme-text-secondary font-mono">
            {selectedIds.size} / {testCases.length} Selected
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleMTC}
            disabled={selectedIds.size === 0 || isGeneratingMTC}
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 theme-accent-text transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-indigo-500/30"
            title="Generate Manual Test Cases"
          >
            <i
              className={`fas ${isGeneratingMTC ? "fa-spinner fa-spin" : "fa-file-signature"} text-sm mb-1`}
            ></i>
            <span className="text-[8px] font-bold uppercase">
              {isGeneratingMTC ? "Gen..." : "Generate MTC"}
            </span>
          </button>

          <button
            onClick={handleDelete}
            disabled={selectedIds.size === 0}
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-rose-500/30"
            title="Delete Selected"
          >
            <i className="fas fa-trash-alt text-sm mb-1"></i>
            <span className="text-[8px] font-bold uppercase">Delete</span>
          </button>
        </div>
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto p-2">
        {testCases.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30">
            <i className="fas fa-folder-open text-4xl mb-3"></i>
            <p className="text-xs font-medium">No saved requests</p>
          </div>
        ) : (
          <>
            {/* Global Select All */}
            <div className="flex items-center gap-2 px-3 py-2 mb-2 border-b theme-border opacity-60 hover:opacity-100 transition-opacity">
              <input
                type="checkbox"
                className="accent-indigo-500 rounded cursor-pointer"
                checked={
                  selectedIds.size > 0 && selectedIds.size === testCases.length
                }
                onChange={toggleSelectAll}
                ref={(input) => {
                  if (input)
                    input.indeterminate =
                      selectedIds.size > 0 &&
                      selectedIds.size < testCases.length;
                }}
              />
              <span className="text-xs font-bold uppercase tracking-wider">
                Select All
              </span>
            </div>

            <div className="space-y-1">
              {groupKeys.map((group) => {
                const groupItems = groupedCases[group];
                const isAllGroupSelected = groupItems.every((tc) =>
                  selectedIds.has(tc.id),
                );
                const isGroupIndeterminate =
                  groupItems.some((tc) => selectedIds.has(tc.id)) &&
                  !isAllGroupSelected;
                const isExpanded = expandedGroups.has(group);

                return (
                  <div
                    key={group}
                    className="border theme-border rounded-lg overflow-hidden theme-bg-workbench/20"
                  >
                    {/* Group Header */}
                    <div className="flex items-center gap-2 p-2 theme-bg-surface/50 hover:theme-bg-surface transition-colors select-none">
                      <button
                        onClick={() => toggleGroupExpand(group)}
                        className="w-4 h-4 flex items-center justify-center text-xs theme-text-secondary hover:theme-text-primary"
                      >
                        <i
                          className={`fas fa-chevron-${isExpanded ? "down" : "right"}`}
                        ></i>
                      </button>

                      <input
                        type="checkbox"
                        className="accent-indigo-500 rounded cursor-pointer"
                        checked={isAllGroupSelected}
                        onChange={() => toggleGroupSelection(group)}
                        ref={(input) => {
                          if (input) input.indeterminate = isGroupIndeterminate;
                        }}
                      />

                      <span
                        className="flex-1 text-xs font-bold theme-text-primary uppercase tracking-wide cursor-pointer"
                        onClick={() => toggleGroupExpand(group)}
                      >
                        {group}
                      </span>
                      <span className="text-[9px] theme-bg-main px-1.5 rounded theme-text-secondary border theme-border">
                        {groupItems.length}
                      </span>
                    </div>

                    {/* Group Items */}
                    {isExpanded && (
                      <div className="theme-bg-workbench/30">
                        {groupItems.map((tc) => (
                          <div
                            key={tc.id}
                            className={`flex flex-col p-2 pl-9 hover:theme-bg-surface transition-colors border-l-2 ${selectedIds.has(tc.id) ? "border-indigo-500 bg-indigo-500/5" : "border-transparent"}`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                className="accent-indigo-500 rounded cursor-pointer"
                                checked={selectedIds.has(tc.id)}
                                onChange={() => toggleItemSelection(tc.id)}
                              />
                              <div
                                className={`text-[8px] font-black px-1 py-0.5 rounded border uppercase w-10 text-center ${getMethodColor(tc.request.method)}`}
                              >
                                {tc.request.method}
                              </div>
                              <span
                                className="text-xs theme-text-primary truncate flex-1 font-bold"
                                title={tc.endpointName}
                              >
                                {tc.endpointName}
                              </span>
                            </div>
                            {tc?.dependentId?.length > 0 && (
                              <div className="ml-8 mt-2 pl-3 border-l theme-border flex flex-col gap-1">
                                <span className="text-[9px] font-black theme-text-secondary uppercase tracking-widest">
                                  Pre-conditions:
                                </span>
                                <div className="text-[10px] font-mono theme-text-primary theme-bg-workbench px-1.5 py-0.5 rounded border theme-border w-fit">
                                  {tc.dependentId.map((depId) => {
                                    const dep = testCases.find(
                                      (t) => t.id === depId,
                                    );
                                    return dep?.endpointName ?? "";
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Save Module Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="theme-bg-main border theme-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b theme-border flex justify-between items-center theme-bg-surface">
              <h3 className="font-bold theme-text-primary">Save Module</h3>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="theme-text-secondary hover:theme-text-primary transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium theme-text-secondary mb-2">
                Execution Name
              </label>
              <input
                type="text"
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
                placeholder="e.g., Authentication Flow"
                className="w-full px-4 py-2 rounded-lg border theme-border theme-bg-workbench theme-text-primary focus:outline-none focus:border-indigo-500 transition-colors"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && moduleName.trim()) {
                    confirmSaveModule(moduleName);
                  }
                }}
              />
            </div>
            <div className="p-4 border-t theme-border theme-bg-surface flex justify-end gap-3">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium theme-text-secondary hover:theme-bg-workbench transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmSaveModule(moduleName);
                }}
                disabled={!moduleName.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestCasesPanel;
