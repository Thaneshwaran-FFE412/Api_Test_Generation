import * as XLSX from "xlsx-js-style";

export const formatAndAppendSheet = (
  workbook: XLSX.WorkBook,
  sheetRows: any[],
  moduleName: string,
  requestName: string,
  dependentScripts?: string,
) => {
  if (sheetRows.length === 0) return;

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

  const worksheet = XLSX.utils.json_to_sheet([]);
  XLSX.utils.sheet_add_json(worksheet, sheetRows, { origin: "A5" });

  const metaData = [
    ["Module Name", moduleName],
    ["Request Name", requestName],
    ["Dependent Scripts", dependentScripts || "None"],
  ];

  XLSX.utils.sheet_add_aoa(worksheet, metaData, { origin: "A1" });

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
    "Actual Result": 15,
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
    alignment: {
      vertical: "center",
      horizontal: "center",
      wrapText: true,
    },
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
};
