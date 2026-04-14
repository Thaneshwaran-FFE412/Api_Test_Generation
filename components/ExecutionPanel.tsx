import { BASE_URL } from "@/pages/LandingPage";
import { runExecutionFromDB } from "@/services/automationService";
import {
  ExecutionResult,
  GlobalAuth,
  SavedModule,
  SavedTestCase,
  SwaggerProject,
} from "@/types";
import { formatAndAppendSheet } from "@/utils/excelFormatter";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

export interface ExecutionProps {
  id: string;
  projectId: string;
  executionName: string;
  rows: any[];
  rawRows: any[];
}
export interface ApiReport {
  id: string;
  projectId: string;
  executionId: string;
  reportName: string;
  reportData: ExecutionResult[];
  updatedRow: any[];
  createdDate: string;
}

interface ExecutionPanelProps {
  project: SwaggerProject;
  executionList: ExecutionProps[];
  setReportData: React.Dispatch<
    React.SetStateAction<{
      isOpen: boolean;
      updatedRow: ExecutionResult[];
      reportName: any[];
    }>
  >;
  globalAuth: GlobalAuth;
  testCases: [] | SavedTestCase[];
  variables: Record<string, string>;
  getExecutionList: () => Promise<void>;
  onExportPostman: (id: string) => void;
  onExportFireflink: (id: string) => void;
  isExecuting: boolean;
}

const ExecutionPanel: React.FC<ExecutionPanelProps> = ({
  executionList,
  project,
  testCases,
  variables,
  globalAuth,
  setReportData,
  getExecutionList,
  onExportPostman,
  onExportFireflink,
  isExecuting,
}) => {
  console.log("executionList");
  console.log(executionList);

  const [selectedIds, setSelectedIds] = useState<string | null>(null);
  const [allReports, setAllReports] = useState<ApiReport[]>([]);
  const [expandedExecution, setExpandedExecution] = useState<Set<string>>(
    new Set(),
  );
  const [isExecutingAutomation, setIsExecutingAutomation] = useState(false);
  const [excelDataByTestCase, setExcelDataByTestCase] = useState<Record<
    string,
    any[]
  > | null>(null);

  const toggleItemSelection = (id: string) => {
    setSelectedIds(id);
  };

  const getReportsByExecution = (executionId: string): ApiReport[] => {
    return allReports.filter((r) => r.executionId === executionId);
  };

  const handleViewReport = (report: ApiReport) => {
    setReportData({
      isOpen: true,
      reportName: report.reportData,
      updatedRow: report.updatedRow,
    });
  };

  const handleDownloadReport = (report: ApiReport) => {
    console.log();

    const workbook = XLSX.utils.book_new();

    formatAndAppendSheet(
      workbook,
      report.updatedRow,
      "Execution",
      report.reportName,
      "None",
    );

    XLSX.writeFile(
      workbook,
      `${report.reportName.replace(/\s+/g, "_")}_Automation_Report.xlsx`,
    );

    toast.success("Report downloaded!");
  };

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedExecution);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedExecution(newSet);
  };

  const fetchAllReports = async () => {
    const data: any = await fetch(`${BASE_URL}/report/all`, {
      method: "GET",
    });
    const response = await data.json();
    if (response.responseCode === 200) {
      toast.success(response.responseMessage);
      setAllReports(response.responseObject);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      const res: any = await fetch(`${BASE_URL}/report/delete/${reportId}`, {
        method: "DELETE",
      });

      const response = await res.json();

      if (response.responseCode === 200) {
        toast.success("Report deleted successfully");
        fetchAllReports(); // refresh list
      } else {
        toast.error(response.responseMessage || "Failed to delete report");
      }
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong");
    }
  };

  useEffect(() => {
    fetchAllReports();
  }, []);

  const deleteExecution = async (id: string) => {
    const data: any = await fetch(`${BASE_URL}/execution/delete/${id}`, {
      method: "DELETE",
    });
    const response = await data.json();

    if (response.responseCode === 200) {
      toast.success(response.message);
      getExecutionList();
    } else {
      console.error("Failed to fetch saved scenarios");
    }
  };

  const handleDelete = () => {
    if (!selectedIds) return;
    deleteExecution(selectedIds);
  };

  const handleDownloadModule = async (
    id: string,
    project: SwaggerProject,
    executionList: ExecutionProps[],
    testCases: SavedTestCase[],
    withAutomation: boolean,
  ) => {
    try {
      const exeData = executionList.find((e) => e.id === id);

      if (!exeData) {
        toast.error("Execution not found");
        return;
      }

      const workbook = XLSX.utils.book_new();

      if (withAutomation) {
        setIsExecutingAutomation(true);

        const { results, updatedRow } = await runExecutionFromDB(
          exeData,
          testCases,
          project.endpoints,
          variables,
          globalAuth,
        );

        //API Call

        const data: any = await fetch(`${BASE_URL}/report/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            executionId: exeData.id,
            reportName: `${exeData.executionName} - Report`,
            reportData: results,
            updatedRow,
          }),
        });

        const response = await data.json();
        if (response.responseCode === 200) {
          fetchAllReports();
          toast.success(response.responseMessage);
        }

        if (results.length > 0) {
          setReportData({
            isOpen: true,
            reportName: results,
            updatedRow: updatedRow,
          });
        }

        if (updatedRow && updatedRow.length > 0) {
          formatAndAppendSheet(
            workbook,
            updatedRow,
            "Execution",
            exeData.executionName,
            "None",
          );

          XLSX.writeFile(
            workbook,
            `${exeData.executionName.replace(/\s+/g, "_")}_Automation_Report.xlsx`,
          );

          toast.success("Automation report downloaded!");
        } else {
          toast.error("No data to download.");
        }

        setIsExecutingAutomation(false);
      } else {
        // Manual Scenario

        if (exeData.rows && exeData.rows.length > 0) {
          const clonedRows = exeData.rows.map((row) => ({ ...row }));

          formatAndAppendSheet(
            workbook,
            clonedRows,
            "Execution",
            exeData.executionName,
            "None",
          );

          XLSX.writeFile(
            workbook,
            `${exeData.executionName.replace(/\s+/g, "_")}_MTC.xlsx`,
          );

          toast.success("MTC data downloaded!");
        } else {
          toast.error("No MTC data found.");
        }
      }
    } catch (e) {
      console.error("Download Error:", e);
      toast.error("Something went wrong.");
      setIsExecutingAutomation(false);
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <div className="p-3 border-b theme-border theme-bg-main flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-end">
          <span className="text-[10px] theme-bg-main px-2 py-0.5 rounded-full border theme-border theme-text-secondary font-mono">
            {selectedIds} / {executionList.length} Selected
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2">
          <button
            onClick={() => {
              if (selectedIds) {
                handleDownloadModule(
                  selectedIds,
                  project,
                  executionList,
                  testCases,
                  false,
                );
              }
            }}
            disabled={!selectedIds || isExecuting}
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 theme-accent-text transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-indigo-500/30"
          >
            <i className="fas fa-download text-sm mb-1"></i>
            <span className="text-[8px] font-bold uppercase">Download MTC</span>
          </button>

          <button
            onClick={() => {
              if (selectedIds) {
                handleDownloadModule(
                  selectedIds,
                  project,
                  executionList,
                  testCases,
                  true,
                );
              }
            }}
            disabled={!selectedIds || isExecuting}
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-emerald-500/30"
          >
            <i
              className={`fas ${isExecuting ? "fa-spinner fa-spin" : "fa-robot"} text-sm mb-1`}
            ></i>
            <span className="text-[8px] font-bold uppercase">With Auto</span>
          </button>

          <button
            onClick={() => {
              if (selectedIds) {
                onExportPostman(Array.from(selectedIds)[0]);
              }
            }}
            disabled={!selectedIds || isExecuting}
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-amber-500/30"
          >
            <i className="fas fa-file-export text-sm mb-1"></i>
            <span className="text-[8px] font-bold uppercase">Postman</span>
          </button>

          <button
            onClick={() => {
              if (selectedIds) {
                onExportFireflink(Array.from(selectedIds)[0]);
              }
            }}
            disabled={!selectedIds || isExecuting}
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-violet-500/30"
          >
            <i className="fas fa-external-link-alt text-sm mb-1"></i>
            <span className="text-[8px] font-bold uppercase">Fireflink</span>
          </button>

          <button
            onClick={handleDelete}
            disabled={!selectedIds || isExecuting}
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-rose-500/30"
          >
            <i className="fas fa-trash-alt text-sm mb-1"></i>
            <span className="text-[8px] font-bold uppercase">Delete</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {executionList.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30">
            <i className="fas fa-cubes text-4xl mb-3"></i>
            <p className="text-xs font-medium">No saved Executions</p>
          </div>
        ) : (
          <div className="space-y-1">
            {executionList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-40">
                <i className="fas fa-cubes text-5xl mb-4 text-indigo-400"></i>
                <p className="text-sm font-semibold theme-text-secondary">
                  No Executions Found
                </p>
                <span className="text-[11px] theme-text-secondary opacity-70 mt-1">
                  Create or generate executions to see them here
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {executionList.map((mod) => {
                  const reports = getReportsByExecution(mod.id);
                  const isExpanded = expandedExecution.has(mod.id);

                  return (
                    <div
                      key={mod.id}
                      className={`rounded-xl border transition-all duration-200 shadow-sm ${
                        selectedIds === mod.id
                          ? "border-indigo-500 bg-indigo-500/10 shadow-indigo-500/10"
                          : "theme-border theme-bg-workbench/30 hover:shadow-md hover:theme-bg-surface"
                      }`}
                    >
                      {/* Execution Row */}
                      <div className="flex items-center gap-3 p-3">
                        {/* Expand Button */}
                        <button
                          onClick={() => toggleExpand(mod.id)}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 transition"
                        >
                          <i
                            className={`fas fa-chevron-${isExpanded ? "down" : "right"} text-[10px]`}
                          ></i>
                        </button>

                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          className="accent-indigo-500 rounded cursor-pointer"
                          checked={selectedIds === mod.id}
                          onChange={() => toggleItemSelection(mod.id)}
                        />

                        {/* Execution Name */}
                        <div className="flex-1">
                          <div className="text-sm font-semibold theme-text-primary">
                            {mod.executionName ?? "Default Name"}
                          </div>
                          <div className="text-[10px] theme-text-secondary opacity-70">
                            ID: {mod.id}
                          </div>
                        </div>

                        {/* Report Count Badge */}
                        {reports.length > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-medium">
                            {reports.length} Reports
                          </span>
                        )}
                      </div>

                      {/* Reports Section */}
                      {isExpanded && (
                        <div className="p-3 pl-10 flex flex-col gap-2 border-t theme-border">
                          {reports.length === 0 ? (
                            <div className="text-xs opacity-50 italic">
                              No reports available
                            </div>
                          ) : (
                            reports.map((report, index) => (
                              <div
                                key={report.id}
                                className="flex items-center justify-between p-2 rounded-lg border theme-border theme-bg-workbench hover:theme-bg-surface transition"
                              >
                                <div className="flex flex-col">
                                  <span className="text-xs font-semibold theme-text-primary">
                                    {`${index + 1}. ${report.reportName}`}
                                  </span>
                                  <span className="text-[10px] opacity-60">
                                    created on :{" "}
                                    {report.createdDate
                                      ? new Date(
                                          report.createdDate,
                                        ).toLocaleString("en-IN", {
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          hour12: true,
                                        })
                                      : "-"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleViewReport(report)}
                                    className="text-[11px] px-2 py-1 rounded bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition"
                                  >
                                    <i className="fas fa-eye mr-1"></i>
                                    View
                                  </button>

                                  <button
                                    onClick={() => handleDownloadReport(report)}
                                    className="text-[11px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition"
                                  >
                                    <i className="fas fa-download mr-1"></i>
                                    Download
                                  </button>

                                  <button
                                    onClick={() =>
                                      handleDeleteReport(report.id)
                                    }
                                    className="text-[11px] px-2 py-1 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition"
                                  >
                                    <i className="fas fa-trash mr-1"></i>
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutionPanel;
