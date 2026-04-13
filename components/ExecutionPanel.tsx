import { BASE_URL } from "@/pages/LandingPage";
import {
  applySubstitutionsToExcelRow,
  runAutomatedTests,
  runExecutionFromDB,
} from "@/services/automationService";
import {
  ExecutionResult,
  SavedModule,
  SavedTestCase,
  SwaggerProject,
} from "@/types";
import { formatAndAppendSheet } from "@/utils/excelFormatter";
import React, { useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

export interface ExecutionProps {
  id: string;
  projectId: string;
  executionName: string;
  rows: any[];
  rawRows: any[];
}

interface ExecutionPanelProps {
  project: SwaggerProject;
  executionList: ExecutionProps[];
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
  getExecutionList,
  onExportPostman,
  onExportFireflink,
  isExecuting,
}) => {
  console.log("executionList");
  console.log(executionList);

  const [selectedIds, setSelectedIds] = useState<string | null>(null);
  const [isExecutingAutomation, setIsExecutingAutomation] = useState(false);
  const [reportData, setReportData] = useState<ExecutionResult[] | null>(null);
  const [excelDataByTestCase, setExcelDataByTestCase] = useState<Record<
    string,
    any[]
  > | null>(null);

  const toggleItemSelection = (id: string) => {
    setSelectedIds(id);
  };

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

        const { results, updatedRows } = await runExecutionFromDB(
          exeData,
          testCases,
          project.endpoints,
          variables,
          { type: "none" },
        );

        if (results.length > 0) {
          setReportData(results);
        }

        if (updatedRows && updatedRows.length > 0) {
          formatAndAppendSheet(
            workbook,
            updatedRows,
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
            title="Download Module Data"
          >
            <i className="fas fa-download text-sm mb-1"></i>
            <span className="text-[8px] font-bold uppercase">Download MTC</span>
          </button>

          <button
            onClick={() => {
              console.log("selectedIds");
              console.log(selectedIds);

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
            title="Download with Automation"
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
            title="Export Postman Collection"
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
            title="Export to Fireflink"
          >
            <i className="fas fa-external-link-alt text-sm mb-1"></i>
            <span className="text-[8px] font-bold uppercase">Fireflink</span>
          </button>

          <button
            onClick={handleDelete}
            disabled={!selectedIds || isExecuting}
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-rose-500/30"
            title="Delete Selected"
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
          <>
            <div className="space-y-1">
              {executionList.map((mod) => (
                <div
                  key={mod.id}
                  className={`flex flex-col p-3 rounded-lg border transition-colors ${
                    selectedIds === mod.id
                      ? "border-indigo-500 bg-indigo-500/5"
                      : "theme-border theme-bg-workbench/20 hover:theme-bg-surface"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="accent-indigo-500 rounded cursor-pointer"
                      checked={selectedIds === mod.id}
                      onChange={() => toggleItemSelection(mod.id)}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-bold theme-text-primary">
                        {mod.executionName ?? "Default Name"}
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

export default ExecutionPanel;
