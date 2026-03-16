import {
  SavedTestCase,
  ExecutionResult,
  GlobalAuth,
  ApiEndpoint,
} from "../types";
import { generateMTCData } from "../utils/mtcGenerator";

// Helper to substitute variables {{key}} -> value
const substituteVariables = (
  str: string,
  vars: Record<string, string>,
): string => {
  if (typeof str !== "string") return str;
  let result = str.replace(
    /\{\{(.+?)\}\}/g,
    (_, key) => vars[key] || `{{${key}}}`,
  );
  result = result.replace(/\$([a-zA-Z0-9_]+)/g, (match, key) =>
    vars[key] !== undefined ? vars[key] : match,
  );
  result = result.replace(/\$\{([^}]+)\}/g, (match, key) =>
    vars[key] !== undefined ? vars[key] : match,
  );
  return result;
};

export const runAutomatedTests = async (
  testCaseIds: string[],
  allTestCases: SavedTestCase[],
  globalAuth: GlobalAuth,
  variables: Record<string, string>,
  endpoints: ApiEndpoint[],
  generatedMTCData: Record<string, { rows: any[]; rawRows: any[] }>,
): Promise<{
  results: ExecutionResult[];
  excelDataByTestCase: Record<string, any[]>;
}> => {
  const results: ExecutionResult[] = [];
  const excelDataByTestCase: Record<string, any[]> = {};
  const targetCases = allTestCases.filter((tc) => testCaseIds.includes(tc.id));

  // Create a mutable copy of variables to persist across scenarios
  let currentVariables = { ...variables };

  const getExecutionPlan = (
    tc: SavedTestCase,
    visited = new Set<string>(),
  ): SavedTestCase[] => {
    if (visited.has(tc.id)) return [];
    visited.add(tc.id);

    let plan: SavedTestCase[] = [];
    if (tc.dependentOn) {
      const dep = allTestCases.find((t) => t.id === tc.dependentOn);
      if (dep) {
        plan = plan.concat(getExecutionPlan(dep, visited));
      }
    }
    plan.push(tc);
    return plan;
  };

  for (const testCase of targetCases) {
    const plan = getExecutionPlan(testCase);
    const targetTc = plan[plan.length - 1];
    const dependencies = plan.slice(0, plan.length - 1);

    const targetEndpoint = endpoints.find((e) => e.id === targetTc.endpointId);
    if (!targetEndpoint) {
      console.warn(`Endpoint not found for test case ${targetTc.name}`);
      continue;
    }

    try {
      // Generate once to get the number of scenarios
      const dummyMtcData = generateMTCData(
        targetTc,
        targetEndpoint,
        1,
        currentVariables,
      );
      const scenarioCount = dummyMtcData.rawRows.length;

      const tcExcelData: any[] = [];
      let currentSlNo = 1;

      for (let i = 0; i < scenarioCount; i++) {
        // 1. Run dependencies (Happy Flow only)
        for (const depTc of dependencies) {
          const depEndpoint = endpoints.find((e) => e.id === depTc.endpointId);
          if (!depEndpoint) continue;

          const depMtcData = generateMTCData(
            depTc,
            depEndpoint,
            currentSlNo,
            currentVariables,
          );
          if (depMtcData.rawRows.length === 0) continue;

          const depRawRow = depMtcData.rawRows[0];
          const depExcelRow = depMtcData.rows[0];

          try {
            const depResult = await executeMTCScenario(
              depTc,
              depRawRow,
              globalAuth,
              currentVariables,
            );

            if (depResult.capturedData) {
              depResult.capturedData.forEach((c) => {
                currentVariables[c.variableName] = c.value;
              });
            }

            depResult.testCaseName = `[Dependency] ${depResult.testCaseName}`;
            results.push(depResult);

            depExcelRow["Actual Result"] = depResult.statusCode
              ? `Status: ${depResult.statusCode}\n${String(depResult.response.body).substring(0, 100)}...`
              : depResult.statusText;
            depExcelRow["Status"] =
              depResult.status === "pass" ? "Pass" : "Fail";

            if (depResult.status === "pass") {
              depExcelRow["Comments"] = "Dependency passed successfully.";
            } else {
              depExcelRow["Comments"] =
                `Dependency failed. Expected: ${depRawRow.expected}, Actual: ${depResult.statusCode}`;
            }

            tcExcelData.push(depExcelRow);
            currentSlNo++;
          } catch (e) {
            console.error(
              `Failed to execute dependency ${depRawRow.summary}`,
              e,
            );
            depExcelRow["Actual Result"] = "Execution Error";
            depExcelRow["Status"] = "Fail";
            depExcelRow["Comments"] =
              `Execution error: ${e instanceof Error ? e.message : String(e)}`;
            tcExcelData.push(depExcelRow);
            currentSlNo++;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // 2. Run target scenario
        const freshTargetMtcData = generateMTCData(
          targetTc,
          targetEndpoint,
          currentSlNo,
          currentVariables,
        );
        if (i >= freshTargetMtcData.rawRows.length) continue;

        const rawRow = freshTargetMtcData.rawRows[i];
        const excelRow = freshTargetMtcData.rows[i];

        // Fix Sl No since we are picking the i-th row
        excelRow["Sl No"] = currentSlNo;
        rawRow.slNo = currentSlNo;

        try {
          const result = await executeMTCScenario(
            targetTc,
            rawRow,
            globalAuth,
            currentVariables,
          );

          if (result.capturedData) {
            result.capturedData.forEach((c) => {
              currentVariables[c.variableName] = c.value;
            });
          }

          results.push(result);

          excelRow["Actual Result"] = result.statusCode
            ? `Status: ${result.statusCode}\n${String(result.response.body).substring(0, 100)}...`
            : result.statusText;
          excelRow["Status"] = result.status === "pass" ? "Pass" : "Fail";

          if (result.status === "pass") {
            excelRow["Comments"] = "Test case passed successfully.";
          } else if (result.status === "fail") {
            excelRow["Comments"] =
              `Test case failed. Expected status code: ${rawRow.expected}, Actual: ${result.statusCode}`;
          } else {
            excelRow["Comments"] = `Execution error: ${result.response.body}`;
          }

          tcExcelData.push(excelRow);
          currentSlNo++;
        } catch (e) {
          console.error(`Failed to execute scenario ${rawRow.summary}`, e);
          excelRow["Actual Result"] = "Execution Error";
          excelRow["Status"] = "Fail";
          excelRow["Comments"] =
            `Execution error: ${e instanceof Error ? e.message : String(e)}`;
          tcExcelData.push(excelRow);
          currentSlNo++;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (!excelDataByTestCase[testCase.id]) {
        excelDataByTestCase[testCase.id] = [];
      }
      excelDataByTestCase[testCase.id].push(...tcExcelData);
    } catch (err) {
      console.error(`Failed to generate MTCs for ${targetTc.name}`, err);
    }
  }

  return { results, excelDataByTestCase };
};

const executeMTCScenario = async (
  tc: SavedTestCase,
  rawRow: any,
  globalAuth: GlobalAuth,
  variables: Record<string, string>,
): Promise<ExecutionResult> => {
  const startTime = performance.now();

  // 1. Construct URL
  let finalUrl = tc.url;
  try {
    const urlObj = new URL(substituteVariables(finalUrl, variables));
    // Replace path params in URL
    let path = urlObj.pathname;
    Object.entries(rawRow.pathParams).forEach(([k, v]) => {
      path = path.replace(`{${k}}`, String(v));
    });
    urlObj.pathname = path;

    // Add query params
    Object.entries(rawRow.queryParams).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== "") {
        urlObj.searchParams.set(k, String(v));
      }
    });
    finalUrl = urlObj.toString();
  } catch (e) {
    console.warn("Could not parse URL object", e);
  }

  // 2. Prepare Headers
  const headers = new Headers();
  Object.entries(rawRow.headerParams).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== "") {
      headers.append(k, substituteVariables(String(v), variables));
    }
  });

  // Apply Global Auth if needed
  if (globalAuth.type === "bearer" && globalAuth.bearerToken) {
    headers.set("Authorization", `Bearer ${globalAuth.bearerToken}`);
  } else if (
    globalAuth.type === "apikey" &&
    globalAuth.apiKey &&
    globalAuth.apiKeyValue
  ) {
    headers.set(globalAuth.apiKey, globalAuth.apiKeyValue);
  } else if (
    globalAuth.type === "basic" &&
    globalAuth.username &&
    globalAuth.password
  ) {
    const creds = btoa(`${globalAuth.username}:${globalAuth.password}`);
    headers.set("Authorization", `Basic ${creds}`);
  }

  let body = rawRow.payload;
  if (body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const plainHeaders: Record<string, string> = {};
  headers.forEach((v, k) => {
    plainHeaders[k] = v;
  });

  const proxyPayload = {
    method: rawRow.httpMethod,
    url: finalUrl,
    headers: plainHeaders,
    data: body,
  };

  let responseBody: any;
  let statusCode = 0;
  let statusText = "";
  let status = "error";
  let resHeaders: Record<string, string> = {};

  try {
    const response = await fetch("/api/proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(proxyPayload),
    });

    const proxyRes = await response.json();
    if (proxyRes.error) {
      responseBody = proxyRes.details || proxyRes.error;
    } else {
      statusCode = proxyRes.status;
      statusText = proxyRes.statusText;
      responseBody = proxyRes.data;
      resHeaders = proxyRes.headers || {};
      if (typeof responseBody === "object") {
        responseBody = JSON.stringify(responseBody, null, 2);
      } else {
        responseBody = String(responseBody);
      }
    }

    // Determine Pass/Fail based on Expected Status Code
    let expectedStatuses = String(rawRow.expected)
      .split("/")
      .map((s) => parseInt(s.trim()));
    if (expectedStatuses.includes(statusCode)) {
      status = "pass";
    } else {
      status = "fail";
    }
  } catch (e: any) {
    responseBody = { error: e.message };
    status = "error";
  }

  const capturedData: any[] = [];

  // Execute Post-Response Script
  if (rawRow.postResponseScript && rawRow.postResponseScript.trim()) {
    try {
      const pm = {
        response: {
          json: () =>
            typeof responseBody === "object"
              ? responseBody
              : JSON.parse(responseBody),
          text: () =>
            typeof responseBody === "string"
              ? responseBody
              : JSON.stringify(responseBody),
          headers: resHeaders,
          code: statusCode,
          status: statusText,
        },
      };
      const scriptFn = new Function("pm", rawRow.postResponseScript);
      scriptFn(pm);
    } catch (err) {
      console.error("Error executing post-response script:", err);
    }
  }

  // Process Captures
  if (rawRow.postResponse && rawRow.postResponse.length > 0) {
    rawRow.postResponse.forEach((capture: any) => {
      if (
        capture.type === "json_path" &&
        capture.property &&
        capture.variableName
      ) {
        try {
          const pathParts = capture.property.replace("$.", "").split(".");
          let target =
            typeof responseBody === "string"
              ? JSON.parse(responseBody)
              : responseBody;
          for (const part of pathParts) {
            if (target && typeof target === "object") target = target[part];
            else {
              target = undefined;
              break;
            }
          }
          if (target !== undefined) {
            capturedData.push({
              variableName: capture.variableName,
              value: String(target),
              source: capture.property,
            });
          }
        } catch (e) {
          console.error("Error in JSON path capture:", e);
        }
      } else if (
        capture.type === "header_value" &&
        capture.property &&
        capture.variableName
      ) {
        const headerVal =
          resHeaders[capture.property.toLowerCase()] ||
          resHeaders[capture.property];
        if (headerVal !== undefined) {
          capturedData.push({
            variableName: capture.variableName,
            value: String(headerVal),
            source: capture.property,
          });
        }
      }
    });
  }

  const endTime = performance.now();

  return {
    id: Math.random().toString(),
    testCaseId: tc.id,
    testCaseName: `${tc.name} - ${rawRow.set} - ${rawRow.summary}`,
    status: status as "pass" | "fail" | "error",
    statusCode,
    statusText,
    responseTime: Math.round(endTime - startTime),
    request: {
      method: rawRow.httpMethod,
      url: finalUrl,
      headers: plainHeaders,
      body: body,
    },
    response: {
      headers: resHeaders,
      body: responseBody,
    },
    assertionResults: [
      {
        assertion: {
          id: "mtc-check",
          type: "status_code",
          operator: "eq",
          expected: String(rawRow.expected),
        },
        passed: status === "pass",
        actual: statusCode.toString(),
      },
    ],
    capturedData: capturedData,
    timestamp: Date.now(),
  };
};
