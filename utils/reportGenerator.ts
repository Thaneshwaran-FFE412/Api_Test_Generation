import * as XLSX from "xlsx-js-style";
import { ExecutionResult, SavedTestCase, ApiEndpoint } from "../types";

export const generateExcelReport = (
  project: any,
  ids: string[],
  savedTestCases: SavedTestCase[],
  endpoints: ApiEndpoint[],
  excelDataByTestCase: Record<string, any[]>,
) => {
  const workbook = XLSX.utils.book_new();
  let hasData = false;

  for (const id of ids) {
    const tc = savedTestCases.find((t) => t.id === id);
    if (!tc) continue;

    const endpoint = endpoints.find((e) => e.id === tc.id);
    if (!endpoint) continue;

    let sheetRows = excelDataByTestCase[id];
    if (sheetRows && sheetRows.length > 0) {
      hasData = true;
      const columnsToCheck = ["Path Params", "Query Params", "Header Params"];

      const authCol = Object.keys(sheetRows[0]).find((k) =>
        k.startsWith("Authorization"),
      );
      if (authCol) columnsToCheck.push(authCol);

      const payloadCol = Object.keys(sheetRows[0]).find((k) =>
        k.startsWith("Request Payload"),
      );
      if (payloadCol) columnsToCheck.push(payloadCol);

      columnsToCheck.forEach((col) => {
        const isEmpty = sheetRows.every(
          (row) => !row[col] || String(row[col]).trim() === "",
        );
        if (isEmpty) {
          sheetRows.forEach((row) => delete row[col]);
        }
      });

      const getDependencies = (
        testCase: SavedTestCase,
        visited = new Set<string>(),
      ): string[] => {
        if (visited.has(testCase.id)) return [];
        visited.add(testCase.id);

        if (testCase.dependentId) {
          const dep = savedTestCases.find((t) => t.id === testCase.dependentId[0]);
          if (dep) {
            return [...getDependencies(dep, visited), dep.endpointName];
          }
        }
        return [];
      };
      const deps = getDependencies(tc);
      const depsString = deps.length > 0 ? deps.join(", ") : "None";

      const worksheet = XLSX.utils.json_to_sheet(sheetRows, { origin: "A5" });

      const moduleName = endpoint.tags?.[0] || "Default Module";
      const requestName = tc.endpointName;

      XLSX.utils.sheet_add_aoa(
        worksheet,
        [
          ["Module Name", moduleName],
          ["Request Name", requestName],
          ["Dependent Scripts", depsString],
        ],
        { origin: "A1" },
      );

      const colWidths: Record<string, number> = {
        "Sl No": 5,
        "End Point": 25,
        Set: 35,
        "Test Case Summary": 25,
        "Http Method": 15,
        "Path Params": 20,
        "Query Params": 20,
        "Header Params": 20,
        Authorization: 15,
        "Request Payload (form data)": 20,
        "Expected Result": 15,
        "Actual Result": 30,
        Status: 10,
        Comments: 20,
      };

      const wscols = Object.keys(sheetRows[0]).map((key) => ({
        wch: colWidths[key] || 20,
      }));
      worksheet["!cols"] = wscols;

      // Apply Styling
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");

      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4F46E5" } }, // Indigo
        alignment: { vertical: "center", horizontal: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "D1D5DB" } },
          bottom: { style: "thin", color: { rgb: "D1D5DB" } },
          left: { style: "thin", color: { rgb: "D1D5DB" } },
          right: { style: "thin", color: { rgb: "D1D5DB" } },
        },
      };

      const dataStyle = {
        alignment: { vertical: "top", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "E5E7EB" } },
          bottom: { style: "thin", color: { rgb: "E5E7EB" } },
          left: { style: "thin", color: { rgb: "E5E7EB" } },
          right: { style: "thin", color: { rgb: "E5E7EB" } },
        },
      };

      const metaLabelStyle = {
        font: { bold: true, color: { rgb: "111827" } },
        fill: { fgColor: { rgb: "F3F4F6" } },
        alignment: { vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "D1D5DB" } },
          bottom: { style: "thin", color: { rgb: "D1D5DB" } },
          left: { style: "thin", color: { rgb: "D1D5DB" } },
          right: { style: "thin", color: { rgb: "D1D5DB" } },
        },
      };

      const metaValueStyle = {
        font: { bold: true, color: { rgb: "4F46E5" } },
        alignment: { vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "D1D5DB" } },
          bottom: { style: "thin", color: { rgb: "D1D5DB" } },
          left: { style: "thin", color: { rgb: "D1D5DB" } },
          right: { style: "thin", color: { rgb: "D1D5DB" } },
        },
      };

      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!worksheet[cellAddress]) continue;

          if (R === 0 || R === 1 || R === 2) {
            // Meta rows (Module Name, Request Name, Dependent Scripts)
            if (C === 0) {
              worksheet[cellAddress].s = metaLabelStyle;
            } else if (C === 1) {
              worksheet[cellAddress].s = metaValueStyle;
            }
          } else if (R === 4) {
            // Table Headers
            worksheet[cellAddress].s = headerStyle;
          } else if (R > 4) {
            // Data Rows
            worksheet[cellAddress].s = dataStyle;

            // Color code Status column
            if (R > 4) {
              const headerCell = XLSX.utils.encode_cell({ r: 4, c: C });
              if (
                worksheet[headerCell] &&
                worksheet[headerCell].v === "Status"
              ) {
                if (worksheet[cellAddress].v === "Pass") {
                  worksheet[cellAddress].s = {
                    ...dataStyle,
                    font: { color: { rgb: "10B981" }, bold: true },
                  };
                } else if (worksheet[cellAddress].v === "Fail") {
                  worksheet[cellAddress].s = {
                    ...dataStyle,
                    font: { color: { rgb: "EF4444" }, bold: true },
                  };
                }
              }
            }
          }
        }
      }

      let sheetName = requestName.replace(/[\\/?*[\]:]/g, "_").substring(0, 31);
      if (!sheetName) sheetName = "Sheet";

      let finalSheetName = sheetName;
      let counter = 1;
      while (workbook.SheetNames.includes(finalSheetName)) {
        finalSheetName = `${sheetName.substring(0, 28)}_${counter}`;
        counter++;
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, finalSheetName);
    }
  }

  if (hasData) {
    XLSX.writeFile(
      workbook,
      `${project.name.replace(/\s+/g, "_")}_Execution_Report.xlsx`,
    );
  }
};
