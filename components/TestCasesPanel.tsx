import React, { useState, useMemo } from "react";
import { SavedTestCase, SwaggerProject } from "../types";

interface TestCasesPanelProps {
  testCases: SavedTestCase[];
  onDelete: (ids: string[]) => void;
  onGenerateMTC: (ids: string[]) => void;
  onRunAutomation: (ids: string[]) => void;
  isExecuting: boolean;
  isGeneratingMTC: boolean;
  project: SwaggerProject;
  generatedMTCData: Record<string, { rows: any[]; rawRows: any[] }>;
}

const TestCasesPanel: React.FC<TestCasesPanelProps> = ({
  testCases,
  onDelete,
  onGenerateMTC,
  onRunAutomation,
  isExecuting,
  isGeneratingMTC,
  project,
  generatedMTCData,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Group Test Cases by Endpoint Tags
  const groupedCases = useMemo(() => {
    const groups: Record<string, SavedTestCase[]> = {};

    testCases.forEach((tc) => {
      // Find original endpoint to get tags
      const endpoint = project.endpoints.find((e) => e.id === tc.endpointId);
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

  // --- Selection Logic ---

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

  // --- Actions ---

  const handleRun = () => {
    if (selectedIds.size === 0) return;
    onRunAutomation(Array.from(selectedIds));
  };

  const handleMTC = () => {
    if (selectedIds.size === 0) return;
    onGenerateMTC(Array.from(selectedIds));
  };

  const handleDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Delete ${selectedIds.size} scenarios?`)) {
      onDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const handleExportPostman = () => {
    const selectedCases = testCases.filter((tc) => selectedIds.has(tc.id));
    if (selectedCases.length === 0) return;

    const items: any[] = [];

    selectedCases.forEach((tc) => {
      const mtcData = generatedMTCData[tc.id];
      if (mtcData && mtcData.rawRows && mtcData.rawRows.length > 0) {
        mtcData.rawRows.forEach((rawRow, index) => {
          const baseUrl = tc.url.split("/").slice(0, 3).join("/");

          const queryParams = Object.entries(rawRow.queryParams || {})
            .filter(([_, v]) => v !== undefined && v !== null && v !== "")
            .map(
              ([k, v]) =>
                `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
            )
            .join("&");

          const fullUrl =
            baseUrl + rawRow.endPoint + (queryParams ? `?${queryParams}` : "");

          const headerEntries = Object.entries(rawRow.headerParams || {})
            .filter(([_, v]) => v !== undefined && v !== null && v !== "")
            .map(([k, v]) => ({ key: k, value: String(v) }));

          if (rawRow.auth) {
            headerEntries.push({ key: "Authorization", value: rawRow.auth });
          }

          items.push({
            name: `${tc.name} - ${rawRow.set} - ${rawRow.summary}`,
            request: {
              method: rawRow.httpMethod.toUpperCase(),
              header: headerEntries,
              body: {
                mode: "raw",
                raw: rawRow.payload || "",
              },
              url: {
                raw: fullUrl,
                host: [baseUrl.replace(/^https?:\/\//, "")],
                path: rawRow.endPoint.split("/").filter(Boolean),
                query: Object.entries(rawRow.queryParams || {})
                  .filter(([_, v]) => v !== undefined && v !== null && v !== "")
                  .map(([k, v]) => ({ key: k, value: String(v) })),
              },
            },
            response: [],
          });
        });
      } else {
        items.push({
          name: tc.name,
          request: {
            method: tc.method.toUpperCase(),
            header: Object.entries(tc.headers)
              .filter(([_, v]) => v)
              .map(([k, v]) => ({ key: k, value: v })),
            body: {
              mode: "raw",
              raw: tc.body,
            },
            url: {
              raw: tc.url,
              host: [tc.url.split("/")[2]],
              path: tc.url.split("/").slice(3),
            },
          },
          response: [],
        });
      }
    });

    const postman = {
      info: {
        name: `${project.name} - Export`,
        schema:
          "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: items,
    };

    const blob = new Blob([JSON.stringify(postman, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, "_")}_selected.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSwagger = () => {
    const selectedCases = testCases.filter((tc) => selectedIds.has(tc.id));
    if (selectedCases.length === 0) return;

    const paths: any = {};

    selectedCases.forEach((tc) => {
      const endpoint = project.endpoints.find((e) => e.id === tc.endpointId);
      if (!endpoint) return;

      if (!paths[endpoint.path]) {
        paths[endpoint.path] = {};
      }

      paths[endpoint.path][tc.method.toLowerCase()] = {
        summary: tc.name,
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Header & Actions */}
      <div className="p-3 border-b theme-border theme-bg-main flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-end">
          <span className="text-[10px] theme-bg-main px-2 py-0.5 rounded-full border theme-border theme-text-secondary font-mono">
            {selectedIds.size} / {testCases.length} Selected
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2">
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
              {isGeneratingMTC ? "Gen..." : "MTC Gen"}
            </span>
          </button>

          <button
            onClick={handleRun}
            disabled={
              selectedIds.size === 0 ||
              isExecuting ||
              !isMTCGeneratedForSelected
            }
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-emerald-500/30"
            title="Run Automation"
          >
            <i
              className={`fas ${isExecuting ? "fa-spinner fa-spin" : "fa-play"} text-sm mb-1`}
            ></i>
            <span className="text-[8px] font-bold uppercase">Run Auto</span>
          </button>

          <button
            onClick={handleExportPostman}
            disabled={selectedIds.size === 0 || !isMTCGeneratedForSelected}
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-amber-500/30"
            title="Export Postman Collection"
          >
            <i className="fas fa-file-export text-sm mb-1"></i>
            <span className="text-[8px] font-bold uppercase">Postman</span>
          </button>

          <button
            onClick={handleExportSwagger}
            disabled={selectedIds.size === 0}
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-sky-500/30"
            title="Export Swagger"
          >
            <i className="fas fa-file-code text-sm mb-1"></i>
            <span className="text-[8px] font-bold uppercase">Swagger</span>
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
                        className="w-4 h-4 flex items-center justify-center text-xs theme-text-secondary hover:text-white"
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
                              <div className="text-[10px] font-mono theme-text-secondary theme-bg-workbench px-1.5 py-0.5 rounded border theme-border">
                                {tc.id}
                              </div>
                              <div
                                className={`text-[8px] font-black px-1 py-0.5 rounded border uppercase w-10 text-center ${getMethodColor(tc.method)}`}
                              >
                                {tc.method}
                              </div>
                              <span
                                className="text-xs theme-text-primary truncate flex-1 font-bold"
                                title={tc.name}
                              >
                                {tc.name}
                              </span>
                            </div>
                            {tc.dependentOn && (
                              <div className="ml-8 mt-2 pl-3 border-l theme-border flex flex-col gap-1">
                                <span className="text-[9px] font-black theme-text-secondary uppercase tracking-widest">
                                  Pre-conditions:
                                </span>
                                <div className="text-[10px] font-mono theme-text-primary theme-bg-workbench px-1.5 py-0.5 rounded border theme-border w-fit">
                                  {tc.dependentOn}
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
    </div>
  );
};

export default TestCasesPanel;
