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
  return str.replace(/\{\{(.+?)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
};

export const runAutomatedTests = async (
  testCaseIds: string[],
  allTestCases: SavedTestCase[],
  globalAuth: GlobalAuth,
  variables: Record<string, string>,
  endpoints: ApiEndpoint[],
): Promise<{
  results: ExecutionResult[];
  excelDataByTestCase: Record<string, any[]>;
}> => {
  const results: ExecutionResult[] = [];
  const excelDataByTestCase: Record<string, any[]> = {};
  const targetCases = allTestCases.filter((tc) => testCaseIds.includes(tc.id));

  for (const testCase of targetCases) {
    const endpoint = endpoints.find((e) => e.id === testCase.endpointId);

    if (!endpoint) {
      console.warn(`Endpoint not found for test case ${testCase.name}`);
      continue;
    }

    try {
      // 1. Generate MTC Scenarios locally
      const mtcData = generateMTCData(testCase, endpoint, 1);
      const tcExcelData: any[] = [];

      // 2. Execute each MTC Scenario
      for (let i = 0; i < mtcData.rawRows.length; i++) {
        const rawRow = mtcData.rawRows[i];
        const excelRow = mtcData.rows[i];

        try {
          const result = await executeMTCScenario(
            testCase,
            rawRow,
            globalAuth,
            variables,
          );
          results.push(result);

          // Update Excel Row with actual results
          excelRow["Actual Result"] = result.statusCode
            ? `Status: ${result.statusCode}\n${String(result.response.body).substring(0, 100)}...`
            : result.statusText;
          excelRow["Status"] = result.status === "pass" ? "Pass" : "Fail";
          tcExcelData.push(excelRow);
        } catch (e) {
          console.error(`Failed to execute scenario ${rawRow.summary}`, e);
          excelRow["Actual Result"] = "Execution Error";
          excelRow["Status"] = "Fail";
          tcExcelData.push(excelRow);
        }
        // Rate limiting protection
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      excelDataByTestCase[testCase.id] = tcExcelData;
    } catch (err) {
      console.error(`Failed to generate MTCs for ${testCase.name}`, err);
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

  // Apply Global Auth if needed (or use rawRow.auth if we parsed it, but globalAuth is safer)
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
    } else if (
      statusCode >= 200 &&
      statusCode < 300 &&
      expectedStatuses.some((s) => s >= 200 && s < 300)
    ) {
      status = "pass"; // Allow any 2xx if expected is 2xx
    } else if (statusCode >= 400 && expectedStatuses.some((s) => s >= 400)) {
      status = "pass"; // Allow any 4xx if expected is 4xx
    } else {
      status = "fail";
    }
  } catch (e: any) {
    responseBody = { error: e.message };
    status = "error";
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
      headers: {},
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
    capturedData: [],
    timestamp: Date.now(),
  };
};
