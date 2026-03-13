export interface User {
  username: string;
  email: string;
}

export type BodyType =
  | "none"
  | "raw"
  | "form-data"
  | "x-www-form-urlencoded"
  | "binary";
export type RawFormat = "json" | "xml" | "text" | "javascript" | "html";

export interface KVItem {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  type?: "text" | "file";
  description?: string; // Added for field info
  options?: string[]; // Added for enum values
  constraint?: string; // Added for field constraints
  mode?: "static" | "dynamic";
  dataType?: string; // Added for JSON/XML data type
}

export type AssertionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "exists";

export type AssertionSource =
  | "status_code"
  | "status_message"
  | "response_time"
  | "json_path"
  | "body"
  | "content_type"
  | "header_key"
  | "header_value";

export interface Assertion {
  id: string;
  type: AssertionSource;
  operator: AssertionOperator;
  expected: string;
  property?: string; // Used for JSON Path or Header Key
}

export interface AuthType {
  id: string;
  type: AssertionSource;
  operator: AssertionOperator;
  expected: string;
  property?: string; // Used for JSON Path or Header Key
}

export interface Capture {
  id: string;
  type: AssertionSource;
  property?: string; // Used for JSON Path or Header Key
  variableName: string;
}

export interface ApiEndpoint {
  id: string;
  method: string;
  path: string;
  summary: string;
  tags?: string[];
  parameters?: any[];
  requestBody?: any;
  responses?: any;
  name?: string;
  security?: any[];
}

export interface AppSettings {
  tlsVerification: boolean;
  requestTimeout: number;
  expectedStatusCode?: string;
  maxRedirects: number;
  autoRedirectDefault: boolean;
  redirectOriginalMethod: boolean;
  retainAuthOnRedirect: boolean;
  tlsProtocols: {
    tls10: boolean;
    tls11: boolean;
    tls12: boolean;
    tls13: boolean;
  };
}

export interface SavedTestCase {
  id: string;
  name: string;
  endpointId: string;
  method: string;
  url: string;
  queryParams: KVItem[];
  pathParams?: KVItem[];
  headers: KVItem[];
  bodyType: BodyType;
  rawFormat: RawFormat;
  body: string;
  jsonFields?: KVItem[];
  formData: KVItem[];
  urlEncoded: KVItem[];
  assertions: Assertion[];
  captures: Capture[];
  preRequestScript?: string;
  postResponseScript?: string;
  auth: GlobalAuth;
  setting: AppSettings;
  dependentOn?: string;
  createdAt: number;
}

export interface ExecutionResult {
  id: string;
  testCaseId: string;
  testCaseName: string;
  status: "pass" | "fail" | "error";
  statusCode: number;
  statusText: string;
  responseTime: number;
  request: {
    method: string;
    url: string;
    headers: any;
    body: any;
  };
  response: {
    headers: any;
    body: any;
  };
  assertionResults: {
    assertion: Assertion;
    passed: boolean;
    actual?: string;
  }[];
  capturedData: {
    variableName: string;
    value: any;
    source: string;
  }[];
  timestamp: number;
}

export interface GlobalAuth {
  type: "none" | "bearer" | "oauth_1.0" | "oauth_2.0" | "basic" | "apikey";
  bearerToken?: string;
  apiKey?: string;
  apiKeyValue?: string;
  username?: string;
  password?: string;
  isLocked?: boolean;
  mode?: "static" | "dynamic";
}

export interface AppSettings {
  tlsVerification: boolean;
  requestTimeout: number;
  maxRedirects: number;
  autoRedirectDefault: boolean;
  redirectOriginalMethod: boolean;
  retainAuthOnRedirect: boolean;
  tlsProtocols: {
    tls10: boolean;
    tls11: boolean;
    tls12: boolean;
    tls13: boolean;
  };
}

export interface SwaggerProject {
  id: string;
  name: string;
  description?: string;
  baseUrl: string; // Added to store the base URL from the spec
  spec: any;
  endpoints: ApiEndpoint[];
  savedTestCases: SavedTestCase[];
  createdAt: number;
}

export interface ManualTestCase {
  id: string;
  description: string;
  inputData: any;
  expectedResult: string;
  type: string;
}
