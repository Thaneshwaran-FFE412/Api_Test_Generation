import { ExecutionProps } from "@/components/ExecutionPanel";
import {
  SavedTestCase,
  ExecutionResult,
  GlobalAuth,
  ApiEndpoint,
} from "../types";
import {
  generateMTCData,
  substituteVariables,
  formatParams,
  formatPathParams,
} from "../utils/mtcGenerator";
import { BASE_URL } from "@/pages/LandingPage";

export const applySubstitutionsToExcelRow = (
  row: any,
  vars: Record<string, string>,
) => {
  const fieldsToSubstitute = [
    "End Point",
    "Path Params",
    "Query Params",
    "Header Params",
    "Payload (JSON)",
    "Payload (FormData)",
    "Payload (Text)",
    "Request Payload (json)",
    "Request Payload (xml)",
    "Request Payload (text)",
    "Request Payload (form-data)",
    "Request Payload (x-www-form-urlencoded)",
    "Request Payload",
    "Auth (Bearer)",
    "Auth (Basic)",
    "Auth (API Key)",
  ];
  fieldsToSubstitute.forEach((field) => {
    if (row[field] && typeof row[field] === "string") {
      row[field] = substituteVariables(row[field], vars);
    }
  });
};

const substituteObject = (obj: any, variables: Record<string, string>): any => {
  if (!obj) return obj;
  if (typeof obj === "string") return substituteVariables(obj, variables);
  if (Array.isArray(obj))
    return obj.map((item) => substituteObject(item, variables));
  if (typeof obj === "object") {
    const res: any = {};
    for (const key in obj) {
      res[key] = substituteObject(obj[key], variables);
    }
    return res;
  }
  return obj;
};

const resolveRawRow = (rawRow: any, variables: Record<string, string>) => {
  const resolvedPathParams = substituteObject(rawRow.pathParams, variables);

  let resolvedEndPoint = rawRow.endPoint || "";
  resolvedEndPoint = resolvedEndPoint.replace(
    /\$\{([^}]+)\}/g,
    (match: string, key: string) => {
      return resolvedPathParams[key] !== undefined
        ? String(resolvedPathParams[key])
        : "";
    },
  );
  resolvedEndPoint = resolvedEndPoint.replace(
    /{([^}]+)}/g,
    (match: string, key: string) => {
      return resolvedPathParams[key] !== undefined
        ? String(resolvedPathParams[key])
        : "";
    },
  );
  resolvedEndPoint = substituteVariables(resolvedEndPoint, variables);

  return {
    ...rawRow,
    endPoint: resolvedEndPoint,
    pathParams: resolvedPathParams,
    queryParams: substituteObject(rawRow.queryParams, variables),
    headerParams: substituteObject(rawRow.headerParams, variables),
    auth: substituteVariables(rawRow.auth || "", variables),
    payload: substituteObject(rawRow.payload, variables),
  };
};

const updateExcelRowFromResolved = (excelRow: any, resolvedRawRow: any) => {
  if (excelRow["End Point"]) excelRow["End Point"] = resolvedRawRow.endPoint;
  if (excelRow["Path Params"])
    excelRow["Path Params"] = formatPathParams(resolvedRawRow.pathParams);
  if (excelRow["Query Params"])
    excelRow["Query Params"] = formatParams(resolvedRawRow.queryParams);
  if (excelRow["Header Params"])
    excelRow["Header Params"] = formatParams(resolvedRawRow.headerParams);

  const payloadFields = [
    "Payload (JSON)",
    "Payload (FormData)",
    "Payload (Text)",
    "Request Payload (json)",
    "Request Payload (xml)",
    "Request Payload (text)",
    "Request Payload (form-data)",
    "Request Payload (x-www-form-urlencoded)",
    "Request Payload",
  ];
  payloadFields.forEach((field) => {
    if (excelRow[field]) {
      if (typeof resolvedRawRow.payload === "object") {
        if (
          field.includes("form-data") ||
          field.includes("x-www-form-urlencoded")
        ) {
          excelRow[field] = formatParams(resolvedRawRow.payload);
        } else {
          excelRow[field] = JSON.stringify(resolvedRawRow.payload, null, 2);
        }
      } else {
        excelRow[field] = String(resolvedRawRow.payload);
      }
    }
  });

  const authFields = ["Auth (Bearer)", "Auth (Basic)", "Auth (API Key)"];
  authFields.forEach((field) => {
    if (excelRow[field]) {
      excelRow[field] = resolvedRawRow.auth;
    }
  });
};

export const runExecutionFromDB = async (
  // Updated New One
  execution: ExecutionProps,
  testCases: SavedTestCase[],
  endpoints: ApiEndpoint[],
  variables: Record<string, string>,
  globalAuth: GlobalAuth,
) => {
  console.log("execution Inside runExecutionFromDB");
  console.log(execution);

  const results: ExecutionResult[] = [];
  const updatedRow = [...execution.rows];
  let currentVariables = { ...variables };

  for (let i = 0; i < execution.rawRows.length; i++) {
    const rawRow = execution.rawRows[i];
    const excelRow = updatedRow[i];

    try {
      // ============================
      // 🔍 FIND TEST CASE
      // ============================
      const testCase = testCases.find((tc) =>
        tc.request?.url?.includes(rawRow.endPoint),
      );

      if (!testCase) {
        excelRow["Status"] = "Fail";
        excelRow["Comments"] = "Test case not found";
        continue;
      }

      // ============================
      // 🔹 RESOLVE VARIABLES
      // ============================
      const resolvedRawRow = resolveRawRow(rawRow, currentVariables);

      // ============================
      // 🔹 BUILD URL
      // ============================
      let finalUrl = testCase.request.url;

      Object.entries(resolvedRawRow.pathParams || {}).forEach(([k, v]) => {
        finalUrl = finalUrl.replace(`{${k}}`, String(v));
      });

      finalUrl = substituteVariables(finalUrl, currentVariables);

      const urlObj = new URL(finalUrl);
      Object.entries(resolvedRawRow.queryParams || {}).forEach(([k, v]) => {
        if (v) urlObj.searchParams.set(k, String(v));
      });
      finalUrl = urlObj.toString();

      // ============================
      // 🔹 HEADERS
      // ============================
      const plainHeaders: Record<string, string> = {};

      Object.entries(resolvedRawRow.headerParams || {}).forEach(([k, v]) => {
        if (v) plainHeaders[k] = String(v);
      });

      // Apply Global Auth
      if (globalAuth.type === "bearer" && globalAuth.bearerToken) {
        plainHeaders["Authorization"] = `Bearer ${globalAuth.bearerToken}`;
      }

      // ============================
      // 🔹 BODY
      // ============================
      let body: any = undefined;

      if (resolvedRawRow.payload) {
        if (testCase.request.bodyType === "raw") {
          body =
            testCase.request.rawFormat === "json"
              ? typeof resolvedRawRow.payload === "string"
                ? resolvedRawRow.payload
                : JSON.stringify(resolvedRawRow.payload)
              : String(resolvedRawRow.payload);
        }
      }

      // ============================
      // 🔹 CALL BACKEND
      // ============================
      const startTime = performance.now();

      const response = await fetch(`${BASE_URL}/execution/autoExecution`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: resolvedRawRow.httpMethod,
          url: finalUrl,
          headers: plainHeaders,
          body: body,
        }),
      });
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);
      const resData = await response.json();

      const statusCode = resData.status || 0;
      const responseBody = resData.data;
      const statusText = resData.statusText || "";

      // ============================
      // 🔹 PASS / FAIL
      // ============================
      const expectedStatuses = String(resolvedRawRow.expected)
        .split("/")
        .map((s) => parseInt(s.trim()));

      const status: "pass" | "fail" = expectedStatuses.includes(statusCode)
        ? "pass"
        : "fail";

      // ============================
      // 🔹 BUILD RESULT
      // ============================
      const result: ExecutionResult = {
        id: testCase.id,
        testCaseName: `${testCase.endpointName} - ${rawRow.set} - ${rawRow.summary}`,
        status,
        statusCode,
        statusText,
        responseTime,
        request: {
          method: resolvedRawRow.httpMethod,
          url: finalUrl,
          headers: plainHeaders,
          body,
        },
        response: {
          headers: resData.headers || {},
          body: responseBody,
        },
        assertionResults: [],
        capturedData: [],
        isSlow: true,
      };

      // ============================
      // 🔹 CAPTURE VARIABLES
      // ============================
      if (resolvedRawRow.postResponse?.length) {
        resolvedRawRow.postResponse.forEach((capture: any) => {
          try {
            const json =
              typeof responseBody === "string"
                ? JSON.parse(responseBody)
                : responseBody;

            const value = capture.property
              ?.replace(/^\$\./, "")
              .split(".")
              .reduce((acc: any, key: string) => acc?.[key], json);

            if (value !== undefined) {
              currentVariables[capture.variableName] = String(value);
              result.capturedData.push({
                variableName: capture.variableName,
                value: String(value),
                source: capture.property,
              });
            }
          } catch (e) {
            console.warn("Capture failed", e);
          }
        });
      }

      const isSlow = responseTime > 1000; // 1 sec

      results.push({ ...result, isSlow });

      // ============================
      // 📝 UPDATE EXCEL
      // ============================
      excelRow["Actual Result"] = `Status: ${statusCode}\n${
        typeof responseBody === "object"
          ? JSON.stringify(responseBody, null, 2)
          : String(responseBody)
      }`;
      excelRow["Status"] = status === "pass" ? "Pass" : "Fail";

      excelRow["Comments"] =
        status === "pass"
          ? "Test case passed successfully."
          : `Expected: ${rawRow.expected}, Actual: ${statusCode}`;
    } catch (e) {
      console.error("Execution error:", e);

      excelRow["Actual Result"] = "Execution Error";
      excelRow["Status"] = "Fail";
      excelRow["Comments"] = e instanceof Error ? e.message : String(e);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return {
    results,
    updatedRow,
  };
};
