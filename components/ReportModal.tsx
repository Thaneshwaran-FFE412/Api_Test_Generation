import React, { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as ReTooltip,
} from "recharts";

// ✅ New Correct Type
interface NormalizedResult {
  id: number;
  testCaseName: string;
  status: string;
  request: {
    method: string;
    headers: string;
    body: string;
  };
  response: {
    body: string;
  };
  statusCode: string;
}

interface ReportModalProps {
  reportData: {
    updatedRow: any[];
    reportName: any[];
  };
  onClose: () => void;
}

const ReportModal: React.FC<ReportModalProps> = ({ reportData, onClose }) => {
  console.log("reportData", reportData);

  // ✅ Normalize data
  const results: NormalizedResult[] = reportData.updatedRow.map((r: any) => ({
    id: r["Sl No"],
    testCaseName: r["Test Case Summary"],
    status: r["Status"]?.toLowerCase(),
    request: {
      method: r["Http Method"],
      headers: r["Header Params"],
      body: r["Request Payload (json)"],
    },
    response: {
      body: r["Actual Result"],
    },
    statusCode: r["Expected Result"],
  }));

  const [selectedResult, setSelectedResult] = useState<NormalizedResult | null>(
    results[0] || null,
  );

  useEffect(() => {
    console.log("selectedResult", selectedResult);
  }, [selectedResult]);

  // ✅ Stats (removed responseTime)
  const stats = {
    total: results.length,
    passed: results.filter((r) => r.status === "pass").length,
    failed: results.filter((r) => r.status !== "pass").length,
  };

  const chartData = [
    { name: "Passed", value: stats.passed, color: "#10b981" },
    { name: "Failed", value: stats.failed, color: "#f43f5e" },
  ];

  // ✅ Helpers
  const getExpected = (r: NormalizedResult) => r.statusCode || "-";

  const getActual = (r: NormalizedResult) =>
    `Status: ${r.statusCode}\n${r.response.body}`;

  const getHeaders = (r: NormalizedResult) => r.request.headers || "-";

  const getComments = (r: NormalizedResult) =>
    r.status === "pass"
      ? "Test case passed successfully."
      : `Expected: ${r.statusCode}, Actual: ${r.response.body}`;

  const Card = ({ title, children }: any) => (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-xs text-gray-500 mb-1">{title}</p>
      <p className="text-sm break-words">{children || "-"}</p>
    </div>
  );

  const Section = ({ title, children }: any) => (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );

  const CodeBlock = ({ content }: any) => (
    <pre className="text-xs bg-gray-100 border p-3 rounded-xl overflow-auto max-h-64">
      {content || "-"}
    </pre>
  );

  const DiffView = ({ expected, actual }: any) => {
    const isMatch = expected == actual;

    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-green-300 bg-green-50 p-3 rounded-xl">
          <p className="text-xs text-gray-500 mb-1">Expected</p>
          <p className="font-semibold text-green-700">{expected}</p>
        </div>

        <div
          className={`p-3 rounded-xl border ${
            isMatch
              ? "border-green-300 bg-green-50"
              : "border-red-300 bg-red-50"
          }`}
        >
          <p className="text-xs text-gray-500 mb-1">Actual</p>
          <p
            className={`font-semibold ${
              isMatch ? "text-green-700" : "text-red-700"
            }`}
          >
            {actual}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-7xl h-[92vh] bg-white text-gray-800 rounded-2xl flex flex-col shadow-xl overflow-hidden">
        {/* HEADER */}
        <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50">
          <div>
            <h2 className="text-2xl font-semibold">API Test Report</h2>
            <p className="text-xs text-gray-500 mt-1">
              {results.length} test cases • {new Date().toLocaleString()}
            </p>
          </div>

          <button
            onClick={onClose}
            className="hover:bg-gray-200 p-2 rounded-lg"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* LEFT PANEL */}
          <div className="w-80 border-r flex flex-col bg-gray-50 overflow-y-auto">
            {" "}
            {/* SUMMARY + PIE */}
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-100 border border-green-300 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-600">Passed</p>
                  <p className="text-xl font-bold text-green-600">
                    {stats.passed}
                  </p>
                </div>

                <div className="bg-red-100 border border-red-300 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-600">Failed</p>
                  <p className="text-xl font-bold text-red-600">
                    {stats.failed}
                  </p>
                </div>
              </div>

              {/* PIE CHART */}
              <div className="h-40">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      innerRadius={40}
                      outerRadius={60}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <ReTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* TEST CASE LIST */}
            <div className="flex-1 px-3 pb-3">
              {" "}
              <h3 className="text-xs uppercase text-gray-500 mb-2 px-1">
                Test Cases
              </h3>
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedResult(r)}
                  className={`w-full text-left p-3 mb-2 rounded-xl border transition ${
                    selectedResult?.id === r.id
                      ? "bg-blue-100 border-blue-400"
                      : "border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  <div className="text-xs font-semibold truncate">
                    {r.testCaseName}
                  </div>

                  <div
                    className={`text-[11px] mt-1 font-medium ${
                      r.status === "pass" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {r.status.toUpperCase()}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="flex-1 p-6 overflow-y-auto">
            {selectedResult && (
              <div className="space-y-6">
                {/* TITLE */}
                <div>
                  <h2 className="text-xl font-semibold">
                    {selectedResult.testCaseName}
                  </h2>

                  <span
                    className={`inline-block mt-2 px-3 py-1 text-xs rounded-full ${
                      selectedResult.status === "pass"
                        ? "bg-green-100 text-green-600"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {selectedResult.status.toUpperCase()}
                  </span>
                </div>

                {/* INFO GRID */}
                <div className="grid grid-cols-2 gap-4">
                  <Card title="HTTP Method">
                    {selectedResult.request.method}
                  </Card>

                  <Card title="Expected Status">
                    {getExpected(selectedResult)}
                  </Card>

                  <Card title="Headers">{getHeaders(selectedResult)}</Card>

                  <Card title="Comments">{getComments(selectedResult)}</Card>
                </div>

                {/* DIFF VIEW */}
                <Section title="Expected vs Actual">
                  <DiffView
                    expected={getExpected(selectedResult)}
                    actual={selectedResult.statusCode}
                  />
                </Section>

                {/* REQUEST */}
                <Section title="Request Payload">
                  <CodeBlock content={selectedResult.request.body} />
                </Section>

                {/* RESPONSE */}
                <Section title="Response Body">
                  <CodeBlock content={selectedResult.response.body} />
                </Section>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
