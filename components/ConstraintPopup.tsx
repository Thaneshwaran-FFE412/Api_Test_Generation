import React, { useState, useEffect } from "react";

interface ConstraintPopupProps {
  isOpen: boolean;
  initialValue: Record<string, any>;
  onClose: () => void;
  onSave: (value: Record<string, any>) => void;
}

const CONSTRAINT_OPTIONS = [
  "required",
  "type",
  "pattern",
  "minLen",
  "maxLen",
  "min",
  "max",
  "enum",
  "generation mode",
];

const ConstraintPopup: React.FC<ConstraintPopupProps> = ({
  isOpen,
  initialValue,
  onClose,
  onSave,
}) => {
  const [constraints, setConstraints] = useState<
    { key: string; value: string }[]
  >([]);

  useEffect(() => {
    if (isOpen) {
      if (!initialValue || typeof initialValue !== "object") {
        setConstraints([]);
        return;
      }

      const parsed = Object.entries(initialValue).map(([key, value]) => ({
        key,
        value: String(value),
      }));

      setConstraints(parsed);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleAdd = () => {
    setConstraints([...constraints, { key: "required", value: "true" }]);
  };

  const handleRemove = (index: number) => {
    setConstraints(constraints.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: "key" | "value", val: string) => {
    const newConstraints = [...constraints];
    newConstraints[index][field] = val;

    if (field === "key") {
      if (
        val === "required" &&
        newConstraints[index].value !== "true" &&
        newConstraints[index].value !== "false"
      ) {
        newConstraints[index].value = "true";
      } else if (
        val === "type" &&
        !["string", "number", "integer", "boolean", "array", "object"].includes(
          newConstraints[index].value,
        )
      ) {
        newConstraints[index].value = "string";
      }
    }

    setConstraints(newConstraints);
  };

  const handleSave = () => {
    const obj: Record<string, any> = {};

    constraints.forEach((c) => {
      if (!c.key) return;

      let value: any = c.value;

      if (c.key === "required") value = c.value === "true";
      else if (["min", "max", "minLen", "maxLen"].includes(c.key))
        value = Number(c.value);

      obj[c.key] = value;
    });

    onSave(obj);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="theme-bg-surface border theme-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-4 border-b theme-border flex justify-between items-center theme-bg-workbench/50">
          <h3 className="text-sm font-bold theme-text-primary">
            Edit Constraints
          </h3>
          <button
            onClick={onClose}
            className="theme-text-secondary hover:theme-text-primary transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {constraints.length === 0 ? (
            <div className="text-center theme-text-secondary text-xs py-4">
              No constraints added yet.
            </div>
          ) : (
            constraints.map((c, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select
                  value={c.key}
                  onChange={(e) => handleChange(idx, "key", e.target.value)}
                  className="theme-bg-workbench border theme-border rounded-lg px-3 py-2 text-xs theme-text-primary outline-none focus:border-theme-accent-text w-1/3"
                >
                  {CONSTRAINT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  {!CONSTRAINT_OPTIONS.includes(c.key) && (
                    <option value={c.key}>{c.key}</option>
                  )}
                </select>

                {c.key === "required" ? (
                  <select
                    value={c.value}
                    onChange={(e) => handleChange(idx, "value", e.target.value)}
                    className="theme-bg-workbench border theme-border rounded-lg px-3 py-2 text-xs theme-text-primary outline-none focus:border-theme-accent-text flex-1"
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : c.key === "generationMode" ? (
                  <select
                    value={c.value}
                    onChange={(e) => handleChange(idx, "value", e.target.value)}
                    className="theme-bg-workbench border theme-border rounded-lg px-3 py-2 text-xs theme-text-primary outline-none focus:border-theme-accent-text flex-1"
                  >
                    <option value="STATIC">STATIC</option>
                    <option value="DYNAMIC">DYNAMIC</option>
                  </select>
                ) : c.key === "type" ? (
                  <select
                    value={c.value}
                    onChange={(e) => handleChange(idx, "value", e.target.value)}
                    className="theme-bg-workbench border theme-border rounded-lg px-3 py-2 text-xs theme-text-primary outline-none focus:border-theme-accent-text flex-1"
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="integer">integer</option>
                    <option value="boolean">boolean</option>
                    <option value="array">array</option>
                    <option value="object">object</option>
                  </select>
                ) : ["minLen", "maxLen", "min", "max"].includes(c.key) ? (
                  <input
                    type="number"
                    value={c.value}
                    onChange={(e) => handleChange(idx, "value", e.target.value)}
                    placeholder="Value"
                    className="theme-bg-workbench border theme-border rounded-lg px-3 py-2 text-xs theme-text-primary outline-none focus:border-theme-accent-text flex-1"
                  />
                ) : (
                  <input
                    value={c.value}
                    onChange={(e) => handleChange(idx, "value", e.target.value)}
                    placeholder={c.key === "enum" ? "e.g. A|B|C" : "Value"}
                    className="theme-bg-workbench border theme-border rounded-lg px-3 py-2 text-xs theme-text-primary outline-none focus:border-theme-accent-text flex-1"
                  />
                )}

                <button
                  onClick={() => handleRemove(idx)}
                  className="text-rose-500 hover:text-rose-400 p-2"
                >
                  <i className="fas fa-trash-alt text-[11px]"></i>
                </button>
              </div>
            ))
          )}
          <button
            onClick={handleAdd}
            className="text-xs theme-accent-text hover:theme-accent-text/80 font-bold"
          >
            + Add Constraint
          </button>
        </div>

        <div className="p-4 border-t theme-border theme-bg-workbench/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold theme-text-secondary hover:theme-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-bold theme-accent-bg hover:theme-accent-hover text-white rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
          >
            Save Constraints
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConstraintPopup;
