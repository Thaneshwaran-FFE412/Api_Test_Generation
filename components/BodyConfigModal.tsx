import { ApiEndpoint, KVItem, RawFormat } from "@/types";
import { ConstraintProp } from "./Workbench";
import VariableInput from "./VariableInput";
import { useEffect, useState } from "react";
import ConstraintPopup from "./ConstraintPopup";

interface BodyConfigModalProps {
  endpoint: ApiEndpoint;
  setSelectedEndpoint: React.Dispatch<React.SetStateAction<ApiEndpoint | null>>;
  variables: Record<string, string>;
  setShowBodyConfig: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface fieldItem {
  key: string;
  value: string;
  enabled: boolean;
  type?: "text" | "file";
  description?: string;
  options?: string[];
  dataType?: string;
}

export const BodyConfigModal: React.FC<BodyConfigModalProps> = ({
  endpoint,
  setSelectedEndpoint,
  variables,
  setShowBodyConfig,
}) => {
  const [jsonFields, setJsonFields] = useState<fieldItem[]>([]);
  const [format, setFormat] = useState<RawFormat>("json");
  const [localContent, setLocalContent] = useState("");
  const [constraintModal, setConstraintModal] = useState({
    fieldKey: "",
    isOpen: false,
  });

  const handleApply = () => {
    setShowBodyConfig(false);
  };

  useEffect(() => {
    if (!endpoint?.requestBody?.body) return;

    const raw = endpoint.requestBody.body;

    let jsonStr = "";
    if (typeof raw === "object") {
      jsonStr = JSON.stringify(raw, null, 2);
    } else {
      jsonStr = raw;
    }

    setLocalContent(jsonStr);
    setFormat(endpoint.requestBody.rawFormat || "json");

    try {
      const parsed = typeof raw === "object" ? raw : JSON.parse(raw);

      const fields: fieldItem[] = [];

      const flatten = (obj: any, prefix = "") => {
        if (obj === null || obj === undefined) return;
        if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
            const path = prefix ? `${prefix}[${index}]` : `[${index}]`;
            flatten(item, path);
          });
        } else if (typeof obj === "object") {
          Object.keys(obj).forEach((key) => {
            const path = prefix ? `${prefix}.${key}` : key;
            flatten(obj[key], path);
          });
        } else {
          fields.push({
            key: prefix,
            value: String(obj),
            enabled: true,
            dataType: typeof obj,
          });
        }
      };

      flatten(parsed);
      setJsonFields(fields);
    } catch (e) {
      setJsonFields([]);
    }
  }, [endpoint]);

  const getField = (field: string) => {
    const obj = endpoint.constraint?.body?.[field];
    if (!obj) return "";
    return Object.entries(obj)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ");
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
            onClick={() => {
              setShowBodyConfig(false);
            }}
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
              value={localContent} // need to remove
              variables={variables}
              onChange={() => {
                console.log("Text Area Detected");
              }}
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
                    </tr>
                  </thead>
                  <tbody className="divide-y theme-border">
                    {jsonFields.map((field, idx) => (
                      <tr
                        key={field.key}
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
                            value={getField(field.key)}
                            readOnly
                            onClick={() => {
                              setConstraintModal({
                                fieldKey: field.key,
                                isOpen: true,
                              });
                            }}
                          />
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
            onClick={() => {
              setShowBodyConfig(false);
            }}
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
      <ConstraintPopup
        isOpen={constraintModal.isOpen}
        initialValue={endpoint.constraint.body[constraintModal.fieldKey]}
        onClose={() => {
          setConstraintModal({ fieldKey: "", isOpen: false });
        }}
        onSave={(val) => {
          const updated = { ...endpoint.constraint };
          if (!updated.body) updated.body = {};
          updated.body[constraintModal.fieldKey] = val;
          setConstraintModal({ fieldKey: "", isOpen: false });
          setSelectedEndpoint({ ...endpoint, constraint: updated });
        }}
      />
    </div>
  );
};
