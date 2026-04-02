import { KVItem, SavedTestCase, ApiEndpoint } from "../types";

export const substituteVariables = (
  str: string,
  vars: Record<string, string>,
): string => {
  if (typeof str !== "string") return str;
  let result = str;

  // Faker variables
  // Number: "{{$randomNumber_min_max}}"
  result = result.replace(
    /"\{\{\$randomNumber_(\d+)_(\d+)\}\}"/g,
    (_, min, max) => {
      return String(
        Math.floor(Math.random() * (parseInt(max) - parseInt(min) + 1)) +
          parseInt(min),
      );
    },
  );
  result = result.replace(
    /\{\{\$randomNumber_(\d+)_(\d+)\}\}/g,
    (_, min, max) => {
      return String(
        Math.floor(Math.random() * (parseInt(max) - parseInt(min) + 1)) +
          parseInt(min),
      );
    },
  );

  // Boolean: "{{$randomBoolean}}"
  result = result.replace(/"\{\{\$randomBoolean\}\}"/g, () => {
    return Math.random() > 0.5 ? "true" : "false";
  });
  result = result.replace(/\{\{\$randomBoolean\}\}/g, () => {
    return Math.random() > 0.5 ? "true" : "false";
  });

  // String: "{{$randomString_len}}"
  result = result.replace(/\{\{\$randomString_(\d+)\}\}/g, (_, len) => {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let res = "";
    for (let i = 0; i < parseInt(len); i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  });

  // Option: "{{$randomOption_a|b|c}}"
  result = result.replace(/\{\{\$randomOption_(.+?)\}\}/g, (_, optionsStr) => {
    const options = optionsStr.split("|");
    return options[Math.floor(Math.random() * options.length)];
  });

  // Normal variables
  result = result.replace(/\{\{(.+?)\}\}/g, (match, key) => {
    // Don't replace faker variables again if they didn't match above
    if (key.startsWith("$random")) return match;
    if (vars[key] !== undefined) return vars[key];
    if (vars["$" + key] !== undefined) return vars["$" + key];
    return match;
  });
  result = result.replace(/\$([a-zA-Z0-9_]+)/g, (match, key) => {
    if (vars[key] !== undefined) return vars[key];
    if (vars["$" + key] !== undefined) return vars["$" + key];
    return match;
  });
  result = result.replace(/\$\{([^}]+)\}/g, (match, key) => {
    if (vars[key] !== undefined) return vars[key];
    if (vars["$" + key] !== undefined) return vars["$" + key];
    return match;
  });
  return result;
};

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
  options?: string[],
) => {
  if (options && options.length > 0) {
    return `{{$randomOption_${options.join("|")}}}`;
  }
  if (constraint.enum && constraint.enum.length > 0) {
    return `{{$randomOption_${constraint.enum.join("|")}}}`;
  }
  const type = constraint.type || dataType || "string";
  if (type === "number" || type === "integer") {
    let min = constraint.min !== undefined ? constraint.min : 1;
    let max = constraint.max !== undefined ? constraint.max : 1000;
    return `{{$randomNumber_${min}_${max}}}`;
  }
  if (type === "boolean") {
    return `{{$randomBoolean}}`;
  }
  // string
  let len = constraint.minLen !== undefined ? constraint.minLen : 5;
  if (constraint.maxLen !== undefined && len > constraint.maxLen)
    len = constraint.maxLen;
  return `{{$randomString_${len}}}`;
};

const generateInvalidData = (
  constraint: any,
  originalValue: string,
  dataType?: string,
  options?: string[],
) => {
  if (
    (options && options.length > 0) ||
    (constraint.enum && constraint.enum.length > 0)
  ) {
    return "invalid_enum_value_{{$randomString_5}}";
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
        p.options,
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
): string | Record<string, any> => {
  if (
    tc.testCaseData.bodyType === "raw" &&
    tc.testCaseData.rawFormat === "json" &&
    tc.testCaseData.jsonFields
  ) {
    const freshOverrides: Record<string, any> = { ...overrides };
    tc.testCaseData.jsonFields.forEach((f) => {
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
          f.options,
        );
      }
    });
    return buildJsonPayload(
      tc.testCaseData.body,
      tc.testCaseData.jsonFields,
      freshOverrides,
      excludeKeys,
    );
  }

  if (tc.testCaseData.bodyType === "form-data" && tc.testCaseData.formData) {
    const result: Record<string, any> = {};
    tc.testCaseData.formData.forEach((f) => {
      if (f.enabled && !excludeKeys.includes(f.key)) {
        if (overrides.hasOwnProperty(f.key)) {
          result[f.key] = overrides[f.key];
        } else if (f.mode === "dynamic") {
          result[f.key] = generateValidData(
            parseConstraint(f.constraint),
            f.value,
            f.dataType,
            f.options,
          );
        } else {
          result[f.key] = f.value;
        }
      }
    });
    return result; // Getting Type Issue
  }

  if (
    tc.testCaseData.bodyType === "x-www-form-urlencoded" &&
    tc.testCaseData.urlEncoded
  ) {
    const result: Record<string, any> = {};
    tc.testCaseData.urlEncoded.forEach((f) => {
      if (f.enabled && !excludeKeys.includes(f.key)) {
        if (overrides.hasOwnProperty(f.key)) {
          result[f.key] = overrides[f.key];
        } else if (f.mode === "dynamic") {
          result[f.key] = generateValidData(
            parseConstraint(f.constraint),
            f.value,
            f.dataType,
            f.options,
          );
        } else {
          result[f.key] = f.value;
        }
      }
    });
    return result; // Getting Type Issue
  }

  return tc.testCaseData.bodyType === "raw" ? tc.testCaseData.body : "";
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

export const formatPathParams = (params: Record<string, any>) => {
  return Object.values(params).join("\n");
};

export const formatParams = (params: Record<string, any>) => {
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
        const isTemplateVar =
          typeof val === "string" && (val.includes("{{") || val.includes("$"));
        if (!isTemplateVar) {
          if (f.dataType === "number") val = Number(val);
          else if (f.dataType === "boolean") val = val === "true";
        }
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
  variables: Record<string, string> = {},
) => {
  const allRows: any[] = [];
  const rawRows: any[] = [];
  let slNo = slNoStart;

  const reqName = tc.endpointName;
  const endPoint = endpoint.path;
  const method = tc.testCaseData.method.toUpperCase();

  // Find expected success status code
  let expectedStatus = method === "POST" ? "201" : "200";

  // If user has defined a status code assertion, use that instead
  const statusCodeAssertion = tc.testCaseData.assertions?.find(
    (a) => a.type === "status_code",
  );
  if (statusCodeAssertion && statusCodeAssertion.expected) {
    expectedStatus = statusCodeAssertion.expected;
  }

  const basePath = getFreshParams(tc.testCaseData.pathParams);
  const baseQuery = getFreshParams(tc.testCaseData.queryParams);
  const baseHeader = getFreshParams(tc.testCaseData.headers);
  const basePayload = getFreshPayload(tc);
  const baseAuth = getAuthString(tc.testCaseData.auth, true);

  let authTypeStr = "Authorization";
  if (tc.testCaseData.auth?.type && tc.testCaseData.auth.type !== "none") {
    authTypeStr = `Authorization (${tc.testCaseData.auth.type})`;
  }

  let payloadTypeStr = "Request Payload";
  if (tc.testCaseData.bodyType !== "none") {
    if (tc.testCaseData.bodyType === "raw") {
      payloadTypeStr = `Request Payload (${tc.testCaseData.rawFormat})`;
    } else {
      payloadTypeStr = `Request Payload (${tc.testCaseData.bodyType})`;
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
    payload: string | Record<string, any>,
    expected: string,
  ) => {
    let resolvedEndPoint = endPoint;
    resolvedEndPoint = resolvedEndPoint.replace(
      /\$\{([^}]+)\}/g,
      (match, key) => {
        return pathParams[key] !== undefined ? String(pathParams[key]) : "";
      },
    );
    resolvedEndPoint = resolvedEndPoint.replace(/{([^}]+)}/g, (match, key) => {
      return pathParams[key] !== undefined ? String(pathParams[key]) : "";
    });

    const subParams = (params: Record<string, any>) => {
      const res: Record<string, any> = {};
      for (const k in params) {
        res[k] = params[k];
      }
      return res;
    };

    const subPathParams = subParams(pathParams);
    const subQueryParams = subParams(queryParams);
    const subHeaderParams = subParams(headerParams);
    const subAuth = auth;
    const subPayload = payload;

    allRows.push({
      "Sl No": slNo++,
      "End Point": resolvedEndPoint,
      Set: set,
      "Test Case Summary": summary,
      "Http Method": httpMethod,
      "Path Params": formatPathParams(subPathParams),
      "Query Params": formatParams(subQueryParams),
      "Header Params": formatParams(subHeaderParams),
      [authTypeStr]: subAuth,
      [payloadTypeStr]:
        typeof subPayload === "object" ? formatParams(subPayload) : subPayload,
      "Expected Result": expected,
      "Actual Result": "",
      Status: "",
      Comments: "",
    });

    rawRows.push({
      slNo: slNo - 1,
      endPoint: endPoint,
      set,
      summary,
      httpMethod,
      pathParams: subPathParams,
      queryParams: subQueryParams,
      headerParams: subHeaderParams,
      auth: subAuth,
      payload: subPayload,
      expected,
      postResponseScript: tc.testCaseData.postResponseScript,
      postResponse: tc.testCaseData.captures,
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
  let methodsToTest: string[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  // if (method === "GET") {
  //   methodsToTest = ["POST", "PUT","PATCH"];
  // } else if (method === "POST" || method === "PUT") {
  //   methodsToTest = ["GET", "DELETE"];
  // } else {
  //   methodsToTest = ["GET", "DELETE"];
  // }

  methodsToTest.forEach((m) => {
    if (m !== method) {
      addRow(
        "HTTP Method Test",
        "Wrong HTTP Method",
        m,
        getFreshParams(tc.testCaseData.pathParams),
        getFreshParams(tc.testCaseData.queryParams),
        getFreshParams(tc.testCaseData.headers),
        getAuthString(tc.testCaseData.auth, true),
        getFreshPayload(tc),
        "405",
      );
    }
  });

  // 3. Path Params
  tc.testCaseData.pathParams?.forEach((p) => {
    if (!p.enabled) return;
    const set = `Path Param Test(${p.key})(${p.mode === "dynamic" ? "Dynamic" : "Static"})`;
    const c = parseConstraint(p.constraint);

    if (p.mode === "dynamic") {
      addRow(
        set,
        "Path Param Happy",
        method,
        getFreshParams(tc.testCaseData.pathParams, {
          [p.key]: generateValidData(c, p.value, p.dataType, p.options),
        }),
        getFreshParams(tc.testCaseData.queryParams),
        getFreshParams(tc.testCaseData.headers),
        getAuthString(tc.testCaseData.auth, true),
        getFreshPayload(tc),
        expectedStatus,
      );

      const emptyPath = getFreshParams(tc.testCaseData.pathParams);
      delete emptyPath[p.key];
      addRow(
        set,
        "Path Param Empty",
        method,
        emptyPath,
        getFreshParams(tc.testCaseData.queryParams),
        getFreshParams(tc.testCaseData.headers),
        getAuthString(tc.testCaseData.auth, true),
        getFreshPayload(tc),
        "400/404",
      );

      addRow(
        set,
        "Path Param Wrong",
        method,
        getFreshParams(tc.testCaseData.pathParams, {
          [p.key]: generateInvalidData(c, p.value, p.dataType, p.options),
        }),
        getFreshParams(tc.testCaseData.queryParams),
        getFreshParams(tc.testCaseData.headers),
        getAuthString(tc.testCaseData.auth, true),
        getFreshPayload(tc),
        "400",
      );
    } else {
      addRow(
        set,
        "Path Param Happy",
        method,
        getFreshParams(tc.testCaseData.pathParams),
        getFreshParams(tc.testCaseData.queryParams),
        getFreshParams(tc.testCaseData.headers),
        getAuthString(tc.testCaseData.auth, true),
        getFreshPayload(tc),
        expectedStatus,
      );

      const emptyPath = getFreshParams(tc.testCaseData.pathParams);
      delete emptyPath[p.key];
      addRow(
        set,
        "Path Param Empty",
        method,
        emptyPath,
        getFreshParams(tc.testCaseData.queryParams),
        getFreshParams(tc.testCaseData.headers),
        getAuthString(tc.testCaseData.auth, true),
        getFreshPayload(tc),
        "400/404",
      );
    }
  });

  // 4. Query Params
  tc.testCaseData.queryParams?.forEach((p) => {
    if (!p.enabled) return;
    const set = `Query Param Test(${p.key})(${p.mode === "dynamic" ? "Dynamic" : "Static"})`;
    const c = parseConstraint(p.constraint);

    if (p.mode === "dynamic") {
      addRow(
        set,
        "Query Param Happy",
        method,
        getFreshParams(tc.testCaseData.pathParams),
        getFreshParams(tc.testCaseData.queryParams, {
          [p.key]: generateValidData(c, p.value, p.dataType, p.options),
        }),
        getFreshParams(tc.testCaseData.headers),
        getAuthString(tc.testCaseData.auth, true),
        getFreshPayload(tc),
        expectedStatus,
      );

      const emptyQuery = getFreshParams(tc.testCaseData.queryParams);
      delete emptyQuery[p.key];
      addRow(
        set,
        "Query Param Empty",
        method,
        getFreshParams(tc.testCaseData.pathParams),
        emptyQuery,
        getFreshParams(tc.testCaseData.headers),
        getAuthString(tc.testCaseData.auth, true),
        getFreshPayload(tc),
        c.required ? "400" : expectedStatus,
      );

      addRow(
        set,
        "Query Param Wrong",
        method,
        getFreshParams(tc.testCaseData.pathParams),
        getFreshParams(tc.testCaseData.queryParams, {
          [p.key]: generateInvalidData(c, p.value, p.dataType, p.options),
        }),
        getFreshParams(tc.testCaseData.headers),
        getAuthString(tc.testCaseData.auth, true),
        getFreshPayload(tc),
        "400",
      );
    } else {
      addRow(
        set,
        "Query Param Happy",
        method,
        getFreshParams(tc.testCaseData.pathParams),
        getFreshParams(tc.testCaseData.queryParams),
        getFreshParams(tc.testCaseData.headers),
        getAuthString(tc.testCaseData.auth, true),
        getFreshPayload(tc),
        expectedStatus,
      );

      const emptyQuery = getFreshParams(tc.testCaseData.queryParams);
      delete emptyQuery[p.key];
      addRow(
        set,
        "Query Param Empty",
        method,
        getFreshParams(tc.testCaseData.pathParams),
        emptyQuery,
        getFreshParams(tc.testCaseData.headers),
        getAuthString(tc.testCaseData.auth, true),
        getFreshPayload(tc),
        c.required ? "400" : expectedStatus,
      );
    }
  });

  // 5. Header Params
  tc.testCaseData.headers?.forEach((p) => {
    if (!p.enabled) return;
    const set = `Header Param Test(${p.key})(${p.mode === "dynamic" ? "Dynamic" : "Static"})`;
    const c = parseConstraint(p.constraint);

    if (p.mode === "dynamic") {
      addRow(
        set,
        "Header Param Happy",
        method,
        getFreshParams(tc.testCaseData.pathParams),
        getFreshParams(tc.testCaseData.queryParams),
        getFreshParams(tc.testCaseData.headers, {
          [p.key]: generateValidData(c, p.value, p.dataType, p.options),
        }),
        getAuthString(tc.testCaseData.auth, true),
        getFreshPayload(tc),
        expectedStatus,
      );

      const emptyHeader = getFreshParams(tc.testCaseData.headers);
      delete emptyHeader[p.key];
      addRow(
        set,
        "Header Param Empty",
        method,
        getFreshParams(tc.testCaseData.pathParams),
        getFreshParams(tc.testCaseData.queryParams),
        emptyHeader,
        getAuthString(tc.testCaseData.auth, true),
        getFreshPayload(tc),
        c.required ? "400" : expectedStatus,
      );

      addRow(
        set,
        "Header Param Wrong",
        method,
        getFreshParams(tc.testCaseData.pathParams),
        getFreshParams(tc.testCaseData.queryParams),
        getFreshParams(tc.testCaseData.headers, {
          [p.key]: generateInvalidData(c, p.value, p.dataType, p.options),
        }),
        getAuthString(tc.testCaseData.auth, true),
        getFreshPayload(tc),
        "400",
      );
    } else {
      addRow(
        set,
        "Header Param Happy",
        method,
        getFreshParams(tc.testCaseData.pathParams),
        getFreshParams(tc.testCaseData.queryParams),
        getFreshParams(tc.testCaseData.headers),
        getAuthString(tc.testCaseData.auth, true),
        getFreshPayload(tc),
        expectedStatus,
      );

      const emptyHeader = getFreshParams(tc.testCaseData.headers);
      delete emptyHeader[p.key];
      addRow(
        set,
        "Header Param Empty",
        method,
        getFreshParams(tc.testCaseData.pathParams),
        getFreshParams(tc.testCaseData.queryParams),
        emptyHeader,
        getAuthString(tc.testCaseData.auth, true),
        getFreshPayload(tc),
        c.required ? "400" : expectedStatus,
      );
    }
  });

  // 6. JSON Body
  if (
    tc.testCaseData.bodyType === "raw" &&
    tc.testCaseData.rawFormat === "json" &&
    tc.testCaseData.jsonFields
  ) {
    tc.testCaseData.jsonFields.forEach((p) => {
      if (!p.enabled) return;
      const set = `Body Param Test(${p.key})(${p.mode === "dynamic" ? "Dynamic" : "Static"})`;
      const c = parseConstraint(p.constraint);

      if (p.mode === "dynamic") {
        const happyPayload = getFreshPayload(tc, {
          [p.key]: generateValidData(c, p.value, p.dataType, p.options),
        });
        addRow(
          set,
          "Body Param Happy",
          method,
          getFreshParams(tc.testCaseData.pathParams),
          getFreshParams(tc.testCaseData.queryParams),
          getFreshParams(tc.testCaseData.headers),
          getAuthString(tc.testCaseData.auth, true),
          happyPayload,
          expectedStatus,
        );

        const emptyPayload = getFreshPayload(tc, {}, [p.key]);
        addRow(
          set,
          "Body Param Empty",
          method,
          getFreshParams(tc.testCaseData.pathParams),
          getFreshParams(tc.testCaseData.queryParams),
          getFreshParams(tc.testCaseData.headers),
          getAuthString(tc.testCaseData.auth, true),
          emptyPayload,
          c.required ? "400" : expectedStatus,
        );

        const wrongPayload = getFreshPayload(tc, {
          [p.key]: generateInvalidData(c, p.value, p.dataType, p.options),
        });
        addRow(
          set,
          "Body Param Wrong",
          method,
          getFreshParams(tc.testCaseData.pathParams),
          getFreshParams(tc.testCaseData.queryParams),
          getFreshParams(tc.testCaseData.headers),
          getAuthString(tc.testCaseData.auth, true),
          wrongPayload,
          "400",
        );
      } else {
        addRow(
          set,
          "Body Param Happy",
          method,
          getFreshParams(tc.testCaseData.pathParams),
          getFreshParams(tc.testCaseData.queryParams),
          getFreshParams(tc.testCaseData.headers),
          getAuthString(tc.testCaseData.auth, true),
          getFreshPayload(tc),
          expectedStatus,
        );

        const emptyPayload = getFreshPayload(tc, {}, [p.key]);
        addRow(
          set,
          "Body Param Empty",
          method,
          getFreshParams(tc.testCaseData.pathParams),
          getFreshParams(tc.testCaseData.queryParams),
          getFreshParams(tc.testCaseData.headers),
          getAuthString(tc.testCaseData.auth, true),
          emptyPayload,
          c.required ? "400" : expectedStatus,
        );
      }
    });
  }
  
  return { rows: allRows, rawRows, nextSlNo: slNo };
};
