import { ApiEndpoint, KVItem, RawFormat } from "@/types";
import { ConstraintProp } from "./Workbench";
import VariableInput from "./VariableInput";
import ConstraintModal from "./ConstraintModal";
import { useEffect, useState } from "react";

interface BodyConfigModalProps {
  endpoint: ApiEndpoint;
  variables: Record<string, string>;
}

export const BodyConfigModal: React.FC<BodyConfigModalProps> = ({
  endpoint,
  variables,
}) => {
  console.log("all Propos");
  console.log({
    endpoint,
    variables,
  });
  const [jsonFields, setJsonFields] = useState<KVItem[]>([]);
  const [format, setFormat] = useState<RawFormat>("json");

  const handleApply = () => {
    console.log("On Applying Changes");
  };
  useEffect(() => {
    console.log(endpoint);
    if (endpoint.requestBody) {
      const content = endpoint.requestBody.content;
    }
  }, [])
  
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
            onClick={()=>{console.log("On click of cancel");
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
              value={"localContent"} // need to remove
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
                            onClick={() => {
                              console.log("Setting ID");
                            }}
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
            onClick={() => {
              console.log("On click Cancel");
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
      <ConstraintModal
        isOpen={false}
        initialValue={""}
        onClose={() => {
          console.log("Closing Constraint Modal");
        }}
        onSave={(val) => {
          console.log("value from constraint modal");
          console.log(val);
        }}
      />
    </div>
  );
};
