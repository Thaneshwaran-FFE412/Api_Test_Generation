import {
  SavedTestCase,
  ExecutionResult,
  GlobalAuth,
  ApiEndpoint,
} from "../types";
import { generateManualTestCases } from "./geminiService";

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
): Promise<ExecutionResult[]> => {
  const results: ExecutionResult[] = [];
  const targetCases = allTestCases.filter((tc) => testCaseIds.includes(tc.id));

  for (const testCase of targetCases) {
    const endpoint = endpoints.find((e) => e.id === testCase.endpointId);

    if (!endpoint) {
      console.warn(`Endpoint not found for test case ${testCase.name}`);
      continue;
    }

    try {
      // 1. Generate AI Scenarios (Same as MTC Excel export)
      const aiScenarios = await generateManualTestCases(endpoint);

      // 2. Execute each AI Scenario
      for (const scenario of aiScenarios) {
        try {
          const result = await executeAiScenario(
            testCase,
            scenario,
            globalAuth,
            variables,
          );
          results.push(result);
        } catch (e) {
          console.error(
            `Failed to execute scenario ${scenario.description}`,
            e,
          );
        }
        // Rate limiting protection
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (err) {
      console.error(`Failed to generate MTCs for ${testCase.name}`, err);
    }
  }

  return results;
};

const executeAiScenario = async (
  tc: SavedTestCase,
  scenario: {
    id: string;
    description: string;
    inputData: string;
    expectedResult: string;
    type: string;
  },
  globalAuth: GlobalAuth,
  variables: Record<string, string>,
): Promise<ExecutionResult> => {
  const startTime = performance.now();

  // 1. Parse AI Input Data
  let parsedInput: any = scenario.inputData;
  try {
    // Try parsing JSON if it looks like an object/array
    if (
      typeof scenario.inputData === "string" &&
      (scenario.inputData.trim().startsWith("{") ||
        scenario.inputData.trim().startsWith("["))
    ) {
      parsedInput = JSON.parse(scenario.inputData);
    }
  } catch (e) {
    // Keep as string if parsing fails
  }

  // 2. Construct URL and Body based on Method
  let finalUrl = tc.url;
  let body: any = undefined;
  const method = tc.method.toUpperCase();

  if (["GET", "DELETE", "HEAD", "OPTIONS"].includes(method)) {
    // For GET-like requests, map input object to Query Params
    try {
      // Check if tc.url is absolute or relative.
      // If relative, we can't easily use URL() constructor without a base, but usually tc.url is full from UI.
      // We'll try-catch the URL construction.
      const urlObj = new URL(substituteVariables(finalUrl, variables));

      if (typeof parsedInput === "object" && parsedInput !== null) {
        Object.entries(parsedInput).forEach(([k, v]) => {
          if (v !== null && v !== undefined) {
            urlObj.searchParams.set(k, String(v));
          }
        });
      }
      finalUrl = urlObj.toString();
    } catch (e) {
      // Fallback for relative URLs or malformed URLs: just append query string manually if simple
      console.warn("Could not parse URL object for param injection", e);
    }
  } else {
    // For POST/PUT/PATCH, Use inputData as Body
    // If the AI returned a string, use it. If object, stringify it.
    if (typeof parsedInput === "object") {
      body = JSON.stringify(parsedInput);
    } else {
      body = String(parsedInput);
    }
  }

  // 3. Prepare Headers
  const headers = new Headers();
  // Inherit headers from saved test case
  tc.headers.forEach((h) => {
    if (h.enabled && h.key)
      headers.append(h.key, substituteVariables(h.value, variables));
  });

  // Ensure Content-Type is JSON if we are sending JSON body
  if (body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Apply Global Auth
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

  const plainHeaders: Record<string, string> = {};
  headers.forEach((v, k) => {
    plainHeaders[k] = v;
  });

  const proxyPayload = {
    method: method,
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

    // Determine Pass/Fail based on AI Scenario Type
    const isPositive = scenario.type.toLowerCase().includes("positive");

    if (isPositive) {
      status = statusCode >= 200 && statusCode < 300 ? "pass" : "fail";
    } else {
      // Negative/Boundary: Pass if we get an error code (handled gracefully)
      status = statusCode >= 400 ? "pass" : "fail";
    }
  } catch (e: any) {
    responseBody = { error: e.message };
    status = "error";
  }

  const endTime = performance.now();

  return {
    id: Math.random().toString(),
    testCaseId: tc.id,
    testCaseName: `${tc.name} - ${scenario.description}`,
    status: status as "pass" | "fail" | "error",
    statusCode,
    statusText,
    responseTime: Math.round(endTime - startTime),
    request: {
      method: method,
      url: finalUrl,
      headers: {},
      body: body,
    },
    response: {
      headers: {},
      body: responseBody,
    },
    assertionResults: [
      {
        assertion: {
          id: "ai-check",
          type: "status_code",
          operator: isPositive(scenario.type) ? "eq" : "gte",
          expected: isPositive(scenario.type) ? "2xx" : "4xx",
        },
        passed: status === "pass",
        actual: statusCode.toString(),
      },
    ],
    capturedData: [],
    timestamp: Date.now(),
  };
};

const isPositive = (type: string) => {
  const t = type.toLowerCase();
  return t.includes("positive") || t.includes("happy");
};
