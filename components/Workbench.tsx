import React, { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "react-hot-toast";
import {
  ApiEndpoint,
  SavedTestCase,
  GlobalAuth,
  Assertion,
  Capture,
  KVItem,
  BodyType,
  RawFormat,
  ExecutionResult,
  AuthType,
  AppSettings,
} from "../types";
import AuthHeader from "./AuthHeader";
import ConstraintModal from "./ConstraintModal";

interface WorkbenchProps {
  endpoint: ApiEndpoint;
  baseUrl: string;
  variables: Record<string, string>;
  globalAuth: GlobalAuth;
  spec: any;
  savedTestCases: SavedTestCase[];
  setGlobalAuth: any;
  onVariablesChange: (newVars: Record<string, string>) => void;
  getSavedScenarios: () => Promise<void>;
}

const substituteVariables = (
  str: string,
  vars: Record<string, string>,
): string => {
  if (typeof str !== "string") return str;
  // Support both {{key}} and $key
  let result = str.replace(/\{\{(.+?)\}\}/g, (_, key) => {
    if (vars[key] !== undefined) return vars[key];
    if (vars["$" + key] !== undefined) return vars["$" + key];
    return `{{${key}}}`;
  });
  result = result.replace(/\$([a-zA-Z0-9_]+)/g, (match, key) => {
    if (vars[key] !== undefined) return vars[key];
    if (vars["$" + key] !== undefined) return vars["$" + key];
    return match;
  });
  result = result.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (vars[key] !== undefined) return vars[key];
    if (vars["$" + key] !== undefined) return vars["$" + key];
    return match;
  });
  return result;
};
const BASE_URL = "http://localhost:8080";
const Workbench: React.FC<WorkbenchProps> = ({
  endpoint,
  baseUrl,
  variables,
  globalAuth,
  spec,
  savedTestCases,
  setGlobalAuth,
  onVariablesChange,
  getSavedScenarios,
}) => {
  console.log("endpoint Is Captured");
  console.log(endpoint);

  const [requestName, setRequestName] = useState(
    endpoint.summary || endpoint.path,
  );
  const [method, setMethod] = useState(endpoint.method.toUpperCase());
  const [tempUrl, setTempUrl] = useState("");
  const [urlPath, setUrlPath] = useState(endpoint.path);

  const [queryParams, setQueryParams] = useState<KVItem[]>([]);
  const [pathParams, setPathParams] = useState<KVItem[]>([]);
  const [headers, setHeaders] = useState<KVItem[]>([]);
  const [bodyType, setBodyType] = useState<BodyType>("none");
  const [rawFormat, setRawFormat] = useState<RawFormat>("json");
  const [bodyContent, setBodyContent] = useState("");
  const [jsonFields, setJsonFields] = useState<KVItem[]>([]);
  const [formData, setFormData] = useState<KVItem[]>([]);
  const [urlEncoded, setUrlEncoded] = useState<KVItem[]>([]);
  const [preRequestScript, setPreRequestScript] = useState("");
  const [postResponseScript, setPostResponseScript] = useState("");
  const [preRequest, setPreRequest] = useState<Capture[]>([]);
  const [auth, setAuth] = useState<AuthType[]>([]);
  const [assertions, setAssertions] = useState<Assertion[]>([]);
  const [postResponse, setPostResponse] = useState<Capture[]>([]);
  const [setting, setSetting] = useState<AppSettings>({
    tlsVerification: true,
    requestTimeout: 30000,
    expectedStatusCode: "200",
    maxRedirects: 2,
    autoRedirectDefault: true,
    redirectOriginalMethod: false,
    retainAuthOnRedirect: false,
    tlsProtocols: {
      tls10: false,
      tls11: false,
      tls12: true,
      tls13: true,
    },
  });

  const [activeTab, setActiveTab] = useState<
    | "pre-request"
    | "params"
    | "auth"
    | "headers"
    | "body"
    | "assertions"
    | "post-response"
    | "setting"
  >("params");
  const [showBodyConfig, setShowBodyConfig] = useState(false);
  const isBodyValid = useMemo(() => {
    if (rawFormat === "json") {
      try {
        JSON.parse(bodyContent);
        return true;
      } catch (e) {
        return false;
      }
    }
    if (rawFormat === "xml") {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(bodyContent, "application/xml");
        const parseError = xmlDoc.getElementsByTagName("parsererror");
        return parseError.length === 0;
      } catch (e) {
        return false;
      }
    }
    return true;
  }, [bodyContent, rawFormat]);

  const [responseTab, setResponseTab] = useState<
    | "pre-request"
    | "body"
    | "auth"
    | "headers"
    | "results"
    | "post-response"
    | "setting"
    | "request"
  >("body");

  const [executionResult, setExecutionResult] =
    useState<ExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isResponseCollapsed, setIsResponseCollapsed] = useState(true);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [hasRunRequest, setHasRunRequest] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [binaryFile, setBinaryFile] = useState<string>("");
  const [dependentOnId, setDependentOnId] = useState("");

  // Use a ref to track the current endpoint ID to prevent clearing results on every render
  const currentEndpointId = useRef(endpoint.id);

  useEffect(() => {
    // Only reset the execution result if we actually switched to a DIFFERENT endpoint
    if (currentEndpointId.current !== endpoint.id) {
      setExecutionResult(null);
      setHasRunRequest(false);
      currentEndpointId.current = endpoint.id;
    }

    setRequestName(endpoint.summary || endpoint.path);
    setUrlPath(endpoint.path);
    setMethod(endpoint.method.toUpperCase());

    const resolveRef = (ref: string): any => {
      if (!ref || !spec) return null;
      const parts = ref.split("/");
      let current = spec;
      for (let i = 1; i < parts.length; i++) {
        if (!current) return null;
        current = current[parts[i]];
      }
      return current;
    };

    const getResolvedSchema = (
      schemaObj: any,
      visited = new Set<string>(),
    ): any => {
      if (!schemaObj) return schemaObj;
      let resolved = { ...schemaObj };

      if (resolved.$ref) {
        if (visited.has(resolved.$ref)) return resolved;
        visited.add(resolved.$ref);
        const refResolved = resolveRef(resolved.$ref);
        if (refResolved) {
          resolved = {
            ...resolved,
            ...getResolvedSchema(refResolved, visited),
          };
        }
        delete resolved.$ref;
      }

      if (resolved.allOf && Array.isArray(resolved.allOf)) {
        resolved.allOf.forEach((sub: any) => {
          const subResolved = getResolvedSchema(sub, visited);
          if (subResolved.properties) {
            resolved.properties = {
              ...(resolved.properties || {}),
              ...subResolved.properties,
            };
          }
          if (subResolved.required) {
            resolved.required = [
              ...(resolved.required || []),
              ...subResolved.required,
            ];
          }
        });
      }
      return resolved;
    };

    const getConstraint = (p: any): string => {
      const c: string[] = [];
      let schema = getResolvedSchema(p.schema || p);

      const isRequired = p.required === true;
      c.push(`required:${isRequired}`);

      if (schema.type) c.push(`type:${schema.type}`);
      if (schema.pattern) c.push(`pattern:${schema.pattern}`);
      if (schema.minLength !== undefined) c.push(`minLen:${schema.minLength}`);
      if (schema.maxLength !== undefined) c.push(`maxLen:${schema.maxLength}`);
      if (schema.minimum !== undefined) c.push(`min:${schema.minimum}`);
      if (schema.maximum !== undefined) c.push(`max:${schema.maximum}`);

      if (schema.enum && Array.isArray(schema.enum)) {
        c.push(`enum:${schema.enum.join("|")}`);
      } else if (schema.items?.enum && Array.isArray(schema.items.enum)) {
        c.push(`enum:${schema.items.enum.join("|")}`);
      }

      return c.join(", ");
    };

    const params: KVItem[] = (endpoint.parameters || [])
      .filter((p) => p.in === "query")
      .map((p) => {
        const schema = getResolvedSchema(p.schema || p);
        const options =
          p.enum || p.items?.enum || schema.enum || schema.items?.enum;
        return {
          id: Math.random().toString(),
          key: p.name,
          value: p.default !== undefined ? String(p.default) : "",
          enabled: true,
          description: p.description || "",
          options: Array.isArray(options) ? options.map(String) : undefined,
          constraint: getConstraint(p),
        };
      });
    setQueryParams(params);

    const pathParamItems: KVItem[] = (endpoint.parameters || [])
      .filter((p) => p.in === "path")
      .map((p) => {
        const schema = getResolvedSchema(p.schema || p);
        const options =
          p.enum || p.items?.enum || schema.enum || schema.items?.enum;
        return {
          id: Math.random().toString(),
          key: p.name,
          value: p.default !== undefined ? String(p.default) : "",
          enabled: true,
          description: p.description || "",
          options: Array.isArray(options) ? options.map(String) : undefined,
          constraint: getConstraint(p),
        };
      });
    setPathParams(pathParamItems);

    const headerItems: KVItem[] = (endpoint.parameters || [])
      .filter((p) => p.in === "header")
      .map((p) => {
        const schema = getResolvedSchema(p.schema || p);
        const options =
          p.enum || p.items?.enum || schema.enum || schema.items?.enum;
        return {
          id: Math.random().toString(),
          key: p.name,
          value: p.default !== undefined ? String(p.default) : "",
          enabled: true,
          description: p.description || "",
          options: Array.isArray(options) ? options.map(String) : undefined,
          constraint: getConstraint(p),
        };
      });

    const getRawFormatFromMime = (mime: string): RawFormat => {
      if (mime.includes("json")) return "json";
      if (mime.includes("xml")) return "xml";
      if (mime.includes("javascript")) return "javascript";
      if (mime.includes("html")) return "html";
      return "text";
    };

    const generateMockFromSchema = (schema: any): string => {
      const resolveRef = (ref: string): any => {
        if (!ref || !spec) return null;
        const parts = ref.split("/");
        let current = spec;
        for (let i = 1; i < parts.length; i++) {
          if (!current) return null;
          current = current[parts[i]];
        }
        return current;
      };

      const getResolvedSchema = (
        schemaObj: any,
        visited = new Set<string>(),
      ): any => {
        if (!schemaObj) return schemaObj;
        let resolved = { ...schemaObj };

        if (resolved.$ref) {
          if (visited.has(resolved.$ref)) return resolved;
          visited.add(resolved.$ref);
          const refResolved = resolveRef(resolved.$ref);
          if (refResolved) {
            resolved = {
              ...resolved,
              ...getResolvedSchema(refResolved, visited),
            };
          }
          delete resolved.$ref;
        }

        if (resolved.allOf && Array.isArray(resolved.allOf)) {
          resolved.allOf.forEach((sub: any) => {
            const subResolved = getResolvedSchema(sub, visited);
            if (subResolved.properties) {
              resolved.properties = {
                ...(resolved.properties || {}),
                ...subResolved.properties,
              };
            }
            if (subResolved.required) {
              resolved.required = [
                ...(resolved.required || []),
                ...subResolved.required,
              ];
            }
          });
        }
        return resolved;
      };

      const generateMock = (s: any, visited = new Set<string>()): any => {
        if (!s) return null;

        const resolved = getResolvedSchema(s, visited);

        if (resolved.example !== undefined) return resolved.example;
        if (resolved.default !== undefined) return resolved.default;

        if (resolved.enum && resolved.enum.length > 0) return resolved.enum[0];

        if (resolved.type === "object" || resolved.properties) {
          const mock: any = {};
          const props = resolved.properties || {};
          Object.keys(props).forEach((key) => {
            mock[key] = generateMock(props[key], new Set(visited));
          });
          return mock;
        }

        if (resolved.type === "array") {
          return [generateMock(resolved.items, new Set(visited))];
        }

        switch (resolved.type) {
          case "string":
            return resolved.format === "date-time"
              ? new Date().toISOString()
              : "string";
          case "integer":
          case "number":
            return 0;
          case "boolean":
            return true;
          default:
            return "string";
        }
      };

      const mockObj = generateMock(schema);
      return mockObj ? JSON.stringify(mockObj, null, 2) : "";
    };

    const schemaToKV = (schema: any): KVItem[] => {
      const resolveRef = (ref: string): any => {
        if (!ref || !spec) return null;
        const parts = ref.split("/");
        let current = spec;
        for (let i = 1; i < parts.length; i++) {
          if (!current) return null;
          current = current[parts[i]];
        }
        return current;
      };

      const getResolvedSchema = (
        schemaObj: any,
        visited = new Set<string>(),
      ): any => {
        if (!schemaObj) return schemaObj;
        let resolved = { ...schemaObj };

        if (resolved.$ref) {
          if (visited.has(resolved.$ref)) return resolved;
          visited.add(resolved.$ref);
          const refResolved = resolveRef(resolved.$ref);
          if (refResolved) {
            resolved = {
              ...resolved,
              ...getResolvedSchema(refResolved, visited),
            };
          }
          delete resolved.$ref;
        }

        if (resolved.allOf && Array.isArray(resolved.allOf)) {
          resolved.allOf.forEach((sub: any) => {
            const subResolved = getResolvedSchema(sub, visited);
            if (subResolved.properties) {
              resolved.properties = {
                ...(resolved.properties || {}),
                ...subResolved.properties,
              };
            }
            if (subResolved.required) {
              resolved.required = [
                ...(resolved.required || []),
                ...subResolved.required,
              ];
            }
          });
        }
        return resolved;
      };

      const targetSchema = getResolvedSchema(schema);

      if (!targetSchema || !targetSchema.properties) return [];
      return Object.keys(targetSchema.properties).map((key) => {
        const propSchema = getResolvedSchema(targetSchema.properties[key]);
        return {
          id: Math.random().toString(),
          key,
          value:
            propSchema.default !== undefined
              ? String(propSchema.default)
              : propSchema.example !== undefined
                ? String(propSchema.example)
                : "",
          enabled: true,
          type:
            propSchema.format === "binary" || propSchema.type === "file"
              ? "file"
              : "text",
          description: propSchema.description || "",
        };
      });
    };

    let initialBody = "";
    let detectedBodyType: BodyType = "none";
    let detectedRawFormat: RawFormat = "json";
    let detectedFormData: KVItem[] = [];
    let detectedUrlEncoded: KVItem[] = [];

    if (endpoint.requestBody) {
      const content = endpoint.requestBody.content || {};
      const mimeTypes = Object.keys(content);
      if (mimeTypes.length > 0) {
        if (content["application/json"]) {
          detectedBodyType = "raw";
          detectedRawFormat = "json";
          const media = content["application/json"];
          initialBody = media.example
            ? typeof media.example === "object"
              ? JSON.stringify(media.example, null, 2)
              : String(media.example)
            : generateMockFromSchema(media.schema);
        } else if (content["multipart/form-data"]) {
          detectedBodyType = "form-data";
          detectedFormData = schemaToKV(content["multipart/form-data"].schema);
        } else if (content["application/x-www-form-urlencoded"]) {
          detectedBodyType = "x-www-form-urlencoded";
          detectedUrlEncoded = schemaToKV(
            content["application/x-www-form-urlencoded"].schema,
          );
        } else if (content["application/octet-stream"]) {
          detectedBodyType = "binary";
        } else {
          const mime = mimeTypes[0];
          detectedBodyType = "raw";
          detectedRawFormat = getRawFormatFromMime(mime);
          const media = content[mime];
          initialBody = media.example
            ? typeof media.example === "object"
              ? JSON.stringify(media.example, null, 2)
              : String(media.example)
            : generateMockFromSchema(media.schema);
        }
      }
    } else {
      const bodyParam = endpoint.parameters?.find((p) => p.in === "body");
      const formDataParams = endpoint.parameters?.filter(
        (p) => p.in === "formData",
      );
      if (bodyParam) {
        detectedBodyType = "raw";
        detectedRawFormat = "json";
        initialBody = bodyParam.example
          ? typeof bodyParam.example === "object"
            ? JSON.stringify(bodyParam.example, null, 2)
            : String(bodyParam.example)
          : generateMockFromSchema(bodyParam.schema);
      } else if (formDataParams && formDataParams.length > 0) {
        const consumes = (endpoint as any).consumes || [];
        const isUrlEncoded = consumes.includes(
          "application/x-www-form-urlencoded",
        );
        detectedBodyType = isUrlEncoded ? "x-www-form-urlencoded" : "form-data";
        const kvs = formDataParams.map((p) => ({
          id: Math.random().toString(),
          key: p.name,
          value:
            p.default !== undefined
              ? String(p.default)
              : p.example !== undefined
                ? String(p.example)
                : "",
          enabled: true,
          type: (p.type === "file" ? "file" : "text") as "text" | "file",
          description: p.description || "",
        }));
        if (isUrlEncoded) detectedUrlEncoded = kvs;
        else detectedFormData = kvs;
      }
    }

    const contentTypeVal =
      detectedBodyType === "raw"
        ? `application/${detectedRawFormat}`
        : detectedBodyType === "form-data"
          ? "multipart/form-data"
          : detectedBodyType === "x-www-form-urlencoded"
            ? "application/x-www-form-urlencoded"
            : null;
    if (
      contentTypeVal &&
      !headerItems.some((h) => h.key.toLowerCase() === "content-type")
    ) {
      headerItems.push({
        id: "ct-auto",
        key: "Content-Type",
        value: contentTypeVal,
        enabled: true,
        description: "Auto-detected",
      });
    }

    setHeaders(headerItems);
    setBodyType(detectedBodyType);
    setRawFormat(detectedRawFormat);
    setBodyContent(initialBody);
    setJsonFields([]);
    setFormData(detectedFormData);
    setUrlEncoded(detectedUrlEncoded);

    // Default assertion based on method
    const defaultStatusCode =
      endpoint.method.toUpperCase() === "POST" ? "201" : "200";
    setAssertions([
      {
        id: Math.random().toString(),
        type: "status_code",
        operator: "eq",
        expected: defaultStatusCode,
      },
    ]);
  }, [endpoint.id, baseUrl]); // Dependency changed to ID to be stable

  useEffect(() => {
    let path = urlPath;

    pathParams.forEach((p) => {
      if (p.enabled && p.key) {
        const val = p.value; // Do not substitute for display
        if (val) {
          path = path.replace(new RegExp(`\\{${p.key}\\}`, "g"), val);
          path = path.replace(new RegExp(`:${p.key}`, "g"), val);
        }
      }
    });

    let url = `${baseUrl}${path}`;
    const enabledParams = queryParams.filter((p) => p.enabled && p.key);
    if (enabledParams.length > 0) {
      const qs = enabledParams
        .map((p) => {
          const val = p.value; // Do not substitute for display
          return `${encodeURIComponent(p.key)}=${encodeURIComponent(val)}`;
        })
        .join("&");
      url += (url.includes("?") ? "&" : "?") + qs;
    }

    setTempUrl(url);
  }, [endpoint.id, baseUrl, queryParams, pathParams, urlPath]);

  useEffect(() => {
    const allValues = [
      ...queryParams.map((p) => p.value),
      ...pathParams.map((p) => p.value),
      ...headers.map((p) => p.value),
      bodyContent,
      preRequestScript,
      postResponseScript,
    ].join(" ");

    const curlyMatches = [...allValues.matchAll(/\{\{(.+?)\}\}/g)].map(
      (m) => m[1],
    );
    const dollarMatches = [...allValues.matchAll(/\$([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    const dollarBraceMatches = [
      ...allValues.matchAll(/\$\{([a-zA-Z0-9_]+)\}/g),
    ].map((m) => m[1]);
    const foundKeys = Array.from(
      new Set([...curlyMatches, ...dollarMatches, ...dollarBraceMatches]),
    );

    let changed = false;
    const newVars = { ...variables };
    foundKeys.forEach((key) => {
      if (newVars[key] === undefined) {
        newVars[key] = "";
        changed = true;
      }
    });

    if (changed) {
      onVariablesChange(newVars);
    }
  }, [
    queryParams,
    pathParams,
    headers,
    bodyContent,
    variables,
    onVariablesChange,
  ]);

  const evaluateAssertions = (res: any, assertions: Assertion[]): any[] => {
    return assertions.map((a) => {
      let actualValue: any = "";
      let passed = false;
      switch (a.type) {
        case "status_code":
          actualValue = res.statusCode.toString();
          break;
        case "response_time":
          actualValue = res.responseTime.toString();
          break;
        case "body":
          actualValue =
            typeof res.response.body === "string"
              ? res.response.body
              : JSON.stringify(res.response.body);
          break;
        case "json_path":
          if (a.property && res.response.body) {
            const pathParts = a.property
              .replace(/^\$\./, "")
              .replace(/\[(\d+)\]/g, ".$1")
              .split(".")
              .filter(Boolean);
            let target = res.response.body;
            for (const part of pathParts) {
              if (target && typeof target === "object") target = target[part];
              else {
                target = undefined;
                break;
              }
            }
            actualValue = target?.toString() || "not found";
          }
          break;
        case "header_value":
          actualValue = a.property
            ? res.response.headers[a.property] || "not found"
            : "no header";
          break;
        default:
          actualValue = "unknown";
      }
      const expected = a.expected;
      switch (a.operator) {
        case "eq":
          passed = actualValue === expected;
          break;
        case "neq":
          passed = actualValue !== expected;
          break;
        case "gt":
          passed = Number(actualValue) > Number(expected);
          break;
        case "lt":
          passed = Number(actualValue) < Number(expected);
          break;
        case "contains":
          passed = String(actualValue).includes(expected);
          break;
        case "exists":
          passed = actualValue !== "not found" && actualValue !== undefined;
          break;
        default:
          passed = false;
      }
      return { assertion: a, passed, actual: actualValue };
    });
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    setExecutionResult(null);
    setIsResponseCollapsed(false);

    let currentVariables = { ...variables };

    if (preRequestScript.trim()) {
      try {
        const pm = {
          variables: {
            get: (key: string) => currentVariables[key],
            set: (key: string, value: any) => {
              currentVariables[key] = String(value);
              onVariablesChange({ [key]: String(value) });
            },
          },
          environment: {
            get: (key: string) => currentVariables[key],
            set: (key: string, value: any) => {
              currentVariables[key] = String(value);
              onVariablesChange({ [key]: String(value) });
            },
          },
          globals: {
            get: (key: string) => currentVariables[key],
            set: (key: string, value: any) => {
              currentVariables[key] = String(value);
              onVariablesChange({ [key]: String(value) });
            },
          },
        };
        const scriptFn = new Function("pm", preRequestScript);
        scriptFn(pm);
      } catch (err) {
        console.error("Error executing pre-request script:", err);
      }
    }

    const controller = new AbortController();
    const timeoutId =
      setting.requestTimeout > 0
        ? setTimeout(() => controller.abort(), setting.requestTimeout)
        : null;

    const startTime = performance.now();
    const finalUrl = substituteVariables(tempUrl, currentVariables);
    try {
      const fetchHeaders = new Headers();

      headers
        .filter((h) => h.enabled && h.key)
        .forEach((h) => {
          const val =
            h.mode === "static"
              ? h.value
              : substituteVariables(h.value, currentVariables);
          fetchHeaders.append(h.key, val);
        });

      if (globalAuth.type === "bearer" && globalAuth.bearerToken) {
        const val =
          globalAuth.mode === "static"
            ? globalAuth.bearerToken
            : substituteVariables(globalAuth.bearerToken, currentVariables);
        fetchHeaders.append("Authorization", `Bearer ${val}`);
      } else if (
        globalAuth.type === "apikey" &&
        globalAuth.apiKey &&
        globalAuth.apiKeyValue
      ) {
        const val =
          globalAuth.mode === "static"
            ? globalAuth.apiKeyValue
            : substituteVariables(globalAuth.apiKeyValue, currentVariables);
        fetchHeaders.append(globalAuth.apiKey, val);
      } else if (
        globalAuth.type === "basic" &&
        globalAuth.username &&
        globalAuth.password
      ) {
        const user =
          globalAuth.mode === "static"
            ? globalAuth.username
            : substituteVariables(globalAuth.username, currentVariables);
        const pass =
          globalAuth.mode === "static"
            ? globalAuth.password
            : substituteVariables(globalAuth.password, currentVariables);
        const credentials = btoa(`${user}:${pass}`);
        fetchHeaders.append("Authorization", `Basic ${credentials}`);
      }

      const options: RequestInit = {
        method,
        headers: fetchHeaders,
        signal: controller.signal,
        // Note: Browser fetch has limited support for some settings like maxRedirects or tlsVerification
        redirect: setting.autoRedirectDefault ? "follow" : "manual",
      };

      if (method !== "GET" && method !== "HEAD") {
        if (bodyType === "raw") {
          options.body = substituteVariables(bodyContent, currentVariables);
        } else if (bodyType === "x-www-form-urlencoded") {
          const params = new URLSearchParams();
          urlEncoded
            .filter((i) => i.enabled && i.key)
            .forEach((i) => {
              const val =
                i.mode === "static"
                  ? i.value
                  : substituteVariables(i.value, currentVariables);
              params.append(i.key, val);
            });
          options.body = params;
        } else if (bodyType === "form-data") {
          const fd = new FormData();
          formData
            .filter((i) => i.enabled && i.key)
            .forEach((i) => {
              const val =
                i.mode === "static"
                  ? i.value
                  : substituteVariables(i.value, currentVariables);
              fd.append(i.key, val);
            });
          options.body = fd;
        }
      }

      const plainHeaders: Record<string, string> = {};
      fetchHeaders.forEach((v, k) => {
        plainHeaders[k] = v;
      });

      let proxyData: any = undefined;
      if (options.body instanceof URLSearchParams) {
        proxyData = options.body.toString();
        plainHeaders["Content-Type"] = "application/x-www-form-urlencoded";
      } else if (options.body instanceof FormData) {
        const formDataArray: { key: string; value: string }[] = [];
        options.body.forEach((value, key) => {
          formDataArray.push({ key, value: value.toString() });
        });
        proxyData = { _isFormData: true, items: formDataArray };
      } else {
        proxyData = options.body;
      }

      const proxyPayload = {
        method: options.method,
        url: finalUrl,
        headers: plainHeaders,
        data: proxyData,
      };

      const response = await fetch(`${BASE_URL}/endpoint/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(proxyPayload),
        signal: controller.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);
      const endTime = performance.now();
      toast.success("Request sent successfully");

      let responseBody: any;
      let resHeaders: Record<string, string> = {};
      let statusCode = 500;
      let statusText = "Proxy Error";

      try {
        const apiRes = await response.json();
        const proxyRes = apiRes.responseObject;
        if (proxyRes.error) {
          responseBody = proxyRes.details || proxyRes.error;
        } else {
          statusCode = proxyRes.statusCodeValue;
          statusText = proxyRes.statusText ?? "";
          resHeaders = proxyRes.headers || {};
          responseBody = proxyRes.body;
          if (responseBody !== null && typeof responseBody === "object") {
            responseBody = JSON.stringify(responseBody, null, 2);
          } else if (responseBody !== null && responseBody !== undefined) {
            responseBody = String(responseBody);
          }
        }
        if (
          responseBody == null ||
          responseBody === undefined ||
          responseBody === ""
        ) {
          responseBody = "No response body";
        }
      } catch (e) {
        responseBody = "Invalid response body to parse";
      }

      const realResult: ExecutionResult = {
        id: Math.random().toString(),
        testCaseId: "manual",
        testCaseName: requestName,
        status: "pass",
        statusCode: statusCode,
        statusText: statusText,
        responseTime: Math.round(endTime - startTime),
        request: {
          method,
          url: finalUrl,
          headers: Object.fromEntries(fetchHeaders.entries()),
          body:
            bodyType === "raw"
              ? options.body
              : options.body instanceof FormData
                ? "[FormData Content]"
                : options.body?.toString(),
        },
        response: {
          headers: resHeaders,
          body: responseBody,
        },
        assertionResults: [],
        capturedData: [],
        timestamp: Date.now(),
      };

      if (postResponseScript.trim()) {
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
              code: response.status,
              status: response.statusText,
            },
            variables: {
              get: (key: string) => currentVariables[key],
              set: (key: string, value: any) => {
                currentVariables[key] = String(value);
                onVariablesChange({ [key]: String(value) });
              },
            },
            environment: {
              get: (key: string) => currentVariables[key],
              set: (key: string, value: any) => {
                currentVariables[key] = String(value);
                onVariablesChange({ [key]: String(value) });
              },
            },
            globals: {
              get: (key: string) => currentVariables[key],
              set: (key: string, value: any) => {
                currentVariables[key] = String(value);
                onVariablesChange({ [key]: String(value) });
              },
            },
          };
          const scriptFn = new Function("pm", postResponseScript);
          scriptFn(pm);
        } catch (err) {
          console.error("Error executing post-response script:", err);
        }
      }

      if (postResponse && postResponse.length > 0) {
        const newVars: Record<string, string> = {};
        postResponse.forEach((capture) => {
          if (
            capture.type === "json_path" &&
            capture.property &&
            capture.variableName
          ) {
            try {
              const pathParts = capture.property
                .replace(/^\$\./, "")
                .replace(/\[(\d+)\]/g, ".$1")
                .split(".")
                .filter(Boolean);
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
                newVars[capture.variableName] = String(target);
                realResult.capturedData.push({
                  variableName: capture.variableName,
                  value: String(target),
                  source: capture.property,
                });
              }
            } catch (e) {
              console.error("Failed to capture", capture.property, e);
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
              newVars[capture.variableName] = String(headerVal);
              realResult.capturedData.push({
                variableName: capture.variableName,
                value: String(headerVal),
                source: capture.property,
              });
            }
          }
        });
        if (Object.keys(newVars).length > 0) {
          onVariablesChange(newVars);
          currentVariables = { ...currentVariables, ...newVars };
        }
      }

      realResult.assertionResults = evaluateAssertions(realResult, assertions);
      const allPassed = realResult.assertionResults.every((r) => r.passed);

      const statusAssertion = realResult.assertionResults.find(
        (r) => r.assertion.type === "status_code",
      );
      const expectedStatus = setting.expectedStatusCode;
      const actualStatus = realResult.statusCode;

      const statusMatches = expectedStatus
        ? String(actualStatus) === expectedStatus
        : statusAssertion
          ? statusAssertion.passed
          : response.ok;

      realResult.status = allPassed && statusMatches ? "pass" : "fail";

      setExecutionResult(realResult);
    } catch (err: any) {
      const endTime = performance.now();
      const errorResult: ExecutionResult = {
        id: Math.random().toString(),
        testCaseId: "manual",
        testCaseName: requestName,
        status: "error",
        statusCode: 0,
        statusText: "CORS or Network Error",
        responseTime: Math.round(endTime - startTime),
        request: { method, url: finalUrl, headers: {}, body: bodyContent },
        response: {
          headers: {},
          body: {
            error: err.message,
            troubleshooting: [
              "1. Is the API server reachable?",
              "2. MIXED CONTENT: If this app is on HTTPS and the API is HTTP (like 49.249.29.6), browsers block it automatically.",
              "3. CORS: The server must send 'Access-Control-Allow-Origin'. Numeric IPs often lack proper CORS headers.",
              "4. Try using a 'CORS Unblock' extension for development purposes.",
            ],
          },
        },
        assertionResults: [],
        capturedData: [],
        timestamp: Date.now(),
      };
      setExecutionResult(errorResult);
    } finally {
      setIsExecuting(false);
      setHasRunRequest(true);
      setResponseTab("body");
    }
  };

  const isValidCurlyParams = (url: string) => {
    // Remove variables from the string before checking braces
    const cleanUrl = url
      .replace(/\$\{([a-zA-Z0-9_]+)\}/g, "")
      .replace(/\{\{(.+?)\}\}/g, "");

    // Must match {something} format
    const matches = [...cleanUrl.matchAll(/(?<!\$|\{)\{([^{}]+)\}(?!\})/g)];

    // Count total opening and closing braces
    const openCount = (cleanUrl.match(/{/g) || []).length;
    const closeCount = (cleanUrl.match(/}/g) || []).length;

    // 1️⃣ braces must match
    if (openCount !== closeCount) return false;

    // 2️⃣ No empty {}
    if (cleanUrl.includes("{}")) return false;

    // 3️⃣ Ensure all braces are part of valid matches
    const totalValidBraces = matches.length * 2;
    if (totalValidBraces !== openCount + closeCount) return false;

    return true;
  };

  const handleSave = () => {
    setSaveName(requestName);
    setDependentOnId("");
    setIsSaveModalOpen(true);
  };

  const saveEndpoint = async (payload) => {
    const data: any = await fetch(`${BASE_URL}/endpoint/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  };

  const confirmSave = () => {
    const endpointData = {
      method,
      url: tempUrl,
      preRequest,
      preRequestScript,
      queryParams,
      pathParams,
      headers,
      bodyType,
      rawFormat,
      body: bodyContent,
      jsonFields,
      formData,
      urlEncoded,
      assertions,
      captures: postResponse,
      postResponseScript,
      setting,
      auth: globalAuth,
    };

    const payload = {
      apiId: endpoint.id,
      testCaseData: endpointData,
      dependentId: [dependentOnId],
      endpointName: saveName || requestName,
      controller: endpoint.tags[0] || "General",
    };
    saveEndpoint(payload);
    setIsSaveModalOpen(false);
    getSavedScenarios();
    toast.success("Request saved successfully");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <div className="p-4 border-b theme-border flex gap-2 theme-bg-surface/30 items-center shrink-0">
        <div
          className={`px-4 py-1.5 text-white font-black rounded-lg text-xs uppercase shadow-sm ${method === "GET" ? "bg-emerald-600" : method === "POST" ? "theme-accent-bg" : "bg-amber-600"}`}
        >
          {method}
        </div>
        <div className="flex-1 theme-bg-main border theme-border rounded-lg flex cursor-text">
          <VariableInput
            className="flex-1 bg-transparent px-4 py-2 text-xs font-mono theme-text-primary outline-none cursor-text opacity-80"
            value={tempUrl}
            variables={variables}
            onChange={(newUrl) => {
              setTempUrl(newUrl);

              const pathPart = newUrl.replace(baseUrl, "").split("?")[0];
              const keys = [
                ...pathPart.matchAll(/(?<!\$|\{)\{([^{}]+)\}(?!\})/g),
              ].map((m) => m[1]);
              const colonKeys = [
                ...pathPart.matchAll(/(?<!https?):([a-zA-Z0-9_]+)/g),
              ].map((m) => m[1]);
              const allKeys = Array.from(new Set([...keys, ...colonKeys]));

              if (isValidCurlyParams(newUrl) || !newUrl.includes("{")) {
                setUrlPath(pathPart);
              }

              setPathParams((prev) => {
                const existingKeys = prev.map((p) => p.key);
                const keysToRemove = existingKeys.filter(
                  (k) => !allKeys.includes(k),
                );
                const keysToAdd = allKeys.filter(
                  (k) => !existingKeys.includes(k),
                );

                if (keysToRemove.length === 0 && keysToAdd.length === 0) {
                  return prev;
                }

                let updated = prev.filter((p) => allKeys.includes(p.key));
                keysToAdd.forEach((k) => {
                  updated.push({
                    id: Math.random().toString(),
                    key: k,
                    value: "",
                    enabled: true,
                    description: "Added from URL",
                  });
                });
                return updated;
              });
            }}
          />
        </div>
        <button
          onClick={handleExecute}
          disabled={isExecuting}
          className="theme-accent-bg text-white px-8 py-2 rounded-lg font-bold text-xs hover:opacity-90 disabled:opacity-50 shadow-xl transition-all active:scale-95"
        >
          {isExecuting ? "Sending..." : "Send"}
        </button>
        <button
          onClick={handleSave}
          disabled={!hasRunRequest}
          className={`theme-bg-surface border theme-border theme-text-primary px-5 py-2 rounded-lg text-xs font-bold transition-all ${!hasRunRequest ? "opacity-50 cursor-not-allowed" : "hover:theme-bg-surface"}`}
        >
          Save
        </button>
      </div>

      <div
        className={`flex flex-col overflow-hidden transition-all duration-300 ${isResponseCollapsed ? "flex-1" : "h-1/2"}`}
      >
        {/* Tabs */}
        <div className="flex px-4 border-b theme-border theme-bg-main overflow-x-auto shrink-0">
          {(
            [
              "pre-request",
              "params",
              "headers",
              "auth",
              "body",
              "assertions",
              "post-response",
              "setting",
            ] as const
          ).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3.5 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === tab ? "border-indigo-500 theme-accent-text theme-bg-surface" : "border-transparent theme-text-secondary hover:theme-text-primary"}`}
            >
              {tab}
              {tab === "body" && bodyType !== "none" && (
                <span className="ml-2 w-2 h-2 rounded-full bg-[#71347B] inline-block"></span>
              )}
            </button>
          ))}
        </div>

        {/* Request Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === "pre-request" && (
            <div className="h-full flex flex-col space-y-4">
              <div className="flex justify-between items-center shrink-0">
                <h4 className="text-[11px] font-black theme-text-secondary uppercase tracking-[0.2em]">
                  Pre Request Script
                </h4>
              </div>
              <div className="flex-1 flex gap-4 min-h-0">
                <div className="w-64 flex flex-col gap-2 overflow-y-auto pr-2 border-r theme-border">
                  <h5 className="text-[10px] font-bold theme-text-secondary uppercase mb-2">
                    Snippets
                  </h5>
                  {[
                    {
                      name: "Set Variable",
                      code: 'pm.variables.set("variable_key", "variable_value");',
                    },
                    {
                      name: "Get Variable",
                      code: 'const value = pm.variables.get("variable_key");',
                    },
                    {
                      name: "Generate Random Number",
                      code: "const randomNum = Math.floor(Math.random() * 1000);",
                    },
                    {
                      name: "Generate Random String",
                      code: "const randomStr = Math.random().toString(36).substring(2, 10);",
                    },
                    {
                      name: "Generate Timestamp",
                      code: "const timestamp = Date.now();",
                    },
                  ].map((snippet) => (
                    <div
                      key={snippet.name}
                      className="flex items-center justify-between px-3 py-2 theme-bg-surface border theme-border rounded-lg group hover:border-indigo-500/50 transition-all"
                    >
                      <span className="text-[10px] font-bold theme-text-primary">
                        {snippet.name}
                      </span>
                      <button
                        onClick={() =>
                          setPreRequestScript(
                            (prev) => prev + (prev ? "\n" : "") + snippet.code,
                          )
                        }
                        className="theme-accent-text hover:theme-accent-bg hover:text-white p-1.5 rounded-md transition-all"
                        title="Add snippet"
                      >
                        <i className="fas fa-plus text-[10px]"></i>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex-1 flex flex-col min-h-0">
                  <VariableInput
                    type="textarea"
                    className="flex-1 w-full theme-bg-main border theme-border rounded-xl p-5 font-mono text-sm leading-relaxed focus:ring-2 focus:outline-none focus:ring-indigo-500/50 resize-none theme-text-primary shadow-inner"
                    value={preRequestScript}
                    variables={variables}
                    onChange={setPreRequestScript}
                    placeholder="// Enter your pre-request JS code here"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "params" && (
            <div className="space-y-8">
              <div className="space-y-4">
                <h4 className="text-[11px] font-black theme-text-secondary uppercase tracking-[0.2em]">
                  Path Parameters
                </h4>
                {pathParams.length > 0 ? (
                  <KVEditor
                    isEditable={false}
                    items={pathParams}
                    onUpdate={setPathParams}
                    variables={variables}
                  />
                ) : (
                  <p className="text-[10px] theme-text-secondary italic opacity-50">
                    No path parameters detected in URL.
                  </p>
                )}
              </div>
              <div className="space-y-4">
                <h4 className="text-[11px] font-black theme-text-secondary uppercase tracking-[0.2em]">
                  Query Parameters
                </h4>
                <KVEditor
                  isEditable={true}
                  items={queryParams}
                  onUpdate={setQueryParams}
                  variables={variables}
                />
              </div>
            </div>
          )}

          {activeTab === "headers" && (
            <div className="space-y-6">
              <h4 className="text-[11px] font-black theme-text-secondary uppercase tracking-[0.2em]">
                Request Headers
              </h4>
              <KVEditor
                isEditable={true}
                items={headers}
                onUpdate={setHeaders}
                variables={variables}
              />
            </div>
          )}

          {activeTab === "auth" && (
            <AuthHeader auth={globalAuth} setAuth={setGlobalAuth} compact />
          )}

          {activeTab === "body" && (
            <div className="h-full flex flex-col space-y-6">
              <div className="flex gap-6 text-[10px] font-black theme-text-secondary items-center flex-wrap">
                {(
                  [
                    "none",
                    "raw",
                    "form-data",
                    "x-www-form-urlencoded",
                    "binary",
                  ] as BodyType[]
                ).map((bt) => (
                  <label
                    key={bt}
                    className="flex items-center gap-2 cursor-pointer hover:theme-accent-text transition-colors group"
                  >
                    <input
                      type="radio"
                      checked={bodyType === bt}
                      onChange={() => setBodyType(bt)}
                      className="bg-[#71347B] w-4 h-4 rounded"
                    />
                    <span className="uppercase tracking-widest group-hover:underline underline-offset-4">
                      {bt.replace("-", " ")}
                    </span>
                  </label>
                ))}
              </div>

              {bodyType === "raw" && (
                <div className="flex-1 flex flex-col space-y-3">
                  <div className="flex items-center gap-3">
                    <select
                      value={rawFormat}
                      onChange={(e) =>
                        setRawFormat(e.target.value as RawFormat)
                      }
                      className="theme-bg-main border theme-border rounded-lg px-3 py-1.5 text-[10px] font-black uppercase theme-text-primary outline-none focus:ring-1 focus:ring-[#71347B]"
                    >
                      {["json", "xml", "text", "javascript", "html"].map(
                        (f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ),
                      )}
                    </select>
                    {(rawFormat === "json" || rawFormat === "xml") && (
                      <button
                        onClick={() => setShowBodyConfig(true)}
                        disabled={!isBodyValid}
                        className={`ml-auto theme-accent-bg text-white px-3 py-1 rounded text-[10px] font-black uppercase shadow transition-all ${
                          !isBodyValid
                            ? "opacity-50 cursor-not-allowed grayscale"
                            : "hover:scale-105 active:scale-95"
                        }`}
                      >
                        <i className="fas fa-cog mr-1"></i>
                        Configure
                      </button>
                    )}
                    <span className="text-[10px] theme-text-secondary italic font-medium">
                      Variables supported via {"$"}
                    </span>
                  </div>
                  <VariableInput
                    type="textarea"
                    className="flex-1 w-full theme-bg-main border theme-border rounded-xl p-5 font-mono text-sm leading-relaxed focus:ring-2 focus:outline-none focus:ring-indigo-500/50 resize-none theme-text-primary shadow-inner min-h-[150px]"
                    value={bodyContent}
                    variables={variables}
                    onChange={setBodyContent}
                    placeholder='{"key": "value"}'
                  />
                </div>
              )}
              {bodyType === "form-data" && (
                <KVEditor
                  isEditable={true}
                  items={formData}
                  onUpdate={setFormData}
                  showType
                  variables={variables}
                />
              )}
              {bodyType === "x-www-form-urlencoded" && (
                <KVEditor
                  isEditable={true}
                  items={urlEncoded}
                  onUpdate={setUrlEncoded}
                  variables={variables}
                />
              )}
              {bodyType === "binary" && (
                <div className="py-24 text-center border-2 border-dashed theme-border rounded-2xl theme-bg-workbench flex flex-col items-center gap-4">
                  <i className="fas fa-file-upload text-4xl theme-text-secondary opacity-30"></i>
                  <p className="text-sm font-bold theme-text-secondary">
                    {binaryFile
                      ? `Selected: ${binaryFile}`
                      : "Binary uploads are handled via file pickers."}
                  </p>
                  <input
                    type="file"
                    className="hidden"
                    id="binary-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setBinaryFile(file.name);
                        toast.success(
                          `File "${file.name}" uploaded successfully`,
                        );
                      }
                    }}
                  />
                  <label
                    htmlFor="binary-upload"
                    className="theme-accent-bg text-white px-6 py-2 rounded-lg text-xs font-bold shadow-lg cursor-pointer hover:opacity-90 transition-all"
                  >
                    {binaryFile ? "Change File" : "Select Binary File"}
                  </label>
                </div>
              )}
              {bodyType === "none" && (
                <div className="py-24 text-center theme-text-secondary text-sm italic font-medium opacity-50">
                  This request does not include a body.
                </div>
              )}
            </div>
          )}

          {activeTab === "assertions" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="text-[11px] font-black theme-text-secondary uppercase tracking-[0.2em]">
                  Validation Rules
                </h4>
                <button
                  onClick={() =>
                    setAssertions([
                      ...assertions,
                      {
                        id: Math.random().toString(),
                        type: "status_code",
                        operator: "eq",
                        expected: method === "POST" ? "201" : "200",
                      },
                    ])
                  }
                  className="text-[10px] theme-accent-text hover:underline font-black tracking-widest"
                >
                  + ADD NEW ASSERTION
                </button>
              </div>
              <div className="space-y-3">
                {assertions.map((a) => (
                  <div
                    key={a.id}
                    className="flex gap-3 items-center theme-bg-surface p-3 rounded-xl border theme-border shadow-sm group"
                  >
                    <select
                      value={a.type}
                      onChange={(e) =>
                        setAssertions(
                          assertions.map((item) =>
                            item.id === a.id
                              ? { ...item, type: e.target.value as any }
                              : item,
                          ),
                        )
                      }
                      className="theme-bg-main border theme-border rounded-lg text-[10px] font-bold p-2 w-36 outline-none"
                    >
                      <option value="status_code">Status Code</option>
                      <option value="response_time">Response Time</option>
                      <option value="json_path">JSON Path</option>
                      <option value="body">Response Body</option>
                      <option value="header_value">Header Value</option>
                    </select>
                    {a.type === "json_path" || a.type === "header_value" ? (
                      <input
                        value={a.property || ""}
                        onChange={(e) =>
                          setAssertions(
                            assertions.map((item) =>
                              item.id === a.id
                                ? { ...item, property: e.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder={
                          a.type === "json_path" ? "$.path" : "Header Name"
                        }
                        className="theme-bg-main border theme-border rounded-lg text-[10px] font-bold p-2 flex-1 outline-none"
                      />
                    ) : null}
                    <select
                      value={a.operator}
                      onChange={(e) =>
                        setAssertions(
                          assertions.map((item) =>
                            item.id === a.id
                              ? { ...item, operator: e.target.value as any }
                              : item,
                          ),
                        )
                      }
                      className="theme-bg-main border theme-border rounded-lg text-[10px] font-bold p-2 w-24 outline-none"
                    >
                      <option value="eq">==</option>
                      <option value="neq">!=</option>
                      <option value="contains">contains</option>
                      <option value="gt">&gt;</option>
                      <option value="lt">&lt;</option>
                      <option value="exists">exists</option>
                    </select>
                    <input
                      value={a.expected}
                      onChange={(e) =>
                        setAssertions(
                          assertions.map((item) =>
                            item.id === a.id
                              ? { ...item, expected: e.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Expected value..."
                      className="theme-bg-main border theme-border rounded-lg text-[10px] font-bold p-2 flex-1 outline-none"
                    />
                    <button
                      onClick={() =>
                        setAssertions(
                          assertions.filter((item) => item.id !== a.id),
                        )
                      }
                      className="text-rose-500 hover:text-rose-400 p-2 opacity-50 group-hover:opacity-100 transition-opacity"
                    >
                      <i className="fas fa-trash-alt text-[11px]"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "post-response" && (
            <div className="h-full flex flex-col space-y-4">
              <div className="mt-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h5 className="text-[10px] font-black theme-text-secondary uppercase tracking-widest">
                    Capture Rules (Legacy)
                  </h5>
                  <button
                    onClick={() =>
                      setPostResponse([
                        ...postResponse,
                        {
                          id: Math.random().toString(),
                          type: "json_path",
                          variableName: "",
                        },
                      ])
                    }
                    className="text-[10px] theme-accent-text hover:underline font-black tracking-widest"
                  >
                    + NEW CAPTURE RULE
                  </button>
                </div>
                {postResponse.map((c) => (
                  <div
                    key={c.id}
                    className="flex gap-4 items-center theme-bg-surface p-4 rounded-xl border theme-border shadow-sm group"
                  >
                    <select
                      value={c.type}
                      onChange={(e) =>
                        setPostResponse(
                          postResponse.map((item) =>
                            item.id === c.id
                              ? { ...item, type: e.target.value as any }
                              : item,
                          ),
                        )
                      }
                      className="theme-bg-main border theme-border rounded-lg text-[10px] font-bold p-2 w-36 outline-none"
                    >
                      <option value="json_path">JSON Path</option>
                    </select>
                    <input
                      value={c.property || ""}
                      onChange={(e) =>
                        setPostResponse(
                          postResponse.map((item) =>
                            item.id === c.id
                              ? { ...item, property: e.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="e.g. $.id"
                      className="theme-bg-main border theme-border rounded-lg text-[10px] font-bold p-2 flex-1 outline-none"
                    />
                    <span className="text-[10px] font-black theme-text-secondary uppercase">
                      Save As
                    </span>
                    <VariableInput
                      value={c.variableName}
                      onChange={(val) =>
                        setPostResponse(
                          postResponse.map((item) =>
                            item.id === c.id
                              ? { ...item, variableName: val }
                              : item,
                          ),
                        )
                      }
                      variables={variables}
                      insertRawName={true}
                      placeholder="variable_name"
                      className="theme-bg-main border theme-border rounded-lg text-[10px] font-bold p-2 flex-1 outline-none"
                    />
                    <button
                      onClick={() =>
                        setPostResponse(
                          postResponse.filter((item) => item.id !== c.id),
                        )
                      }
                      className="text-rose-500 p-2 opacity-50 group-hover:opacity-100 transition-opacity"
                    >
                      <i className="fas fa-trash-alt text-[11px]"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "setting" && (
            <div className="space-y-8 max-w-3xl">
              <div className="space-y-6">
                <h4 className="text-[11px] font-black theme-text-secondary uppercase tracking-[0.2em]">
                  Request Settings
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* TLS Verification */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={setting.tlsVerification}
                        onChange={(e) =>
                          setSetting({
                            ...setting,
                            tlsVerification: e.target.checked,
                          })
                        }
                        className="accent-indigo-500 w-4 h-4 rounded"
                      />
                      <span className="text-xs font-bold theme-text-primary group-hover:theme-accent-text transition-colors">
                        TLS certificate verification
                      </span>
                    </label>
                    <p className="text-[10px] theme-text-secondary ml-7 leading-relaxed">
                      Verify TLS certificate when sending any request.
                    </p>
                  </div>

                  {/* Request Timeout */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold theme-text-primary">
                      Request Timeout (ms)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={setting.requestTimeout}
                        onChange={(e) =>
                          setSetting({
                            ...setting,
                            requestTimeout: parseInt(e.target.value) || 0,
                          })
                        }
                        className="theme-bg-main border theme-border rounded-lg px-3 py-2 text-xs font-mono theme-text-primary w-32 outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <span className="text-[10px] theme-text-secondary font-black uppercase">
                        Ms
                      </span>
                    </div>
                    <p className="text-[10px] theme-text-secondary leading-relaxed">
                      To set how long a request should wait for a response
                      before timing out. To never time out, set to 0.
                    </p>
                  </div>

                  {/* Expected Status Code */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold theme-text-primary">
                      Expected Status Code
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={setting.expectedStatusCode || ""}
                        onChange={(e) =>
                          setSetting({
                            ...setting,
                            expectedStatusCode: e.target.value,
                          })
                        }
                        className="theme-bg-main border theme-border rounded-lg px-3 py-2 text-xs font-mono theme-text-primary w-32 outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                    <p className="text-[10px] theme-text-secondary leading-relaxed">
                      The expected HTTP status code for the request.
                    </p>
                  </div>

                  {/* Max Redirects */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold theme-text-primary">
                      Maximum number of redirects to follow
                    </label>
                    <input
                      type="number"
                      value={setting.maxRedirects}
                      onChange={(e) =>
                        setSetting({
                          ...setting,
                          maxRedirects: parseInt(e.target.value) || 0,
                        })
                      }
                      className="theme-bg-main border theme-border rounded-lg px-3 py-2 text-xs font-mono theme-text-primary w-32 outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                    <p className="text-[10px] theme-text-secondary leading-relaxed">
                      To set a limit on the maximum number of redirects to
                      follow for any request.
                    </p>
                  </div>

                  {/* Redirect Behaviors */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={setting.autoRedirectDefault}
                          onChange={(e) =>
                            setSetting({
                              ...setting,
                              autoRedirectDefault: e.target.checked,
                            })
                          }
                          className="accent-indigo-500 w-4 h-4 rounded"
                        />
                        <span className="text-xs font-bold theme-text-primary group-hover:theme-accent-text transition-colors">
                          Automatically redirect with default HTTP method
                        </span>
                      </label>
                      <p className="text-[10px] theme-text-secondary ml-7 leading-relaxed">
                        Follow HTTP 3xx responses as redirects, using default
                        behavior of redirecting with GET method.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={setting.redirectOriginalMethod}
                          onChange={(e) =>
                            setSetting({
                              ...setting,
                              redirectOriginalMethod: e.target.checked,
                            })
                          }
                          className="accent-indigo-500 w-4 h-4 rounded"
                        />
                        <span className="text-xs font-bold theme-text-primary group-hover:theme-accent-text transition-colors">
                          Redirect with original HTTP method
                        </span>
                      </label>
                      <p className="text-[10px] theme-text-secondary ml-7 leading-relaxed">
                        To redirect with the original HTTP method instead of the
                        default behavior of redirecting with GET method.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={setting.retainAuthOnRedirect}
                          onChange={(e) =>
                            setSetting({
                              ...setting,
                              retainAuthOnRedirect: e.target.checked,
                            })
                          }
                          className="accent-indigo-500 w-4 h-4 rounded"
                        />
                        <span className="text-xs font-bold theme-text-primary group-hover:theme-accent-text transition-colors">
                          Retain authorization header while redirects
                        </span>
                      </label>
                      <p className="text-[10px] theme-text-secondary ml-7 leading-relaxed">
                        To retain authorization header even when a redirect
                        happens to a different hostname.
                      </p>
                    </div>
                  </div>
                </div>

                {/* TLS Protocols */}
                <div className="space-y-4 border-t theme-border pt-6">
                  <h5 className="text-[10px] font-black theme-text-secondary uppercase tracking-[0.2em]">
                    TLS Protocols Enabled
                  </h5>
                  <div className="flex flex-wrap gap-6">
                    {(["tls10", "tls11", "tls12", "tls13"] as const).map(
                      (proto) => (
                        <label
                          key={proto}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={setting.tlsProtocols[proto]}
                            onChange={(e) =>
                              setSetting({
                                ...setting,
                                tlsProtocols: {
                                  ...setting.tlsProtocols,
                                  [proto]: e.target.checked,
                                },
                              })
                            }
                            className="accent-indigo-500 w-4 h-4 rounded"
                          />
                          <span className="text-xs font-bold theme-text-primary group-hover:theme-accent-text transition-colors uppercase">
                            {proto.replace("tls", "TLS v")}
                          </span>
                        </label>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Response Panel - Permanently visible bottom section */}
      <div
        className={`transition-all duration-300 border-t theme-border flex flex-col theme-bg-surface shadow-[0_-8px_30px_rgba(0,0,0,0.15)] z-20 overflow-hidden ${isResponseCollapsed ? "h-10" : "flex-1 min-h-[250px]"}`}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-2 theme-bg-main border-b theme-border shrink-0">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setIsResponseCollapsed(!isResponseCollapsed)}
              className="p-1.5 hover:theme-bg-surface rounded-md theme-text-secondary transition-all"
              title={
                isResponseCollapsed ? "Expand Response" : "Collapse Response"
              }
            >
              <i
                className={`fas fa-chevron-${isResponseCollapsed ? "up" : "down"} text-[10px]`}
              ></i>
            </button>
            <h4 className="text-[10px] font-black theme-text-secondary uppercase tracking-[0.2em]">
              Response
            </h4>

            {!isResponseCollapsed && executionResult && (
              <div className="flex gap-4 border-l theme-border pl-6 ml-2">
                {(["body", "headers", "results", "request"] as const).map(
                  (t) => (
                    <button
                      key={t}
                      onClick={() => setResponseTab(t)}
                      className={`text-[9px] font-black uppercase tracking-[0.2em] py-1 transition-all ${responseTab === t ? "theme-accent-text border-b border-indigo-500" : "theme-text-secondary hover:theme-text-primary"}`}
                    >
                      {t}{" "}
                      {t === "results" &&
                        executionResult.assertionResults.length > 0 && (
                          <span className="ml-1 text-[8px] theme-bg-main px-1.5 py-0.5 rounded-full border theme-border">
                            {executionResult.assertionResults.length}
                          </span>
                        )}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          {executionResult && !isResponseCollapsed && (
            <div className="flex gap-6 text-[10px] font-black items-center">
              <div
                className={`flex items-center gap-2 px-3 py-1 rounded-lg ${executionResult.statusCode >= 200 && executionResult.statusCode < 400 ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"}`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${executionResult.statusCode >= 200 && executionResult.statusCode < 400 ? "bg-emerald-500" : "bg-rose-500"}`}
                ></span>
                {executionResult.statusCode || "ERROR"}{" "}
                {executionResult.statusText}
              </div>
              <div className="theme-text-secondary flex items-center gap-2 opacity-80">
                <i className="far fa-clock"></i>
                {executionResult.responseTime}ms
              </div>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col theme-bg-workbench">
          {!isResponseCollapsed && (
            <>
              {isExecuting ? (
                <div className="h-full flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                  <p className="text-xs font-black uppercase tracking-widest theme-text-secondary animate-pulse">
                    Request in progress...
                  </p>
                </div>
              ) : executionResult ? (
                <div className="flex-1 flex flex-col overflow-hidden p-6">
                  {responseTab === "body" && (
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="flex justify-between items-center mb-3 px-1 shrink-0">
                        <span className="text-[10px] theme-text-secondary font-black uppercase tracking-widest opacity-60">
                          Format:{" "}
                          {executionResult.response.headers[
                            "content-type"
                          ]?.includes("json")
                            ? "JSON"
                            : "RAW"}
                        </span>
                        <span className="text-[10px] theme-text-secondary italic font-medium opacity-60">
                          Received at{" "}
                          {new Date(
                            executionResult.timestamp,
                          ).toLocaleTimeString()}
                        </span>
                      </div>
                      {executionResult.status === "error" && (
                        <div className="mb-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs shrink-0">
                          <p className="font-black mb-2 uppercase tracking-widest flex items-center gap-2">
                            <i className="fas fa-exclamation-triangle"></i>{" "}
                            Execution Failed
                          </p>
                          <ul className="list-disc ml-5 space-y-1 opacity-80">
                            {executionResult.response.body.troubleshooting?.map(
                              (item: string, i: number) => (
                                <li key={i}>{item}</li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                      <div className="flex-1 min-h-0 theme-bg-workbench/40 rounded-xl overflow-hidden border theme-border flex flex-col shadow-inner">
                        <pre className="flex-1 p-5 text-xs font-mono theme-text-primary leading-relaxed overflow-auto scroll-smooth custom-scrollbar">
                          {typeof executionResult.response.body === "object"
                            ? JSON.stringify(
                                executionResult.response.body,
                                null,
                                2,
                              )
                            : executionResult.response.body}
                        </pre>
                      </div>
                    </div>
                  )}

                  {responseTab === "headers" && (
                    <div className="flex-1 overflow-auto space-y-4 max-w-4xl">
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] theme-text-secondary flex items-start gap-3">
                        <i className="fas fa-info-circle mt-0.5 text-amber-500"></i>
                        <p>
                          Browsers restrict access to most response headers
                          unless the server explicitly exposes them via{" "}
                          <b>Access-Control-Expose-Headers</b>.
                        </p>
                      </div>
                      <div className="space-y-2">
                        {Object.keys(executionResult.response.headers)
                          .length === 0 ? (
                          <div className="py-10 text-center text-xs theme-text-secondary opacity-50 italic">
                            No accessible headers found.
                          </div>
                        ) : (
                          Object.entries(executionResult.response.headers).map(
                            ([k, v]) => (
                              <div
                                key={k}
                                className="flex gap-6 text-[11px] py-2 border-b border-white/5 last:border-none group"
                              >
                                <span className="w-48 font-black theme-text-secondary uppercase tracking-tighter shrink-0 group-hover:theme-accent-text transition-colors">
                                  {k}
                                </span>
                                <span className="theme-text-primary font-mono break-all opacity-90">
                                  {String(v)}
                                </span>
                              </div>
                            ),
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {responseTab === "results" && (
                    <div className="flex-1 overflow-auto space-y-4 max-w-4xl">
                      {executionResult.assertionResults.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-30">
                          <i className="fas fa-tasks text-4xl mb-4"></i>
                          <p className="text-xs font-black uppercase tracking-widest">
                            No Assertions Configured
                          </p>
                        </div>
                      ) : (
                        executionResult.assertionResults.map((r, i) => (
                          <div
                            key={i}
                            className={`p-5 rounded-2xl border flex items-center justify-between gap-6 transition-all ${r.passed ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20 shadow-lg"}`}
                          >
                            <div className="flex items-center gap-5">
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-sm ${r.passed ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500"}`}
                              >
                                <i
                                  className={`fas fa-${r.passed ? "check" : "times"}`}
                                ></i>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-black theme-text-primary uppercase tracking-widest">
                                  {r.assertion.type.replace("_", " ")}
                                </span>
                                <span className="text-xs theme-text-secondary font-medium">
                                  Expected {r.assertion.operator}{" "}
                                  <b className="theme-text-primary">
                                    {r.assertion.expected}
                                  </b>{" "}
                                  {r.assertion.property && (
                                    <>
                                      for{" "}
                                      <span className="font-mono text-[10px] theme-bg-main px-1.5 py-0.5 rounded border theme-border">
                                        {r.assertion.property}
                                      </span>
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>
                            <div className="text-right flex flex-col gap-1">
                              <span
                                className={`text-[10px] font-black tracking-widest block ${r.passed ? "text-emerald-500" : "text-rose-500"}`}
                              >
                                {r.passed ? "SUCCESS" : "FAILURE"}
                              </span>
                              <span className="text-xs theme-text-secondary font-mono theme-bg-workbench px-3 py-1 rounded-lg">
                                Actual: {r.actual}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {responseTab === "request" && (
                    <div className="flex-1 overflow-auto space-y-6 max-w-4xl">
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black theme-text-secondary uppercase tracking-widest mb-3 border-b theme-border pb-2">
                          General
                        </h4>
                        <div className="grid grid-cols-[120px_1fr] gap-y-3 gap-x-4 text-[11px]">
                          <div className="font-bold theme-text-secondary">
                            Request URL
                          </div>
                          <div className="theme-text-primary break-all">
                            {executionResult.request.url}
                          </div>

                          <div className="font-bold theme-text-secondary">
                            Request Method
                          </div>
                          <div className="theme-text-primary">
                            {executionResult.request.method}
                          </div>

                          <div className="font-bold theme-text-secondary">
                            Status Code
                          </div>
                          <div className="theme-text-primary">
                            {executionResult.statusCode}{" "}
                            {executionResult.statusText}
                          </div>

                          <div className="font-bold theme-text-secondary">
                            Remote Address
                          </div>
                          <div className="theme-text-primary opacity-50 italic">
                            N/A (Browser fetch)
                          </div>

                          <div className="font-bold theme-text-secondary">
                            Referrer Policy
                          </div>
                          <div className="theme-text-primary">
                            strict-origin-when-cross-origin
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black theme-text-secondary uppercase tracking-widest mb-3 border-b theme-border pb-2">
                          Request Headers
                        </h4>
                        {Object.keys(executionResult.request.headers).length ===
                        0 ? (
                          <div className="text-[11px] theme-text-secondary italic">
                            No headers sent.
                          </div>
                        ) : (
                          <div className="grid grid-cols-[120px_1fr] gap-y-2 gap-x-4 text-[11px]">
                            {Object.entries(
                              executionResult.request.headers,
                            ).map(([k, v]) => (
                              <React.Fragment key={k}>
                                <div className="font-bold theme-text-secondary">
                                  {k}
                                </div>
                                <div className="theme-text-primary break-all">
                                  {v as string}
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                      </div>

                      {executionResult.request.body && (
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-black theme-text-secondary uppercase tracking-widest mb-3 border-b theme-border pb-2">
                            Request Payload
                          </h4>
                          <div className="theme-bg-workbench/40 rounded-xl overflow-hidden border theme-border shadow-inner">
                            <pre className="p-4 text-[11px] font-mono theme-text-primary whitespace-pre-wrap break-all">
                              {typeof executionResult.request.body === "object"
                                ? JSON.stringify(
                                    executionResult.request.body,
                                    null,
                                    2,
                                  )
                                : executionResult.request.body}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
                  <div className="w-16 h-16 theme-bg-main border-2 theme-border rounded-2xl flex items-center justify-center mb-6 shadow-2xl rotate-3 hover:rotate-0 transition-transform">
                    <i className="fas fa-paper-plane text-2xl theme-accent-text"></i>
                  </div>
                  <h5 className="text-[10px] font-black uppercase tracking-[0.3em] mb-2">
                    Endpoint Ready
                  </h5>
                  <p className="text-[10px] theme-text-secondary max-w-xs font-medium italic">
                    Click{" "}
                    <span className="theme-accent-text font-bold uppercase">
                      Send
                    </span>{" "}
                    to view response data.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {showBodyConfig && (
        <BodyConfigModal
          endpoint={endpoint}
          format={rawFormat}
          content={bodyContent}
          variables={variables}
          spec={spec}
          onClose={() => setShowBodyConfig(false)}
          onUpdate={setBodyContent}
          onUpdateFields={setJsonFields}
        />
      )}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="theme-bg-surface border theme-border rounded-xl shadow-2xl w-[500px] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b theme-border theme-bg-workbench/50">
              <h3 className="text-sm font-black text-white tracking-widest uppercase">
                Save Request
              </h3>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="theme-text-secondary hover:text-white transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black theme-text-secondary uppercase tracking-widest">
                  Request Name
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="w-full theme-bg-workbench border theme-border rounded-lg px-4 py-2.5 text-sm theme-text-primary focus:ring-2 focus:ring-theme-accent-text/50 outline-none transition-all"
                  placeholder="Enter request name..."
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black theme-text-secondary uppercase tracking-widest">
                  Pre-conditions (Dependencies)
                </label>
                <p className="text-xs theme-text-secondary italic">
                  Select requests that must run before this one.
                </p>
                <div className="border theme-border rounded-lg overflow-hidden theme-bg-workbench max-h-[200px] overflow-y-auto">
                  {savedTestCases.length > 0 ? (
                    <div className="divide-y divide-theme-border">
                      {savedTestCases.map((tc) => (
                        <label
                          key={tc.id}
                          className="flex items-center gap-3 p-3 hover:theme-bg-surface transition-colors cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="rounded cursor-pointer"
                            checked={dependentOnId === tc.id}
                            onChange={() =>
                              setDependentOnId(
                                dependentOnId === tc.id ? "" : tc.id,
                              )
                            }
                          />
                          <div className="text-[10px] font-mono theme-text-secondary theme-bg-workbench px-1.5 py-0.5 rounded border theme-border">
                            {tc.id}
                          </div>
                          <span className="text-xs theme-text-primary truncate flex-1 font-medium">
                            {tc.endpointName}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs theme-text-secondary">
                      No saved scenarios available.
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t theme-border flex items-center justify-end gap-3 theme-bg-workbench/30">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-5 py-2 text-xs font-bold theme-text-secondary hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSave}
                className="px-6 py-2 theme-accent-bg text-white rounded-lg text-xs font-bold hover:theme-accent-hover transition-colors shadow-lg shadow-indigo-500/20"
              >
                Save Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface KVEditorProps {
  isEditable: boolean;
  items: KVItem[];
  onUpdate: (items: KVItem[]) => void;
  showType?: boolean;
  variables: Record<string, string>;
}

const VariableInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  variables: Record<string, string>;
  readOnly?: boolean;
  type?: "text" | "textarea";
  insertRawName?: boolean;
}> = ({
  value,
  onChange,
  placeholder,
  className,
  variables,
  readOnly,
  type = "text",
  insertRawName = false,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const updateCursorPos = () => {
    if (inputRef.current) {
      setCursorPos(inputRef.current.selectionStart || 0);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const newVal = e.target.value;
    const pos = e.target.selectionStart || 0;
    setCursorPos(pos);
    onChange(newVal);

    // Show dropdown if last typed char was $
    if (newVal[pos - 1] === "$") {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  };

  const selectVariable = (varName: string) => {
    const before = value.substring(0, cursorPos);
    const after = value.substring(cursorPos);

    const cleanBefore = before.endsWith("$") ? before.slice(0, -1) : before;
    const newVal = insertRawName
      ? cleanBefore + varName + after
      : cleanBefore + "${" + varName + "}" + after;

    onChange(newVal);
    setShowDropdown(false);

    // Focus back and set cursor after the inserted variable
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = insertRawName
          ? cleanBefore.length + varName.length
          : cleanBefore.length + varName.length + 3;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  return (
    <div
      className={`relative flex-1 flex ${type === "textarea" ? "items-stretch" : "items-center"}`}
    >
      {type === "textarea" ? (
        <textarea
          ref={inputRef as any}
          className={`${className} h-full`}
          placeholder={placeholder}
          value={value}
          readOnly={readOnly}
          onChange={handleInputChange}
          onKeyUp={updateCursorPos}
          onClick={updateCursorPos}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        />
      ) : (
        <input
          ref={inputRef as any}
          type="text"
          className={className}
          placeholder={placeholder}
          value={value}
          readOnly={readOnly}
          onChange={handleInputChange}
          onKeyUp={updateCursorPos}
          onClick={updateCursorPos}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        />
      )}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          updateCursorPos();
          setShowDropdown(!showDropdown);
        }}
        className={`absolute right-3 text-indigo-400 hover:text-indigo-300 transition-colors p-1 z-10 ${type === "textarea" ? "top-3" : ""}`}
        title="Insert variable"
      >
        <i className="fas fa-dollar-sign text-[10px]"></i>
      </button>
      {showDropdown && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className={`absolute z-50 right-2 w-48 theme-bg-surface border theme-border rounded-lg shadow-2xl max-h-48 overflow-y-auto py-1 animate-in fade-in zoom-in duration-150 ${type === "textarea" ? "top-10" : "top-8"}`}
        >
          <div className="px-3 py-1 border-b theme-border mb-1">
            <span className="text-[8px] font-black theme-text-secondary uppercase tracking-widest">
              Select Variable
            </span>
          </div>
          {Object.keys(variables).length === 0 ? (
            <div className="px-3 py-4 text-center text-[10px] theme-text-secondary italic">
              No variables defined
            </div>
          ) : (
            Object.keys(variables).map((v) => (
              <button
                key={v}
                onClick={() => selectVariable(v)}
                className="w-full text-left px-3 py-2 text-[10px] font-bold theme-text-primary hover:theme-accent-bg hover:text-white transition-all flex items-center justify-between group"
              >
                <span>{v}</span>
                <i className="fas fa-plus text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"></i>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const KVEditor: React.FC<KVEditorProps> = ({
  isEditable = true,
  items,
  onUpdate,
  showType,
  variables,
}) => {
  const [editingConstraintId, setEditingConstraintId] = useState<string | null>(
    null,
  );

  const addRow = () =>
    onUpdate([
      ...items,
      {
        id: Math.random().toString(),
        key: "",
        value: "",
        enabled: true,
        type: "text",
        constraint: "",
      },
    ]);
  const updateRow = (id: string, field: keyof KVItem, val: any) =>
    onUpdate(
      items.map((item) => (item.id === id ? { ...item, [field]: val } : item)),
    );
  const removeRow = (id: string) =>
    onUpdate(items.filter((item) => item.id !== id));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[40px_1fr_1fr_1fr_100px_40px] gap-4 text-[10px] font-black theme-text-secondary px-3 uppercase tracking-[0.2em] opacity-60">
        <span></span>
        <span>Key</span>
        <span>Value</span>
        <span>Constraint</span>
        <span>Mode</span>
        <span></span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[40px_1fr_1fr_1fr_100px_40px] gap-4 items-center group theme-bg-surface/30 p-1.5 rounded-xl border border-transparent hover:border-indigo-500/30 transition-all"
          >
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={(e) =>
                  updateRow(item.id, "enabled", e.target.checked)
                }
                className="accent-indigo-500 w-4 h-4 rounded"
              />
            </div>
            <input
              className="theme-bg-main border theme-border rounded-lg px-4 py-2 text-xs font-mono theme-text-primary focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
              placeholder="key"
              value={item.key}
              onChange={(e) => {
                updateRow(item.id, "key", e.target.value);
              }}
            />
            <div className="flex gap-2 items-center">
              {showType && (
                <select
                  value={item.type}
                  onChange={(e) => updateRow(item.id, "type", e.target.value)}
                  className="theme-bg-main border theme-border rounded-lg text-[10px] font-bold p-2 theme-text-primary outline-none shrink-0"
                >
                  <option value="text">TEXT</option>
                  <option value="file">FILE</option>
                </select>
              )}
              {item.options ? (
                <select
                  className="flex-1 theme-bg-main border theme-border rounded-lg px-4 py-2 text-xs font-mono theme-text-primary focus:ring-2 focus:ring-indigo-500/50 outline-none"
                  value={item.value}
                  onChange={(e) => updateRow(item.id, "value", e.target.value)}
                >
                  <option value="">-- select --</option>
                  {item.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : item.type === "file" ? (
                <div className="flex-1 flex gap-2 items-center">
                  <input
                    type="file"
                    id={`file-${item.id}`}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        updateRow(item.id, "value", file.name);
                        toast.success(
                          `File "${file.name}" uploaded successfully`,
                        );
                      }
                    }}
                  />
                  <label
                    htmlFor={`file-${item.id}`}
                    className="flex-1 theme-bg-main border theme-border rounded-lg px-4 py-2 text-xs font-mono theme-text-secondary cursor-pointer hover:theme-accent-bg/10 transition-all truncate"
                  >
                    {item.value || "Select File"}
                  </label>
                </div>
              ) : (
                <VariableInput
                  className="flex-1 theme-bg-main border theme-border rounded-lg px-4 py-2 text-xs font-mono theme-text-primary focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                  placeholder="value"
                  value={item.value}
                  variables={variables}
                  onChange={(val) => updateRow(item.id, "value", val)}
                />
              )}
            </div>
            <input
              className="theme-bg-main border theme-border rounded-lg px-4 py-2 text-xs font-mono theme-text-primary focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all cursor-pointer"
              placeholder="constraint"
              value={item.constraint || ""}
              readOnly
              onClick={() => setEditingConstraintId(item.id)}
            />
            <div className="flex justify-center">
              <div className="flex theme-bg-workbench/50 p-0.5 rounded-lg border theme-border">
                <button
                  onClick={() => updateRow(item.id, "mode", "static")}
                  className={`px-2 py-1 text-[8px] font-black uppercase rounded transition-all ${!item.mode || item.mode === "static" ? "theme-accent-bg text-white shadow-lg" : "theme-text-secondary hover:theme-text-primary"}`}
                >
                  Static
                </button>
                <button
                  onClick={() => updateRow(item.id, "mode", "dynamic")}
                  className={`px-2 py-1 text-[8px] font-black uppercase rounded transition-all ${item.mode === "dynamic" ? "theme-accent-bg text-white shadow-lg" : "theme-text-secondary hover:theme-text-primary"}`}
                >
                  Dynamic
                </button>
              </div>
            </div>
            {isEditable && (
              <div className="flex justify-center">
                <button
                  onClick={() => removeRow(item.id)}
                  className="text-rose-500 opacity-20 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-90"
                >
                  <i className="fas fa-trash-alt text-[11px]"></i>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {isEditable && (
        <button
          onClick={addRow}
          className="theme-accent-text text-[10px] font-black uppercase hover:underline tracking-widest px-3 py-1 rounded-lg hover:theme-accent-bg/10 transition-all"
        >
          + Add Entry
        </button>
      )}
      <ConstraintModal
        isOpen={!!editingConstraintId}
        initialValue={
          items.find((i) => i.id === editingConstraintId)?.constraint || ""
        }
        onClose={() => setEditingConstraintId(null)}
        onSave={(val) => {
          if (editingConstraintId) {
            const newItems = items.map((item) => {
              if (item.id === editingConstraintId) {
                const enumMatch = val.match(/(?:^|,\s*)enum:([^,]+)/);
                return {
                  ...item,
                  constraint: val,
                  options: enumMatch ? enumMatch[1].split("|") : undefined,
                };
              }
              return item;
            });
            onUpdate(newItems);
          }
        }}
      />
    </div>
  );
};

interface BodyConfigModalProps {
  endpoint: ApiEndpoint;
  format: RawFormat;
  content: string;
  variables: Record<string, string>;
  spec: any;
  onClose: () => void;
  onUpdate: (val: string) => void;
  onUpdateFields?: (fields: KVItem[]) => void;
}

const BodyConfigModal: React.FC<BodyConfigModalProps> = ({
  endpoint,
  format,
  content,
  variables,
  spec,
  onClose,
  onUpdate,
  onUpdateFields,
}) => {
  const [localContent, setLocalContent] = useState(content);
  const [jsonFields, setJsonFields] = useState<KVItem[]>([]);
  const [editingConstraintId, setEditingConstraintId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const fields: KVItem[] = [];

    const resolveRef = (ref: string): any => {
      if (!ref || !spec) return null;
      const parts = ref.split("/");
      let current = spec;
      for (let i = 1; i < parts.length; i++) {
        if (!current) return null;
        current = current[parts[i]];
      }
      return current;
    };

    const getConstraintForPath = (
      path: string,
    ): { constraint: string; options?: string[] } => {
      let schema: any = null;
      if (endpoint.requestBody?.content?.["application/json"]?.schema) {
        schema = endpoint.requestBody.content["application/json"].schema;
      } else {
        const bodyParam = endpoint.parameters?.find((p) => p.in === "body");
        if (bodyParam?.schema) {
          schema = bodyParam.schema;
        }
      }

      if (!schema) return { constraint: "" };

      const getResolvedSchema = (
        schemaObj: any,
        visited = new Set<string>(),
      ): any => {
        if (!schemaObj) return schemaObj;
        let resolved = { ...schemaObj };

        if (resolved.$ref) {
          if (visited.has(resolved.$ref)) return resolved;
          visited.add(resolved.$ref);
          const refResolved = resolveRef(resolved.$ref);
          if (refResolved) {
            resolved = {
              ...resolved,
              ...getResolvedSchema(refResolved, visited),
            };
          }
          delete resolved.$ref;
        }

        if (resolved.allOf && Array.isArray(resolved.allOf)) {
          resolved.allOf.forEach((sub: any) => {
            const subResolved = getResolvedSchema(sub, visited);
            if (subResolved.properties) {
              resolved.properties = {
                ...(resolved.properties || {}),
                ...subResolved.properties,
              };
            }
            if (subResolved.required) {
              resolved.required = [
                ...(resolved.required || []),
                ...subResolved.required,
              ];
            }
          });
        }
        return resolved;
      };

      const parts = path.split(/\.|(?=\[)/).map((p) => p.replace(/\[|\]/g, ""));
      let current = getResolvedSchema(schema);
      let isRequired = false;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!current) break;

        current = getResolvedSchema(current);

        if (!isNaN(parseInt(part))) {
          // Array index
          current = current.items
            ? getResolvedSchema(current.items)
            : undefined;
        } else {
          // Object property
          if (
            current.required &&
            Array.isArray(current.required) &&
            current.required.includes(part)
          ) {
            isRequired = true;
          } else {
            isRequired = true;
          }
          current = current.properties ? current.properties[part] : undefined;
        }
      }

      if (!current) return { constraint: "" };
      current = getResolvedSchema(current);

      const c: string[] = [];
      c.push(`required:${isRequired}`);
      if (current.type) c.push(`type:${current.type}`);
      if (current.pattern) c.push(`pattern:${current.pattern}`);
      if (current.minLength !== undefined)
        c.push(`minLen:${current.minLength}`);
      if (current.maxLength !== undefined)
        c.push(`maxLen:${current.maxLength}`);
      if (current.minimum !== undefined) c.push(`min:${current.minimum}`);
      if (current.maximum !== undefined) c.push(`max:${current.maximum}`);

      let options: string[] | undefined = undefined;
      if (current.enum && Array.isArray(current.enum)) {
        options = current.enum.map(String);
        c.push(`enum:${options.join("|")}`);
      }

      return { constraint: c.join(", "), options };
    };

    if (format === "json") {
      try {
        const parsed = JSON.parse(content);
        const extractFields = (obj: any, prefix = "") => {
          if (obj === null) return;
          if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
              const path = prefix ? `${prefix}[${index}]` : `[${index}]`;
              if (typeof item === "object" && item !== null) {
                extractFields(item, path);
              } else {
                const constraintData = getConstraintForPath(path);
                fields.push({
                  id: Math.random().toString(),
                  key: path,
                  value: String(item),
                  dataType: typeof item,
                  enabled: true,
                  mode: "static",
                  constraint: constraintData.constraint,
                  options: constraintData.options,
                });
              }
            });
          } else if (typeof obj === "object") {
            Object.keys(obj).forEach((key) => {
              const path = prefix ? `${prefix}.${key}` : key;
              const val = obj[key];
              if (typeof val === "object" && val !== null) {
                extractFields(val, path);
              } else {
                const constraintData = getConstraintForPath(path);
                fields.push({
                  id: Math.random().toString(),
                  key: path,
                  value: String(val),
                  dataType: typeof val,
                  enabled: true,
                  mode: "static",
                  constraint: constraintData.constraint,
                  options: constraintData.options,
                });
              }
            });
          }
        };
        extractFields(parsed);
        setJsonFields(fields);
      } catch (e) {
        // Not valid JSON
      }
    } else if (format === "xml") {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "application/xml");
        const extractXmlFields = (node: Node, prefix = "") => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const path = prefix
              ? `${prefix}.${element.tagName}`
              : element.tagName;

            // Attributes
            if (element.attributes) {
              for (let i = 0; i < element.attributes.length; i++) {
                const attr = element.attributes[i];
                fields.push({
                  id: Math.random().toString(),
                  key: `${path}[@${attr.name}]`,
                  value: attr.value,
                  dataType: "attribute",
                  enabled: true,
                  mode: "static",
                });
              }
            }

            // Children
            if (
              element.childNodes.length === 1 &&
              element.childNodes[0].nodeType === Node.TEXT_NODE
            ) {
              fields.push({
                id: Math.random().toString(),
                key: path,
                value: element.textContent || "",
                dataType: "element",
                enabled: true,
                mode: "static",
              });
            } else {
              for (let i = 0; i < element.childNodes.length; i++) {
                extractXmlFields(element.childNodes[i], path);
              }
            }
          }
        };
        if (xmlDoc.documentElement) {
          extractXmlFields(xmlDoc.documentElement);
        }
        setJsonFields(fields);
      } catch (e) {
        // Not valid XML
      }
    }
  }, [content, format, endpoint]);

  const handleApply = () => {
    if (format === "json" && jsonFields.length > 0) {
      try {
        const parsed = JSON.parse(localContent);
        const updateObj = (obj: any, path: string, val: any) => {
          // Handle array paths like [0] or items[0]
          const parts = path.split(/\.|(?=\[)/);
          let current = obj;

          for (let i = 0; i < parts.length - 1; i++) {
            let part = parts[i];
            let isArray = false;
            let arrayIndex = -1;

            if (part.startsWith("[")) {
              isArray = true;
              arrayIndex = parseInt(part.substring(1, part.length - 1));
            }

            if (isArray) {
              if (!current[arrayIndex]) current[arrayIndex] = {};
              current = current[arrayIndex];
            } else {
              if (!current[part]) current[part] = {};
              current = current[part];
            }
          }

          const lastPart = parts[parts.length - 1];
          let finalVal = val;
          if (val === "true") finalVal = true;
          else if (val === "false") finalVal = false;
          else if (!isNaN(Number(val)) && val.trim() !== "")
            finalVal = Number(val);

          if (lastPart.startsWith("[")) {
            const idx = parseInt(lastPart.substring(1, lastPart.length - 1));
            current[idx] = finalVal;
          } else {
            current[lastPart] = finalVal;
          }
        };
        jsonFields.forEach((f) => {
          updateObj(parsed, f.key, f.value);
        });
        onUpdate(JSON.stringify(parsed, null, 2));
        if (onUpdateFields) onUpdateFields(jsonFields);
      } catch (e) {
        onUpdate(localContent);
        if (onUpdateFields) onUpdateFields(jsonFields);
      }
    } else if (format === "xml" && jsonFields.length > 0) {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(localContent, "application/xml");

        jsonFields.forEach((f) => {
          if (f.dataType === "attribute") {
            const lastDot = f.key.lastIndexOf(".");
            const bracketIdx = f.key.lastIndexOf("[@");
            const tagName =
              lastDot === -1
                ? f.key.substring(0, bracketIdx)
                : f.key.substring(lastDot + 1, bracketIdx);
            const attrName = f.key.substring(bracketIdx + 2, f.key.length - 1);
            const elements = xmlDoc.getElementsByTagName(tagName);
            if (elements.length > 0) {
              elements[0].setAttribute(attrName, f.value);
            }
          } else {
            const lastDot = f.key.lastIndexOf(".");
            const tagName =
              lastDot === -1 ? f.key : f.key.substring(lastDot + 1);
            const elements = xmlDoc.getElementsByTagName(tagName);
            if (elements.length > 0) {
              elements[0].textContent = f.value;
            }
          }
        });
        const serializer = new XMLSerializer();
        onUpdate(serializer.serializeToString(xmlDoc));
        if (onUpdateFields) onUpdateFields(jsonFields);
      } catch (e) {
        onUpdate(localContent);
        if (onUpdateFields) onUpdateFields(jsonFields);
      }
    } else {
      onUpdate(localContent);
      if (onUpdateFields) onUpdateFields(jsonFields);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="theme-bg-surface border theme-border rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b theme-border flex items-center justify-between theme-accent-bg/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg theme-accent-bg flex items-center justify-center text-white shadow-lg">
              <i className="fas fa-code"></i>
            </div>
            <div>
              <h3 className="text-sm font-black theme-text-primary uppercase tracking-widest">
                Configure {format.toUpperCase()} Body
              </h3>
              <p className="text-[10px] theme-text-secondary font-bold">
                Map fields to static or dynamic values
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-rose-500/10 text-rose-500 transition-all flex items-center justify-center"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Side: JSON/XML Viewer */}
          <div className="flex-1 border-r theme-border p-6 flex flex-col theme-bg-workbench/20">
            <h4 className="text-[10px] font-black theme-text-secondary uppercase mb-4 tracking-widest flex items-center gap-2">
              <i className="fas fa-file-alt"></i>
              {format.toUpperCase()} Data
            </h4>
            <VariableInput
              type="textarea"
              className="w-full theme-bg-main border theme-border rounded-xl p-4 font-mono text-xs leading-relaxed focus:ring-2 focus:outline-none focus:ring-theme-accent-text/50 resize-none theme-text-primary shadow-inner"
              value={localContent}
              variables={variables}
              onChange={setLocalContent}
              placeholder={`Enter ${format.toUpperCase()} here...`}
            />
          </div>

          {/* Right Side: Field Configuration */}
          <div className="w-[700px] p-6 overflow-y-auto theme-bg-workbench/40">
            <h4 className="text-[10px] font-black theme-text-secondary uppercase mb-4 tracking-widest flex items-center gap-2">
              <i className="fas fa-tasks"></i>
              Field Configuration
            </h4>
            {(format === "json" || format === "xml") &&
            jsonFields.length > 0 ? (
              <div className="border theme-border rounded-xl overflow-hidden theme-bg-workbench/20">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-left border-b theme-border theme-bg-workbench/30">
                      <th className="py-3 px-4 text-[9px] font-black theme-text-secondary uppercase tracking-widest">
                        Field (JSON PATH)
                      </th>
                      <th className="py-3 px-4 text-[9px] font-black theme-text-secondary uppercase tracking-widest">
                        Current Value
                      </th>
                      <th className="py-3 px-4 text-[9px] font-black theme-text-secondary uppercase tracking-widest">
                        Constraint
                      </th>
                      <th className="py-3 px-4 text-[9px] font-black theme-text-secondary uppercase tracking-widest text-center">
                        Mode
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y theme-border">
                    {jsonFields.map((field, idx) => (
                      <tr
                        key={field.id}
                        className="hover:theme-bg-surface transition-colors"
                      >
                        <td className="py-4 px-4 align-top min-w-[100px]">
                          <div
                            className="text-[11px] font-bold theme-text-primary font-mono break-all theme-bg-workbench/20 p-2 rounded border theme-border"
                            title={field.key}
                          >
                            {field.key}
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top min-w-[200px]">
                          {field.options && field.options.length > 0 ? (
                            <select
                              className="w-full theme-bg-main border theme-border rounded-lg px-3 py-2 text-xs font-mono theme-text-primary focus:ring-2 focus:ring-theme-accent-text/50 outline-none transition-all"
                              value={field.value}
                              onChange={(e) => {
                                const newFields = [...jsonFields];
                                newFields[idx].value = e.target.value;
                                setJsonFields(newFields);
                              }}
                            >
                              <option value="">-- Select --</option>
                              {field.options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <VariableInput
                              className="w-full theme-bg-main border theme-border rounded-lg px-3 py-2 text-xs font-mono theme-text-primary focus:ring-2 focus:ring-theme-accent-text/50 outline-none transition-all"
                              placeholder="Value"
                              value={field.value}
                              variables={variables}
                              onChange={(val) => {
                                const newFields = [...jsonFields];
                                newFields[idx].value = val;
                                setJsonFields(newFields);
                              }}
                            />
                          )}
                        </td>
                        <td className="py-4 px-4 align-top min-w-[100px]">
                          <input
                            className="w-full theme-bg-main border theme-border rounded-lg px-3 py-2 text-xs font-mono theme-text-primary focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all cursor-pointer"
                            placeholder="constraint"
                            value={field.constraint || ""}
                            readOnly
                            onClick={() => setEditingConstraintId(field.id)}
                          />
                        </td>
                        <td className="py-4 px-4 align-top text-center">
                          <div className="flex theme-bg-workbench/50 p-0.5 rounded-lg border theme-border w-fit mx-auto">
                            <button
                              onClick={() => {
                                const newFields = [...jsonFields];
                                newFields[idx].mode = "static";
                                setJsonFields(newFields);
                              }}
                              className={`px-2 py-0.5 text-[8px] font-black uppercase rounded transition-all ${!field.mode || field.mode === "static" ? "theme-accent-bg text-white shadow-lg" : "theme-text-secondary hover:theme-text-primary"}`}
                            >
                              Static
                            </button>
                            <button
                              onClick={() => {
                                const newFields = [...jsonFields];
                                newFields[idx].mode = "dynamic";
                                setJsonFields(newFields);
                              }}
                              className={`px-2 py-0.5 text-[8px] font-black uppercase rounded transition-all ${field.mode === "dynamic" ? "theme-accent-bg text-white shadow-lg" : "theme-text-secondary hover:theme-text-primary"}`}
                            >
                              Dynamic
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                <i className="fas fa-info-circle text-4xl theme-text-secondary"></i>
                <p className="text-xs theme-text-secondary font-medium px-10 leading-relaxed">
                  {format === "json" || format === "xml"
                    ? `Valid ${format.toUpperCase()} required to extract fields for configuration.`
                    : "Field configuration is currently optimized for JSON and XML formats."}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t theme-border flex items-center justify-end gap-3 theme-bg-workbench/50">
          <button
            onClick={onClose}
            className="px-6 py-2 text-xs font-black theme-text-secondary uppercase hover:theme-text-primary transition-colors tracking-widest"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-8 py-2 theme-accent-bg text-white rounded-lg text-xs font-black uppercase shadow-lg hover:scale-105 active:scale-95 transition-all tracking-widest"
          >
            Apply Changes
          </button>
        </div>
      </div>
      <ConstraintModal
        isOpen={!!editingConstraintId}
        initialValue={
          jsonFields.find((i) => i.id === editingConstraintId)?.constraint || ""
        }
        onClose={() => setEditingConstraintId(null)}
        onSave={(val) => {
          if (editingConstraintId) {
            const newFields = [...jsonFields];
            const idx = newFields.findIndex(
              (f) => f.id === editingConstraintId,
            );
            if (idx !== -1) {
              newFields[idx].constraint = val;
              const enumMatch = val.match(/(?:^|,\s*)enum:([^,]+)/);
              if (enumMatch) {
                newFields[idx].options = enumMatch[1].split("|");
              } else {
                newFields[idx].options = undefined;
              }
              setJsonFields(newFields);
            }
          }
        }}
      />
    </div>
  );
};

export default Workbench;
