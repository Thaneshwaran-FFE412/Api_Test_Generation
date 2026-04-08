import { useEffect, useState } from "react";
import { ConstraintProp } from "./Workbench";
import toast from "react-hot-toast";
import ConstraintPopup from "./ConstraintPopup";
import VariableInput from "./VariableInput";

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
type SectionTypeProp = "queryParams" | "headers" | "pathParams" | "body";
interface KVEditorProps {
  endpoint: any;
  sectionType: SectionTypeProp;
  variables: Record<string, string>;
  bodyType: "raw" | "form-data" | "x-www-form-urlencoded" | "binary" | "none";
}

export const FormKeyEditor: React.FC<KVEditorProps> = ({
  endpoint,
  bodyType,
  sectionType,
  variables,
}) => {
  const [editingConstraint, setEditingConstraint] = useState<{
    fieldKey: string;
    isOpen: boolean;
  }>({ fieldKey: "", isOpen: false });
  const [section, setSection] = useState<SectionTypeProp>(sectionType);
  const [isEditable, setIsEditable] = useState<boolean>(true);
  const [showType, setShowType] = useState<boolean>(false);
  const [items, setItems] = useState<KVItem[]>([]);

  useEffect(() => {
    const req = endpoint.requestBody;
    console.log("UseEffect req");
    console.log(req);

    if (sectionType === "body") {
      if (Array.isArray(req?.body)) {
        setItems(
          req.body.map((p: any, idx: number) => ({
            id: `${idx}`,
            key: p.key,
            value: p.value ?? "",
            enabled: p.enabled ?? true,
            type: p.type || "text",
          })),
        );
      } else if (req?.body && typeof req.body === "object") {
        const fields: KVItem[] = [];

        const flatten = (obj: any, prefix = "") => {
          if (obj === null || obj === undefined) return;

          if (Array.isArray(obj)) {
            obj.forEach((item, i) => flatten(item, `${prefix}[${i}]`));
          } else if (typeof obj === "object") {
            Object.keys(obj).forEach((key) => {
              const path = prefix ? `${prefix}.${key}` : key;
              flatten(obj[key], path);
            });
          } else {
            fields.push({
              id: prefix,
              key: prefix,
              value: String(obj),
              enabled: true,
            });
          }
        };

        flatten(req.body);
        setItems(fields);
      } else {
        setItems([]);
      }
    } else {
      setItems(
        (req?.[sectionType] || []).map((p: any, idx: number) => ({
          id: `${idx}`,
          key: p.key,
          value: p.value ?? "",
          enabled: p.enabled ?? true,
        })),
      );
    }

    setIsEditable(sectionType !== "pathParams");
    setShowType(sectionType === "body");
  }, [endpoint, sectionType]);

  const addRow = () => {
    const newItem: KVItem = {
      id: Math.random().toString(),
      key: "",
      value: "",
      enabled: true,
      type: "text",
    };

    setItems([...items, newItem]);
  };
  const updateRow = (id: string, field: keyof KVItem, val: any) => {
    const updatedItems = items.map((item) =>
      item.id === id ? { ...item, [field]: val } : item,
    );

    setItems(updatedItems);
    const updatedRequestBody = { ...endpoint.requestBody };

    if (sectionType === "body") {
      updatedRequestBody.body = updatedItems;
    } else {
      updatedRequestBody[sectionType] = updatedItems;
    }

    endpoint.requestBody = updatedRequestBody;
  };

  const removeRow = (id: string) => {
    const updated = items.filter((item) => item.id !== id);
    setItems(updated);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[40px_1fr_1fr_1fr_100px_40px] gap-4 text-[10px] font-black theme-text-secondary px-3 uppercase tracking-[0.2em] opacity-60">
        <span></span>
        <span>Key</span>
        <span>Value</span>
        <span>Constraint</span>
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
                  {item.options.map((opt: any) => (
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
              onClick={() =>
                setEditingConstraint({ fieldKey: item.key, isOpen: true })
              }
            />
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
      <ConstraintPopup
        isOpen={editingConstraint.isOpen}
        initialValue={
          endpoint?.constraint?.[sectionType]?.[editingConstraint.fieldKey]
        }
        onClose={() => {
          console.log("Closing Constraint Modal");
          setEditingConstraint({ fieldKey: "", isOpen: false });
        }}
        onSave={(val) => {
          const updated = { ...endpoint.constraint };
          if (!updated[sectionType]) {
            updated[sectionType] = {};
          }
          updated[sectionType][editingConstraint.fieldKey] = val;
          // ⚠️ trigger update properly (see next issue)
          endpoint.constraint = updated;
        }}
      />
    </div>
  );
};
