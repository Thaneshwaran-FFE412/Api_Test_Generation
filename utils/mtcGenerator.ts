import { KVItem, SavedTestCase, ApiEndpoint } from "../types";

const parseConstraint = (constraintStr?: string) => {
  const c: any = { required: false, type: "string" };
  if (!constraintStr) return c;
  constraintStr.split(",").forEach((part) => {
    const [k, v] = part.split(":").map((s) => s.trim());
    if (k === "required") c.required = v === "true";
    if (k === "type") c.type = v;
    if (k === "minLen") c.minLen = parseInt(v);
    if (k === "maxLen") c.maxLen = parseInt(v);
    if (k === "min") c.min = parseInt(v);
    if (k === "max") c.max = parseInt(v);
    if (k === "pattern") c.pattern = v;
    if (k === "enum") c.enum = v.split("|");
  });
  return c;
};

const generateValidData = (
  constraint: any,
  originalValue: string,
  dataType?: string,
) => {
  if (constraint.enum && constraint.enum.length > 0) {
    return constraint.enum[Math.floor(Math.random() * constraint.enum.length)];
  }
  const type = constraint.type || dataType || "string";
  if (type === "number" || type === "integer") {
    let min = constraint.min !== undefined ? constraint.min : 1;
    let max = constraint.max !== undefined ? constraint.max : 1000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  if (type === "boolean") {
    return true;
  }
  // string
  let len = constraint.minLen !== undefined ? constraint.minLen : 5;
  if (constraint.maxLen !== undefined && len > constraint.maxLen)
    len = constraint.maxLen;
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let res = "";
  for (let i = 0; i < len; i++)
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  return res;
};

const generateInvalidData = (
  constraint: any,
  originalValue: string,
  dataType?: string,
) => {
  if (constraint.enum && constraint.enum.length > 0) {
    return "invalid_enum_value_" + Math.random().toString(36).substring(7);
  }
  const type = constraint.type || dataType || "string";
  if (type === "number" || type === "integer") {
    if (constraint.min !== undefined) return constraint.min - 1;
    if (constraint.max !== undefined) return constraint.max + 1;
    return "invalid_string_for_number";
  }
  if (type === "boolean") {
    return "not_a_boolean";
  }
  // string
  if (constraint.minLen !== undefined && constraint.minLen > 0) {
    return "a".repeat(constraint.minLen - 1);
  }
  if (constraint.maxLen !== undefined) {
    return "a".repeat(constraint.maxLen + 1);
  }
  return 999999; // wrong type
};

const getBaseParams = (params: KVItem[] | undefined) => {
  const base: Record<string, any> = {};
  if (!params) return base;
  params.forEach((p) => {
    if (!p.enabled) return;
    base[p.key] = p.value;
  });
  return base;
};

const getFreshParams = (
  params: KVItem[] | undefined,
  overrides: Record<string, any> = {},
) => {
  const result: Record<string, any> = {};
  if (!params) return result;
  params.forEach((p) => {
    if (!p.enabled) return;
    if (overrides.hasOwnProperty(p.key)) {
      result[p.key] = overrides[p.key];
    } else if (p.mode === "dynamic") {
      result[p.key] = generateValidData(
        parseConstraint(p.constraint),
        p.value,
        p.dataType,
      );
    } else {
      result[p.key] = p.value;
    }
  });
  return result;
};

const getFreshPayload = (
  tc: SavedTestCase,
  overrides: Record<string, any> = {},
  excludeKeys: string[] = [],
) => {
  if (tc.bodyType === "raw" && tc.rawFormat === "json" && tc.jsonFields) {
    const freshOverrides: Record<string, any> = { ...overrides };
    tc.jsonFields.forEach((f) => {
      if (
        f.enabled &&
        f.mode === "dynamic" &&
        !overrides.hasOwnProperty(f.key) &&
        !excludeKeys.includes(f.key)
      ) {
        freshOverrides[f.key] = generateValidData(
          parseConstraint(f.constraint),
          f.value,
          f.dataType,
        );
      }
    });
    return buildJsonPayload(
      tc.body,
      tc.jsonFields,
      freshOverrides,
      excludeKeys,
    );
  }
  return tc.bodyType === "raw" ? tc.body : "";
};

const getAuthString = (auth: any, isFresh: boolean) => {
  if (!auth || auth.type === "none") return "";

  if (auth.type === "bearer") {
    let token = auth.bearerToken || "";
    if (isFresh && auth.mode === "dynamic")
      token = generateValidData(
        { type: "string", minLen: 10, maxLen: 20 },
        token,
      );
    return token;
  }
  if (auth.type === "basic") {
    let user = auth.username || "";
    let pass = auth.password || "";
    if (isFresh && auth.mode === "dynamic") {
      user = generateValidData({ type: "string", minLen: 5, maxLen: 10 }, user);
      pass = generateValidData({ type: "string", minLen: 8, maxLen: 12 }, pass);
    }
    return `${user}:${pass}`;
  }
  if (auth.type === "apikey") {
    let key = auth.apiKey || "";
    let val = auth.apiKeyValue || "";
    if (isFresh && auth.mode === "dynamic") {
      val = generateValidData({ type: "string", minLen: 10, maxLen: 20 }, val);
    }
    return `${key}=${val}`;
  }
  return "";
};

const formatPathParams = (params: Record<string, any>) => {
  return Object.values(params).join("\n");
};

const formatParams = (params: Record<string, any>) => {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
};

const buildJsonPayload = (
  originalBody: string,
  fields: KVItem[],
  overrides: Record<string, any> = {},
  omitKeys: string[] = [],
) => {
  try {
    const parsed = JSON.parse(originalBody);
    const updateObj = (obj: any, path: string, val: any, omit: boolean) => {
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

      let lastPart = parts[parts.length - 1];
      let isArray = false;
      let arrayIndex = -1;
      if (lastPart.startsWith("[")) {
        isArray = true;
        arrayIndex = parseInt(lastPart.substring(1, lastPart.length - 1));
      }

      if (omit) {
        if (isArray) {
          current.splice(arrayIndex, 1);
        } else {
          delete current[lastPart];
        }
      } else {
        if (isArray) {
          current[arrayIndex] = val;
        } else {
          current[lastPart] = val;
        }
      }
    };

    fields.forEach((f) => {
      if (!f.enabled) {
        updateObj(parsed, f.key, null, true);
        return;
      }
      if (omitKeys.includes(f.key)) {
        updateObj(parsed, f.key, null, true);
        return;
      }
      let val: any =
        overrides[f.key] !== undefined ? overrides[f.key] : f.value;
      // Convert type if it's not an override (overrides are already typed)
      if (overrides[f.key] === undefined) {
        if (f.dataType === "number") val = Number(val);
        else if (f.dataType === "boolean") val = val === "true";
      }
      updateObj(parsed, f.key, val, false);
    });
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    return originalBody;
  }
};

export const generateMTCData = (
  tc: SavedTestCase,
  endpoint: ApiEndpoint,
  slNoStart: number,
) => {
  const allRows: any[] = [];
  let slNo = slNoStart;

  const reqName = tc.name;
  const endPoint = endpoint.path;
  const method = tc.method.toUpperCase();

  // Find expected success status code
  let expectedStatus = method === "POST" ? "201" : "200";

  // If user has defined a status code assertion, use that instead
  const statusCodeAssertion = tc.assertions?.find(
    (a) => a.type === "status_code",
  );
  if (statusCodeAssertion && statusCodeAssertion.expected) {
    expectedStatus = statusCodeAssertion.expected;
  }

  const basePath = getBaseParams(tc.pathParams);
  const baseQuery = getBaseParams(tc.queryParams);
  const baseHeader = getBaseParams(tc.headers);
  let basePayload = "";
  if (tc.bodyType === "raw" && tc.rawFormat === "json" && tc.jsonFields) {
    basePayload = buildJsonPayload(tc.body, tc.jsonFields, {});
  } else if (tc.bodyType === "raw") {
    basePayload = tc.body;
  }
  const baseAuth = getAuthString(tc.auth, false);

  let authTypeStr = "Authorization";
  if (tc.auth?.type && tc.auth.type !== "none") {
    authTypeStr = `Authorization (${tc.auth.type})`;
  }

  let payloadTypeStr = "Request Payload";
  if (tc.bodyType !== "none") {
    if (tc.bodyType === "raw") {
      payloadTypeStr = `Request Payload (${tc.rawFormat})`;
    } else {
      payloadTypeStr = `Request Payload (${tc.bodyType})`;
    }
  }

  const addRow = (
    set: string,
    summary: string,
    httpMethod: string,
    pathParams: Record<string, any>,
    queryParams: Record<string, any>,
    headerParams: Record<string, any>,
    auth: string,
    payload: string,
    expected: string,
  ) => {
    let resolvedEndPoint = endPoint;
    resolvedEndPoint = resolvedEndPoint.replace(/{([^}]+)}/g, (match, key) => {
      return pathParams[key] !== undefined ? String(pathParams[key]) : "";
    });

    allRows.push({
      "Sl No": slNo++,
      "End Point": resolvedEndPoint,
      Set: set,
      "Test Case Summary": summary,
      "Http Method": httpMethod,
      "Path Params": formatPathParams(pathParams),
      "Query Params": formatParams(queryParams),
      "Header Params": formatParams(headerParams),
      [authTypeStr]: auth,
      [payloadTypeStr]: payload,
      "Expected Result": expected,
      "Actual Result": "",
      Status: "",
      Comments: "",
    });
  };

  // 1. Happy Flow
  addRow(
    "Happy",
    "Happy Flow",
    method,
    basePath,
    baseQuery,
    baseHeader,
    baseAuth,
    basePayload,
    expectedStatus,
  );

  // 2. HTTP Method Test
  const allMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  allMethods.forEach((m) => {
    if (m !== method) {
      addRow(
        "HTTP Method Test",
        "Wrong HTTP Method",
        m,
        getFreshParams(tc.pathParams),
        getFreshParams(tc.queryParams),
        getFreshParams(tc.headers),
        getAuthString(tc.auth, true),
        getFreshPayload(tc),
        "405",
      );
    }
  });

  // 3. Path Params
  tc.pathParams?.forEach((p) => {
    if (!p.enabled) return;
    const set = `Path Param Test(${p.key})(${p.mode === "dynamic" ? "Dynamic" : "Static"})`;
    const c = parseConstraint(p.constraint);

    if (p.mode === "dynamic") {
      addRow(
        set,
        "Path Param Happy",
        method,
        getFreshParams(tc.pathParams, {
          [p.key]: generateValidData(c, p.value, p.dataType),
        }),
        getFreshParams(tc.queryParams),
        getFreshParams(tc.headers),
        getAuthString(tc.auth, true),
        getFreshPayload(tc),
        expectedStatus,
      );

      const emptyPath = getFreshParams(tc.pathParams);
      delete emptyPath[p.key];
      addRow(
        set,
        "Path Param Empty",
        method,
        emptyPath,
        getFreshParams(tc.queryParams),
        getFreshParams(tc.headers),
        getAuthString(tc.auth, true),
        getFreshPayload(tc),
        "400/404",
      );

      addRow(
        set,
        "Path Param Wrong",
        method,
        getFreshParams(tc.pathParams, {
          [p.key]: generateInvalidData(c, p.value, p.dataType),
        }),
        getFreshParams(tc.queryParams),
        getFreshParams(tc.headers),
        getAuthString(tc.auth, true),
        getFreshPayload(tc),
        "400",
      );
    } else {
      addRow(
        set,
        "Path Param Happy",
        method,
        getFreshParams(tc.pathParams),
        getFreshParams(tc.queryParams),
        getFreshParams(tc.headers),
        getAuthString(tc.auth, true),
        getFreshPayload(tc),
        expectedStatus,
      );

      const emptyPath = getFreshParams(tc.pathParams);
      delete emptyPath[p.key];
      addRow(
        set,
        "Path Param Empty",
        method,
        emptyPath,
        getFreshParams(tc.queryParams),
        getFreshParams(tc.headers),
        getAuthString(tc.auth, true),
        getFreshPayload(tc),
        "400/404",
      );
    }
  });

  // 4. Query Params
  tc.queryParams?.forEach((p) => {
    if (!p.enabled) return;
    const set = `Query Param Test(${p.key})(${p.mode === "dynamic" ? "Dynamic" : "Static"})`;
    const c = parseConstraint(p.constraint);

    if (p.mode === "dynamic") {
      addRow(
        set,
        "Query Param Happy",
        method,
        getFreshParams(tc.pathParams),
        getFreshParams(tc.queryParams, {
          [p.key]: generateValidData(c, p.value, p.dataType),
        }),
        getFreshParams(tc.headers),
        getAuthString(tc.auth, true),
        getFreshPayload(tc),
        expectedStatus,
      );

      const emptyQuery = getFreshParams(tc.queryParams);
      delete emptyQuery[p.key];
      addRow(
        set,
        "Query Param Empty",
        method,
        getFreshParams(tc.pathParams),
        emptyQuery,
        getFreshParams(tc.headers),
        getAuthString(tc.auth, true),
        getFreshPayload(tc),
        c.required ? "400" : expectedStatus,
      );

      addRow(
        set,
        "Query Param Wrong",
        method,
        getFreshParams(tc.pathParams),
        getFreshParams(tc.queryParams, {
          [p.key]: generateInvalidData(c, p.value, p.dataType),
        }),
        getFreshParams(tc.headers),
        getAuthString(tc.auth, true),
        getFreshPayload(tc),
        "400",
      );
    } else {
      addRow(
        set,
        "Query Param Happy",
        method,
        getFreshParams(tc.pathParams),
        getFreshParams(tc.queryParams),
        getFreshParams(tc.headers),
        getAuthString(tc.auth, true),
        getFreshPayload(tc),
        expectedStatus,
      );

      const emptyQuery = getFreshParams(tc.queryParams);
      delete emptyQuery[p.key];
      addRow(
        set,
        "Query Param Empty",
        method,
        getFreshParams(tc.pathParams),
        emptyQuery,
        getFreshParams(tc.headers),
        getAuthString(tc.auth, true),
        getFreshPayload(tc),
        c.required ? "400" : expectedStatus,
      );
    }
  });

  // 5. Header Params
  tc.headers?.forEach((p) => {
    if (!p.enabled) return;
    const set = `Header Param Test(${p.key})(${p.mode === "dynamic" ? "Dynamic" : "Static"})`;
    const c = parseConstraint(p.constraint);

    if (p.mode === "dynamic") {
      addRow(
        set,
        "Header Param Happy",
        method,
        getFreshParams(tc.pathParams),
        getFreshParams(tc.queryParams),
        getFreshParams(tc.headers, {
          [p.key]: generateValidData(c, p.value, p.dataType),
        }),
        getAuthString(tc.auth, true),
        getFreshPayload(tc),
        expectedStatus,
      );

      const emptyHeader = getFreshParams(tc.headers);
      delete emptyHeader[p.key];
      addRow(
        set,
        "Header Param Empty",
        method,
        getFreshParams(tc.pathParams),
        getFreshParams(tc.queryParams),
        emptyHeader,
        getAuthString(tc.auth, true),
        getFreshPayload(tc),
        c.required ? "400" : expectedStatus,
      );

      addRow(
        set,
        "Header Param Wrong",
        method,
        getFreshParams(tc.pathParams),
        getFreshParams(tc.queryParams),
        getFreshParams(tc.headers, {
          [p.key]: generateInvalidData(c, p.value, p.dataType),
        }),
        getAuthString(tc.auth, true),
        getFreshPayload(tc),
        "400",
      );
    } else {
      addRow(
        set,
        "Header Param Happy",
        method,
        getFreshParams(tc.pathParams),
        getFreshParams(tc.queryParams),
        getFreshParams(tc.headers),
        getAuthString(tc.auth, true),
        getFreshPayload(tc),
        expectedStatus,
      );

      const emptyHeader = getFreshParams(tc.headers);
      delete emptyHeader[p.key];
      addRow(
        set,
        "Header Param Empty",
        method,
        getFreshParams(tc.pathParams),
        getFreshParams(tc.queryParams),
        emptyHeader,
        getAuthString(tc.auth, true),
        getFreshPayload(tc),
        c.required ? "400" : expectedStatus,
      );
    }
  });

  // 6. JSON Body
  if (tc.bodyType === "raw" && tc.rawFormat === "json" && tc.jsonFields) {
    tc.jsonFields.forEach((p) => {
      if (!p.enabled) return;
      const set = `Body Param Test(${p.key})(${p.mode === "dynamic" ? "Dynamic" : "Static"})`;
      const c = parseConstraint(p.constraint);

      if (p.mode === "dynamic") {
        const happyPayload = getFreshPayload(tc, {
          [p.key]: generateValidData(c, p.value, p.dataType),
        });
        addRow(
          set,
          "Body Param Happy",
          method,
          getFreshParams(tc.pathParams),
          getFreshParams(tc.queryParams),
          getFreshParams(tc.headers),
          getAuthString(tc.auth, true),
          happyPayload,
          expectedStatus,
        );

        const emptyPayload = getFreshPayload(tc, {}, [p.key]);
        addRow(
          set,
          "Body Param Empty",
          method,
          getFreshParams(tc.pathParams),
          getFreshParams(tc.queryParams),
          getFreshParams(tc.headers),
          getAuthString(tc.auth, true),
          emptyPayload,
          c.required ? "400" : expectedStatus,
        );

        const wrongPayload = getFreshPayload(tc, {
          [p.key]: generateInvalidData(c, p.value, p.dataType),
        });
        addRow(
          set,
          "Body Param Wrong",
          method,
          getFreshParams(tc.pathParams),
          getFreshParams(tc.queryParams),
          getFreshParams(tc.headers),
          getAuthString(tc.auth, true),
          wrongPayload,
          "400",
        );
      } else {
        addRow(
          set,
          "Body Param Happy",
          method,
          getFreshParams(tc.pathParams),
          getFreshParams(tc.queryParams),
          getFreshParams(tc.headers),
          getAuthString(tc.auth, true),
          getFreshPayload(tc),
          expectedStatus,
        );

        const emptyPayload = getFreshPayload(tc, {}, [p.key]);
        addRow(
          set,
          "Body Param Empty",
          method,
          getFreshParams(tc.pathParams),
          getFreshParams(tc.queryParams),
          getFreshParams(tc.headers),
          getAuthString(tc.auth, true),
          emptyPayload,
          c.required ? "400" : expectedStatus,
        );
      }
    });
  }

  return { rows: allRows, nextSlNo: slNo };
};
