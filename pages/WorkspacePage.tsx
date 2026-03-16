import React, { useState, useEffect } from "react";
import {
  SwaggerProject,
  ApiEndpoint,
  SavedTestCase,
  GlobalAuth,
  ExecutionResult,
} from "../types";
import Sidebar from "../components/Sidebar";
import Workbench from "../components/Workbench";
import TestCasesPanel from "../components/TestCasesPanel";
import VariablesPanel from "../components/VariablesPanel";
import ReportModal from "../components/ReportModal";
import AuthHeader from "../components/AuthHeader";
import { runAutomatedTests } from "../services/automationService";
import { generateMTCData } from "../utils/mtcGenerator";
import * as XLSX from "xlsx-js-style";

interface WorkspacePageProps {
  project: SwaggerProject;
  updateProject: (p: SwaggerProject) => void;
}

type WorkspaceTab = "saved" | "workbench" | "variables";

const WorkspacePage: React.FC<WorkspacePageProps> = ({
  project,
  updateProject,
}) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("saved");

  const [variables, setVariables] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(`apipro_vars_${project.id}`);
    return saved ? JSON.parse(saved) : {};
  });

  const [globalAuth, setGlobalAuth] = useState<GlobalAuth>(() => {
    const saved = localStorage.getItem(`apipro_auth_${project.id}`);
    return saved ? JSON.parse(saved) : { type: "none", isLocked: false };
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [reportData, setReportData] = useState<ExecutionResult[] | null>(null);
  const [excelDataByTestCase, setExcelDataByTestCase] = useState<Record<
    string,
    any[]
  > | null>(null);
  const [isExecutingAutomation, setIsExecutingAutomation] = useState(false);
  const [isGeneratingMTC, setIsGeneratingMTC] = useState(false);
  const [generatedMTCData, setGeneratedMTCData] = useState<
    Record<string, { rows: any[]; rawRows: any[] }>
  >({});

  useEffect(() => {
    localStorage.setItem(
      `apipro_vars_${project.id}`,
      JSON.stringify(variables),
    );
  }, [variables, project.id]);

  useEffect(() => {
    localStorage.setItem(
      `apipro_auth_${project.id}`,
      JSON.stringify(globalAuth),
    );
  }, [globalAuth, project.id]);

  useEffect(() => {
    // Auto-select first endpoint if none selected, but don't switch tab automatically
    if (project.endpoints.length > 0 && !selectedEndpoint) {
      setSelectedEndpoint(project.endpoints[0]);
    }
  }, [project, selectedEndpoint]);

  useEffect(() => {
    const spec = project.spec;
    const globalSecurity = spec.security || [];
    const securitySchemes =
      spec.components?.securitySchemes || spec.securityDefinitions || {};

    const findSchemeType = (securityReq: any) => {
      const schemeNames = Object.keys(securityReq);
      if (schemeNames.length === 0) return "none";
      const scheme = securitySchemes[schemeNames[0]];
      if (!scheme) return "none";

      if (scheme.type === "http" && scheme.scheme === "bearer") return "bearer";
      if (scheme.type === "oauth_1.0") return "bearer";
      if (scheme.type === "oauth_2.0") return "bearer";
      if (scheme.type === "http" && scheme.scheme === "basic") return "basic";
      if (scheme.type === "basic") return "basic";
      return "none";
    };

    let targetAuthType: GlobalAuth["type"] = "none";
    let isLocked = false;

    if (
      selectedEndpoint &&
      selectedEndpoint.security &&
      selectedEndpoint.security.length > 0
    ) {
      targetAuthType = findSchemeType(selectedEndpoint.security[0]);
      isLocked = targetAuthType !== "none";
    } else if (globalSecurity.length > 0) {
      targetAuthType = findSchemeType(globalSecurity[0]);
      isLocked = targetAuthType !== "none";
    }

    if (isLocked) {
      setGlobalAuth((prev) => ({
        ...prev,
        type: targetAuthType,
        isLocked: true,
      }));
    } else {
      setGlobalAuth((prev) => ({ ...prev, isLocked: false }));
    }
  }, [selectedEndpoint, project.spec]);

  const handleEndpointSelect = (endpoint: ApiEndpoint) => {
    setSelectedEndpoint(endpoint);
    setActiveTab("workbench");
  };

  const handleSaveTestCase = (testCase: SavedTestCase) => {
    const updatedProject = {
      ...project,
      savedTestCases: [...project.savedTestCases, testCase],
    };
    updateProject(updatedProject);
  };

  const handleUpdateVariables = (newVars: Record<string, string>) => {
    setVariables((prev) => ({ ...prev, ...newVars }));
  };

  const handleDeleteTestCases = (ids: string[]) => {
    const updatedProject = {
      ...project,
      savedTestCases: project.savedTestCases.filter(
        (tc) => !ids.includes(tc.id),
      ),
    };
    updateProject(updatedProject);
  };

  const handleRunAutomation = async (ids: string[]) => {
    if (ids.length === 0) return;
    setIsExecutingAutomation(true);

    try {
      const { results, excelDataByTestCase } = await runAutomatedTests(
        ids,
        project.savedTestCases,
        globalAuth,
        variables,
        project.endpoints,
      );

      setReportData(results);
      setExcelDataByTestCase(excelDataByTestCase);
      const workbook = XLSX.utils.book_new();
      let hasData = false;

      for (const id of ids) {
        const tc = project.savedTestCases.find((t) => t.id === id);
        if (!tc) continue;

        const endpoint = project.endpoints.find((e) => e.id === tc.endpointId);
        if (!endpoint) continue;

        let sheetRows = excelDataByTestCase[id];
        if (sheetRows && sheetRows.length > 0) {
          hasData = true;
          const columnsToCheck = [
            "Path Params",
            "Query Params",
            "Header Params",
          ];

          const authCol = Object.keys(sheetRows[0]).find((k) =>
            k.startsWith("Authorization"),
          );
          if (authCol) columnsToCheck.push(authCol);

          const payloadCol = Object.keys(sheetRows[0]).find((k) =>
            k.startsWith("Request Payload"),
          );
          if (payloadCol) columnsToCheck.push(payloadCol);

          columnsToCheck.forEach((col) => {
            const isEmpty = sheetRows.every(
              (row) => !row[col] || String(row[col]).trim() === "",
            );
            if (isEmpty) {
              sheetRows.forEach((row) => delete row[col]);
            }
          });

          const worksheet = XLSX.utils.json_to_sheet(sheetRows, {
            origin: "A4",
          });

          const moduleName = endpoint.tags?.[0] || "Default Module";
          const requestName = tc.name;

          XLSX.utils.sheet_add_aoa(
            worksheet,
            [
              ["Module Name", moduleName],
              ["Request Name", requestName],
            ],
            { origin: "A1" },
          );

          const colWidths: Record<string, number> = {
            "Sl No": 5,
            "End Point": 25,
            Set: 35,
            "Test Case Summary": 25,
            "Http Method": 15,
            "Path Params": 20,
            "Query Params": 20,
            "Header Params": 20,
            Authorization: 15,
            "Request Payload (form data)": 20,
            "Expected Result": 15,
            "Actual Result": 30,
            Status: 10,
            Comments: 20,
          };

          const wscols = Object.keys(sheetRows[0]).map((key) => ({
            wch: colWidths[key] || 20,
          }));
          worksheet["!cols"] = wscols;

          // Apply Styling
          const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");

          const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4F46E5" } }, // Indigo
            alignment: {
              vertical: "center",
              horizontal: "center",
              wrapText: true,
            },
            border: {
              top: { style: "thin", color: { rgb: "D1D5DB" } },
              bottom: { style: "thin", color: { rgb: "D1D5DB" } },
              left: { style: "thin", color: { rgb: "D1D5DB" } },
              right: { style: "thin", color: { rgb: "D1D5DB" } },
            },
          };

          const dataStyle = {
            alignment: { vertical: "top", wrapText: true },
            border: {
              top: { style: "thin", color: { rgb: "E5E7EB" } },
              bottom: { style: "thin", color: { rgb: "E5E7EB" } },
              left: { style: "thin", color: { rgb: "E5E7EB" } },
              right: { style: "thin", color: { rgb: "E5E7EB" } },
            },
          };

          const metaLabelStyle = {
            font: { bold: true, color: { rgb: "111827" } },
            fill: { fgColor: { rgb: "F3F4F6" } },
            alignment: { vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "D1D5DB" } },
              bottom: { style: "thin", color: { rgb: "D1D5DB" } },
              left: { style: "thin", color: { rgb: "D1D5DB" } },
              right: { style: "thin", color: { rgb: "D1D5DB" } },
            },
          };

          const metaValueStyle = {
            font: { bold: true, color: { rgb: "4F46E5" } },
            alignment: { vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "D1D5DB" } },
              bottom: { style: "thin", color: { rgb: "D1D5DB" } },
              left: { style: "thin", color: { rgb: "D1D5DB" } },
              right: { style: "thin", color: { rgb: "D1D5DB" } },
            },
          };

          for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
              const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
              if (!worksheet[cellAddress]) continue;

              if (R === 0 || R === 1) {
                // Meta rows (Module Name, Request Name)
                if (C === 0) {
                  worksheet[cellAddress].s = metaLabelStyle;
                } else if (C === 1) {
                  worksheet[cellAddress].s = metaValueStyle;
                }
              } else if (R === 3) {
                // Table Headers
                worksheet[cellAddress].s = headerStyle;
              } else if (R > 3) {
                // Data Rows
                worksheet[cellAddress].s = dataStyle;

                // Color code Status column
                if (R > 3) {
                  const headerCell = XLSX.utils.encode_cell({ r: 3, c: C });
                  if (
                    worksheet[headerCell] &&
                    worksheet[headerCell].v === "Status"
                  ) {
                    if (worksheet[cellAddress].v === "Pass") {
                      worksheet[cellAddress].s = {
                        ...dataStyle,
                        font: { color: { rgb: "10B981" }, bold: true },
                      };
                    } else if (worksheet[cellAddress].v === "Fail") {
                      worksheet[cellAddress].s = {
                        ...dataStyle,
                        font: { color: { rgb: "EF4444" }, bold: true },
                      };
                    }
                  }
                }
              }
            }
          }

          let sheetName = requestName
            .replace(/[\\/?*[\]:]/g, "_")
            .substring(0, 31);
          if (!sheetName) sheetName = "Sheet";

          let finalSheetName = sheetName;
          let counter = 1;
          while (workbook.SheetNames.includes(finalSheetName)) {
            finalSheetName = `${sheetName.substring(0, 28)}_${counter}`;
            counter++;
          }

          XLSX.utils.book_append_sheet(workbook, worksheet, finalSheetName);
        }
      }

      if (hasData) {
        XLSX.writeFile(
          workbook,
          `${project.name.replace(/\s+/g, "_")}_Execution_Report.xlsx`,
        );
      }
    } catch (e) {
      console.error("Automation Error:", e);
      alert("An error occurred while running automation.");
    } finally {
      setIsExecutingAutomation(false);
    }
  };

  const handleGenerateMTC = async (ids: string[]) => {
    if (ids.length === 0) return;

    setIsGeneratingMTC(true);

    try {
      const workbook = XLSX.utils.book_new();
      let hasData = false;

      const getExecutionPlan = (
        tc: SavedTestCase,
        visited = new Set<string>(),
      ): SavedTestCase[] => {
        if (visited.has(tc.id)) return [];
        visited.add(tc.id);

        let plan: SavedTestCase[] = [];
        if (tc.dependentOn) {
          const dep = project.savedTestCases.find(
            (t) => t.id === tc.dependentOn,
          );
          if (dep) {
            plan = plan.concat(getExecutionPlan(dep, visited));
          }
        }
        plan.push(tc);
        return plan;
      };

      const testCasesToProcess: SavedTestCase[] = [];
      const processedIds = new Set<string>();

      for (const id of ids) {
        const tc = project.savedTestCases.find((t) => t.id === id);
        if (!tc) continue;

        const plan = getExecutionPlan(tc);
        for (const planTc of plan) {
          if (!processedIds.has(planTc.id)) {
            testCasesToProcess.push(planTc);
            processedIds.add(planTc.id);
          }
        }
      }
      const newGeneratedMTCData = { ...generatedMTCData };

      for (const tc of testCasesToProcess) {
        const endpoint = project.endpoints.find((e) => e.id === tc.endpointId);
        if (!endpoint) continue;

        const result = generateMTCData(tc, endpoint, 1, variables);
        newGeneratedMTCData[tc.id] = result;
        let sheetRows = result.rows;

        if (sheetRows.length > 0) {
          hasData = true;
          const columnsToCheck = [
            "Path Params",
            "Query Params",
            "Header Params",
          ];

          const authCol = Object.keys(sheetRows[0]).find((k) =>
            k.startsWith("Authorization"),
          );
          if (authCol) columnsToCheck.push(authCol);

          const payloadCol = Object.keys(sheetRows[0]).find((k) =>
            k.startsWith("Request Payload"),
          );
          if (payloadCol) columnsToCheck.push(payloadCol);

          columnsToCheck.forEach((col) => {
            const isEmpty = sheetRows.every(
              (row) => !row[col] || String(row[col]).trim() === "",
            );
            if (isEmpty) {
              sheetRows.forEach((row) => delete row[col]);
            }
          });

          const worksheet = XLSX.utils.json_to_sheet(sheetRows, {
            origin: "A4",
          });

          const moduleName = endpoint.tags?.[0] || "Default Module";
          const requestName = tc.name;

          XLSX.utils.sheet_add_aoa(
            worksheet,
            [
              ["Module Name", moduleName],
              ["Request Name", requestName],
            ],
            { origin: "A1" },
          );

          const colWidths: Record<string, number> = {
            "Sl No": 5,
            "End Point": 25,
            Set: 35,
            "Test Case Summary": 25,
            "Http Method": 15,
            "Path Params": 20,
            "Query Params": 20,
            "Header Params": 20,
            Authorization: 15,
            "Request Payload (form data)": 20,
            "Expected Result": 15,
            "Actual Result": 15,
            Status: 10,
            Comments: 20,
          };

          const wscols = Object.keys(sheetRows[0]).map((key) => ({
            wch: colWidths[key] || 20,
          }));
          worksheet["!cols"] = wscols;

          // Apply Styling
          const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");

          const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4F46E5" } }, // Indigo
            alignment: {
              vertical: "center",
              horizontal: "center",
              wrapText: true,
            },
            border: {
              top: { style: "thin", color: { rgb: "D1D5DB" } },
              bottom: { style: "thin", color: { rgb: "D1D5DB" } },
              left: { style: "thin", color: { rgb: "D1D5DB" } },
              right: { style: "thin", color: { rgb: "D1D5DB" } },
            },
          };

          const dataStyle = {
            alignment: { vertical: "top", wrapText: true },
            border: {
              top: { style: "thin", color: { rgb: "E5E7EB" } },
              bottom: { style: "thin", color: { rgb: "E5E7EB" } },
              left: { style: "thin", color: { rgb: "E5E7EB" } },
              right: { style: "thin", color: { rgb: "E5E7EB" } },
            },
          };

          const metaLabelStyle = {
            font: { bold: true, color: { rgb: "111827" } },
            fill: { fgColor: { rgb: "F3F4F6" } },
            alignment: { vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "D1D5DB" } },
              bottom: { style: "thin", color: { rgb: "D1D5DB" } },
              left: { style: "thin", color: { rgb: "D1D5DB" } },
              right: { style: "thin", color: { rgb: "D1D5DB" } },
            },
          };

          const metaValueStyle = {
            font: { bold: true, color: { rgb: "4F46E5" } },
            alignment: { vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "D1D5DB" } },
              bottom: { style: "thin", color: { rgb: "D1D5DB" } },
              left: { style: "thin", color: { rgb: "D1D5DB" } },
              right: { style: "thin", color: { rgb: "D1D5DB" } },
            },
          };

          for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
              const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
              if (!worksheet[cellAddress]) continue;

              if (R === 0 || R === 1) {
                // Meta rows (Module Name, Request Name)
                if (C === 0) {
                  worksheet[cellAddress].s = metaLabelStyle;
                } else if (C === 1) {
                  worksheet[cellAddress].s = metaValueStyle;
                }
              } else if (R === 3) {
                // Table Headers
                worksheet[cellAddress].s = headerStyle;
              } else if (R > 3) {
                // Data Rows
                worksheet[cellAddress].s = dataStyle;
              }
            }
          }

          let sheetName = requestName
            .replace(/[\\/?*[\]:]/g, "_")
            .substring(0, 31);
          if (!sheetName) sheetName = "Sheet";

          let finalSheetName = sheetName;
          let counter = 1;
          while (workbook.SheetNames.includes(finalSheetName)) {
            finalSheetName = `${sheetName.substring(0, 28)}_${counter}`;
            counter++;
          }

          XLSX.utils.book_append_sheet(workbook, worksheet, finalSheetName);
        }
      }

      if (hasData) {
        setGeneratedMTCData(newGeneratedMTCData);
        XLSX.writeFile(
          workbook,
          `${project.name.replace(/\s+/g, "_")}_MTC.xlsx`,
        );
      } else {
        alert("No Test Cases were generated. Please try again.");
      }
    } catch (error) {
      console.error("MTC Generation failed", error);
      alert("An error occurred during generation.");
    } finally {
      setIsGeneratingMTC(false);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Panel: Explorer */}
      <div
        className={`${isSidebarCollapsed ? "w-12" : "w-72"} border-r theme-border flex flex-col transition-all theme-bg-surface/50 shrink-0`}
      >
        <div className="p-3 border-b theme-border flex items-center justify-between">
          {!isSidebarCollapsed && (
            <span className="font-semibold text-sm">Explorer</span>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1 hover:bg-white/10 rounded"
          >
            <i
              className={`fas fa-${isSidebarCollapsed ? "chevron-right" : "chevron-left"} theme-text-secondary`}
            ></i>
          </button>
        </div>
        {!isSidebarCollapsed && (
          <Sidebar
            endpoints={project.endpoints}
            selectedId={selectedEndpoint?.id || ""}
            onSelect={handleEndpointSelect}
          />
        )}
      </div>

      {/* Right Panel: Tabbed Interface */}
      <div className="flex-1 flex flex-col min-w-0 theme-bg-workbench">
        {/* Top Bar with Tabs and Auth */}
        <div className="flex items-center justify-between border-b theme-border bg-white/5">
          <div className="flex">
            <button
              onClick={() => setActiveTab("saved")}
              className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === "saved"
                  ? "border-indigo-500 theme-accent-text theme-bg-surface"
                  : "border-transparent theme-text-secondary hover:theme-text-primary hover:bg-white/5"
              }`}
            >
              <i className="fas fa-list-check mr-2"></i>
              Saved Scenarios
            </button>
            <button
              onClick={() => setActiveTab("workbench")}
              className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === "workbench"
                  ? "border-indigo-500 theme-accent-text theme-bg-surface"
                  : "border-transparent theme-text-secondary hover:theme-text-primary hover:bg-white/5"
              }`}
            >
              <i className="fas fa-flask mr-2"></i>
              Workbench
            </button>
            <button
              onClick={() => setActiveTab("variables")}
              className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === "variables"
                  ? "border-indigo-500 theme-accent-text theme-bg-surface"
                  : "border-transparent theme-text-secondary hover:theme-text-primary hover:bg-white/5"
              }`}
            >
              <i className="fas fa-code mr-2"></i>
              Variables
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden relative">
          {/* Saved Scenarios Tab */}
          <div
            className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${activeTab === "saved" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}
          >
            <TestCasesPanel
              testCases={project.savedTestCases}
              onDelete={handleDeleteTestCases}
              onGenerateMTC={handleGenerateMTC}
              onRunAutomation={handleRunAutomation}
              isExecuting={isExecutingAutomation}
              isGeneratingMTC={isGeneratingMTC}
              project={project}
              generatedMTCData={generatedMTCData}
            />
          </div>

          {/* Workbench Tab */}
          <div
            className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${activeTab === "workbench" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}
          >
            {selectedEndpoint ? (
              <Workbench
                endpoint={selectedEndpoint}
                baseUrl={project.baseUrl}
                variables={variables}
                globalAuth={globalAuth}
                spec={project.spec}
                savedTestCases={project.savedTestCases}
                setGlobalAuth={setGlobalAuth}
                onVariablesChange={handleUpdateVariables}
                onSave={handleSaveTestCase}
              />
            ) : (
              <div className="h-full flex items-center justify-center theme-text-secondary">
                <div className="text-center">
                  <i className="fas fa-rocket text-5xl mb-4 opacity-10"></i>
                  <p>
                    Select an API endpoint from the Explorer to start testing
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Variables Tab */}
          <div
            className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${activeTab === "variables" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}
          >
            <VariablesPanel
              variables={variables}
              onVariablesChange={handleUpdateVariables}
            />
          </div>
        </div>
      </div>

      {reportData && excelDataByTestCase && (
        <ReportModal
          results={reportData}
          project={project}
          ids={Object.keys(excelDataByTestCase)}
          excelDataByTestCase={excelDataByTestCase}
          onClose={() => {
            setReportData(null);
            setExcelDataByTestCase(null);
          }}
        />
      )}
    </div>
  );
};

export default WorkspacePage;
