import React, { useState, useEffect, use } from "react";
import { toast } from "react-hot-toast";
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
import ModulesPanel from "../components/ModulesPanel";
import ReportModal from "../components/ReportModal";
import {
  runAutomatedTests,
  applySubstitutionsToExcelRow,
} from "../services/automationService";
import { generateMTCData, substituteVariables } from "../utils/mtcGenerator";
import { formatAndAppendSheet } from "../utils/excelFormatter";
import * as XLSX from "xlsx-js-style";
import { BASE_URL } from "./LandingPage";

interface WorkspacePageProps {
  project: SwaggerProject;
}

type WorkspaceTab = "saved" | "workbench" | "variables" | "execution";

const WorkspacePage: React.FC<WorkspacePageProps> = ({ project }) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("saved");
  const [testCases, setTestCases] = useState<SavedTestCase[] | []>([]);
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
    getEndpointList();
  }, []);

  const getEndpointList = async () => {
    const data: any = await fetch(`${BASE_URL}/endpoint/all`, {
      method: "GET",
    });
    const response = await data.json();

    if (response.responseCode === 200) {
      setTestCases(response.responseObject);
    } else {
      console.error("Failed to fetch saved scenarios");
    }
  };

  const getAllEndpoint = async () => {
    const data: any = await fetch(`${BASE_URL}/endpoint/all`, {
      method: "GET",
    });
    const response = await data.json();

    if (response.responseCode === 200) {
      setTestCases(response.responseObject);
    } else {
      console.error("Failed to fetch saved scenarios");
    }
  };

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

  const handleUpdateVariables = (newVars: Record<string, string>) => {
    setVariables((prev) => ({ ...prev, ...newVars }));
  };

  const handleDeleteTestCases = (ids: string[]) => {};

  const handleSaveExecution = (name: any) => {
    toast.success("Module saved successfully!");
  };

  const handleDeleteModules = (ids: string[]) => {
    const updatedProject = {
      ...project,
      savedModules: (project.savedModules || []).filter(
        (m) => !ids.includes(m.id),
      ),
    };
    toast.success("Modules deleted successfully!");
  };

  const handleDownloadModule = async (id: string, withAutomation: boolean) => {
    const mod = project.savedModules?.find((m) => m.id === id);
    if (!mod) return;

    const getDependenciesString = (
      tcId: string,
      visited = new Set<string>(),
    ): string[] => {
      if (visited.has(tcId)) return [];
      visited.add(tcId);
      const tc = project.savedTestCases.find((t) => t.id === tcId);
      if (tc && tc.dependentId) {
        const dep = project.savedTestCases.find(
          (t) => t.id === tc.dependentId[0],
        );
        if (dep) {
          return [...getDependenciesString(dep.id, visited), dep.endpointName];
        }
      }
      return [];
    };

    if (withAutomation) {
      setIsExecutingAutomation(true);
      try {
        const {
          results,
          excelDataByTestCase: autoExcelData,
          updatedVariables,
        } = await runAutomatedTests(
          mod.testCaseIds,
          project.savedTestCases,
          globalAuth,
          variables,
          project.endpoints,
          mod.mtcData,
        );

        setVariables(updatedVariables);

        const workbook = XLSX.utils.book_new();
        let hasData = false;

        let allTcIds = Object.keys(mod.mtcData);
        const sortedIds: string[] = [];
        const visited = new Set<string>();

        const visit = (tcId: string) => {
          if (visited.has(tcId)) return;
          const tc = project.savedTestCases.find((t) => t.id === tcId);
          if (tc && tc.dependentId && allTcIds.includes(tc.dependentId[0])) {
            visit(tc.dependentId[0]);
          }
          visited.add(tcId);
          sortedIds.push(tcId);
        };

        allTcIds.forEach(visit);
        allTcIds = sortedIds;

        for (const tcId of allTcIds) {
          const tc = project.savedTestCases.find((t) => t.id === tcId);
          if (!tc) continue;

          const endpoint = project.endpoints.find((e) => e.id === tc.id);
          if (!endpoint) continue;

          let sheetRows = autoExcelData[tcId] || [];
          if (sheetRows.length > 0) {
            hasData = true;
            const moduleName = endpoint.tags?.[0] || "Default Module";
            const clonedRows = sheetRows.map((row: any) => ({ ...row }));
            const deps = getDependenciesString(tc.id);
            const depsString = deps.length > 0 ? deps.join(", ") : "None";
            formatAndAppendSheet(
              workbook,
              clonedRows,
              moduleName,
              tc.endpointName,
              depsString,
            );
          }
        }

        if (results.length > 0) {
          setReportData(results);
          setExcelDataByTestCase(autoExcelData);
        }

        if (hasData) {
          XLSX.writeFile(
            workbook,
            `${mod.name.replace(/\s+/g, "_")}_Automation_Report.xlsx`,
          );
          toast.success("Module automation report downloaded!");
        } else {
          toast.error("No data to download.");
        }
      } catch (e) {
        console.error("Automation Error:", e);
        toast.error("An error occurred while running automation.");
      } finally {
        setIsExecutingAutomation(false);
      }
    } else {
      // Download MTC data only
      const workbook = XLSX.utils.book_new();
      let hasData = false;

      // Use all keys in mtcData to include dependencies that were saved
      let allTcIds = Object.keys(mod.mtcData);

      // Sort topologically so dependencies come first
      const sortedIds: string[] = [];
      const visited = new Set<string>();

      const visit = (tcId: string) => {
        if (visited.has(tcId)) return;
        const tc = project.savedTestCases.find((t) => t.id === tcId);
        if (tc && tc.dependentId[0] && allTcIds.includes(tc.dependentId[0])) {
          visit(tc.dependentId[0]);
        }
        visited.add(tcId);
        sortedIds.push(tcId);
      };

      allTcIds.forEach(visit);
      allTcIds = sortedIds;

      for (const tcId of allTcIds) {
        const tc = project.savedTestCases.find((t) => t.id === tcId);
        if (!tc) continue;

        const endpoint = project.endpoints.find((e) => e.id === tc.id);
        if (!endpoint) continue;

        const mtcData = mod.mtcData[tcId];
        if (mtcData && mtcData.rows.length > 0) {
          hasData = true;
          const moduleName = endpoint.tags?.[0] || "Default Module";

          const getExecutionPlan = (
            tId: string,
            v = new Set<string>(),
          ): string[] => {
            if (v.has(tId)) return [];
            v.add(tId);
            const t = project.savedTestCases.find((x) => x.id === tId);
            if (!t) return [];
            let plan: string[] = [];
            if (t.dependentId[0]) {
              plan = plan.concat(getExecutionPlan(t.dependentId[0], v));
            }
            plan.push(tId);
            return plan;
          };

          const planIds = getExecutionPlan(tcId);
          const depIds = planIds.slice(0, planIds.length - 1);

          const interleavedRows: any[] = [];
          let currentSlNo = 1;

          for (let i = 0; i < mtcData.rows.length; i++) {
            // Add dependency rows first
            for (const dId of depIds) {
              const dData = mod.mtcData[dId];
              if (dData && dData.rows.length > 0) {
                const dRow = { ...dData.rows[0] };
                dRow["Sl No"] = currentSlNo++;
                dRow["Test Case Summary"] =
                  `[Dependency] ${dRow["Test Case Summary"]}`;
                applySubstitutionsToExcelRow(dRow, variables);
                interleavedRows.push(dRow);
              }
            }
            // Add target row
            const tRow = { ...mtcData.rows[i] };
            tRow["Sl No"] = currentSlNo++;
            applySubstitutionsToExcelRow(tRow, variables);
            interleavedRows.push(tRow);
          }

          const deps = getDependenciesString(tc.id);
          const depsString = deps.length > 0 ? deps.join(", ") : "None";
          formatAndAppendSheet(
            workbook,
            interleavedRows,
            moduleName,
            tc.endpointName,
            depsString,
          );
        }
      }

      if (hasData) {
        XLSX.writeFile(workbook, `${mod.name.replace(/\s+/g, "_")}_MTC.xlsx`);
        toast.success("Module MTC data downloaded!");
      } else {
        toast.error("No MTC data found for this module.");
      }
    }
  };

  const handleExportModulePostman = (id: string) => {
    const mod = project.savedModules?.find((m) => m.id === id);
    if (!mod) return;

    const items: any[] = [];

    // Use all keys in mtcData to include dependencies that were saved
    let allTcIds = Object.keys(mod.mtcData);

    // Sort topologically so dependencies come first
    const sortedIds: string[] = [];
    const visited = new Set<string>();

    const visit = (tcId: string) => {
      if (visited.has(tcId)) return;
      const tc = project.savedTestCases.find((t) => t.id === tcId);
      if (tc && tc.dependentId[0] && allTcIds.includes(tc.dependentId[0])) {
        visit(tc.dependentId[0]);
      }
      visited.add(tcId);
      sortedIds.push(tcId);
    };

    allTcIds.forEach(visit);
    allTcIds = sortedIds;

    allTcIds.forEach((tcId) => {
      const tc = project.savedTestCases.find((t) => t.id === tcId);
      if (!tc) return;

      const mtcData = mod.mtcData[tcId];
      if (mtcData && mtcData.rawRows && mtcData.rawRows.length > 0) {
        mtcData.rawRows.forEach((rawRow) => {
          const baseUrl = tc.request.url.split("/").slice(0, 3).join("/");
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
            name: `${tc.endpointName} - ${rawRow.set} - ${rawRow.summary}`,
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
          name: tc.endpointName,
          request: {
            method: tc.request.method.toUpperCase(),
            header: Object.entries(tc.request.headers)
              .filter(([_, v]) => v)
              .map(([k, v]) => ({ key: k, value: v })),
            body: {
              mode: "raw",
              raw: tc.request.body,
            },
            url: {
              raw: tc.request.url,
              host: [tc.request.url.split("/")[2]],
              path: tc.request.url.split("/").slice(3),
            },
          },
          response: [],
        });
      }
    });

    const postman = {
      info: {
        name: `${mod.name} - Postman Export`,
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
    a.download = `${mod.name.replace(/\s+/g, "_")}_postman.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportModuleFireflink = (id: string) => {
    const mod = project.savedModules?.find((m) => m.id === id);
    if (!mod) return;

    const workbook = XLSX.utils.book_new();
    const fireflinkData: any[] = [];

    // Use all keys in mtcData to include dependencies that were saved
    let allTcIds = Object.keys(mod.mtcData);

    // Sort topologically so dependencies come first
    const sortedIds: string[] = [];
    const visited = new Set<string>();

    const visit = (tcId: string) => {
      if (visited.has(tcId)) return;
      const tc = project.savedTestCases.find((t) => t.id === tcId);
      if (tc && tc.dependentId[0] && allTcIds.includes(tc.dependentId[0])) {
        visit(tc.dependentId[0]);
      }
      visited.add(tcId);
      sortedIds.push(tcId);
    };

    allTcIds.forEach(visit);
    allTcIds = sortedIds;

    allTcIds.forEach((tcId) => {
      const tc = project.savedTestCases.find((t) => t.id === tcId);
      if (!tc) return;

      const mtcData = mod.mtcData[tcId];
      if (mtcData && mtcData.rawRows && mtcData.rawRows.length > 0) {
        mtcData.rawRows.forEach((rawRow) => {
          fireflinkData.push({
            "Test Case Name": `${tc.endpointName} - ${rawRow.summary}`,
            "Module Name": mod.name,
            "HTTP Method": rawRow.httpMethod.toUpperCase(),
            "Endpoint URL":
              tc.request.url.split("/").slice(0, 3).join("/") + rawRow.endPoint,
            Headers: JSON.stringify(rawRow.headerParams || {}),
            "Query Parameters": JSON.stringify(rawRow.queryParams || {}),
            "Request Body": rawRow.payload || "",
            "Expected Status": rawRow.expectedStatus || "200",
          });
        });
      } else {
        fireflinkData.push({
          "Test Case Name": tc.endpointName,
          "Module Name": mod.name,
          "HTTP Method": tc.request.method.toUpperCase(),
          "Endpoint URL": tc.request.url,
          Headers: JSON.stringify(tc.request.headers || {}),
          "Query Parameters": "",
          "Request Body": tc.request.body || "",
          "Expected Status": "200",
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(fireflinkData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fireflink_Data");
    XLSX.writeFile(workbook, `${mod.name.replace(/\s+/g, "_")}_fireflink.xlsx`);
    toast.success("Module exported to Fireflink format!");
  };

  const handleGenerateMTC = async (ids: string[]) => {
    if (!testCases || ids.length === 0) {
      return false;
    }

    setIsGeneratingMTC(true);

    try {
      let hasData = false;

      const getExecutionPlan = (
        tc: SavedTestCase,
        visited = new Set<string>(),
      ): SavedTestCase[] => {
        if (visited.has(tc.id)) return [];
        visited.add(tc.id);

        let plan: SavedTestCase[] = [];
        if (tc.dependentId[0]) {
          const dep = project.savedTestCases.find(
            (t) => t.id === tc.dependentId[0],
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
        const tc = testCases.find((t) => t.id === id);
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
        const endpoint = project.endpoints.find((e) => e.id === tc.apiId);
        if (!endpoint) continue;

        const result = generateMTCData(tc, endpoint, 1, variables);
        newGeneratedMTCData[tc.id] = result;
        let sheetRows = result.rows;

        if (sheetRows.length > 0) {
          hasData = true;
        }
      }
      if (hasData) {
        setGeneratedMTCData(newGeneratedMTCData);
        return true;
      } else {
        toast.error("No Test Cases were generated. Please try again.");
        return false;
      }
    } catch (error) {
      console.error("MTC Generation failed", error);
      toast.error("An error occurred during generation.");
      return false;
    } finally {
      setIsGeneratingMTC(false);
    }
  };

  const getUrl = () => {
    return project.baseUrl.lastIndexOf("/") === project.baseUrl.length - 1
      ? project.baseUrl.slice(0, -1)
      : project.baseUrl;
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
            className="p-1 hover:theme-bg-surface rounded"
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
        <div className="flex items-center justify-between border-b theme-border theme-bg-main">
          <div className="flex">
            <button
              onClick={() => {
                setActiveTab("saved");
                getEndpointList();
              }}
              className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === "saved"
                  ? "border-indigo-500 theme-accent-text theme-bg-surface"
                  : "border-transparent theme-text-secondary hover:theme-text-primary hover:theme-bg-surface"
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
                  : "border-transparent theme-text-secondary hover:theme-text-primary hover:theme-bg-surface"
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
                  : "border-transparent theme-text-secondary hover:theme-text-primary hover:theme-bg-surface"
              }`}
            >
              <i className="fas fa-code mr-2"></i>
              Variables
            </button>
            <button
              onClick={() => setActiveTab("execution")}
              className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === "execution"
                  ? "border-indigo-500 theme-accent-text theme-bg-surface"
                  : "border-transparent theme-text-secondary hover:theme-text-primary hover:theme-bg-surface"
              }`}
            >
              <i className="fas fa-cubes mr-2"></i>
              Execution
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden relative">
          {/* Saved Scenarios Tab */}
          <div
            className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${activeTab === "saved" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}
          >
            {testCases && (
              <TestCasesPanel
                testCases={testCases}
                onGenerateMTC={handleGenerateMTC}
                onSaveModule={handleSaveExecution}
                isGeneratingMTC={isGeneratingMTC}
                getEndpointList={getEndpointList}
                project={project}
                generatedMTCData={generatedMTCData}
              />
            )}
          </div>

          {/* Workbench Tab */}
          <div
            className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${activeTab === "workbench" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}
          >
            {selectedEndpoint ? (
              <Workbench
                endpoint={selectedEndpoint}
                setSelectedEndpoint={setSelectedEndpoint}
                baseUrl={getUrl()}
                variables={variables}
                globalAuth={globalAuth}
                spec={project.spec}
                savedTestCases={testCases}
                setGlobalAuth={setGlobalAuth}
                onVariablesChange={handleUpdateVariables}
                getEndpointList={getEndpointList}
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

          {/* Modules Tab */}
          <div
            className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${activeTab === "execution" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}
          >
            <ModulesPanel
              modules={project.savedModules || []}
              project={project}
              onDelete={handleDeleteModules}
              onDownload={handleDownloadModule}
              onExportPostman={handleExportModulePostman}
              onExportFireflink={handleExportModuleFireflink}
              isExecuting={isExecutingAutomation}
            />
          </div>
        </div>
      </div>

      {reportData && excelDataByTestCase && (
        <ReportModal
          results={reportData}
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
