import { BASE_URL } from "@/pages/LandingPage";
import { VariableProp } from "@/pages/WorkspacePage";
import React, { useState } from "react";
import toast from "react-hot-toast";

interface VariablesPanelProps {
  variables: VariableProp[];
  onVariablesChange: () => void;
}

const VariablesPanel: React.FC<VariablesPanelProps> = ({
  variables,
  onVariablesChange,
}) => {
  const [newVarKey, setNewVarKey] = useState("");
  const [newVarValue, setNewVarValue] = useState("");
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  React.useEffect(() => {
    const map: Record<string, string> = {};
    variables.forEach((v) => {
      map[v.id] = v.value;
    });
    setLocalValues(map);
  }, [variables]);

  const createVariable = async (variable: any) => {
    try {
      const res = await fetch(`${BASE_URL}/variable/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          projectId: variable.projectId ?? "",
        },
        body: JSON.stringify(variable),
      });

      let response;

      try {
        response = await res.json();
      } catch {
        response = { message: "Invalid JSON response from server" };
      }

      console.log("response:", response);

      if (!res.ok) {
        toast.error(response.message || "Server error");
        return;
      }

      if (response.responseCode === 200) {
        toast.success(response.message);
        onVariablesChange();
      } else {
        toast.error(response.message || "Failed to create variable");
      }
    } catch (err: any) {
      console.error("Network / API error:", err);
      toast.error(err.message || "Network error");
    }
  };

  const editVariable = async (variable: VariableProp) => {
    try {
      const res = await fetch(
        `${BASE_URL}/variable/editVariable/${variable.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            projectId: variable.projectId ?? "",
          },
          body: JSON.stringify(variable),
        },
      );

      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }

      const response = await res.json();

      if (response.responseCode === 200) {
        onVariablesChange();
      } else {
        console.error("Failed to create variable", response);
      }
    } catch (err) {
      console.error("Network / API error:", err);
    }
  };

  const deleteVariable = async (variableId: string) => {
    try {
      const res = await fetch(`${BASE_URL}/variable/delete/${variableId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }

      const response = await res.json();

      if (response.responseCode === 200) {
        onVariablesChange();
      } else {
        console.error("Failed to Delete variable", response);
      }
    } catch (err) {
      console.error("Network / API error:", err);
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVarKey.trim()) return;
    createVariable({ name: newVarKey.trim(), value: newVarValue });
    setNewVarKey("");
    setNewVarValue("");
  };

  const handleUpdate = (id: string, value: string) => {
    setLocalValues((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b theme-border theme-bg-main">
        <form
          onSubmit={handleAdd}
          className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end"
        >
          <div className="space-y-1.5">
            <label className="text-[10px] font-black theme-text-secondary uppercase tracking-[0.2em] ml-1">
              Variable Key
            </label>
            <input
              type="text"
              placeholder="e.g. baseUrl"
              className="w-full theme-bg-main border theme-border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#71347B]/50 outline-none font-mono theme-text-primary transition-all"
              value={newVarKey}
              onChange={(e) => setNewVarKey(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black theme-text-secondary uppercase tracking-[0.2em] ml-1">
              Value
            </label>
            <input
              type="text"
              placeholder="Value"
              className="w-full theme-bg-main border theme-border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#71347B]/50 outline-none font-mono theme-text-primary transition-all"
              value={newVarValue}
              onChange={(e) => setNewVarValue(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="theme-accent-bg text-white px-6 rounded-lg text-xs font-black tracking-widest hover:opacity-90 transition-all shadow-lg h-[34px] active:scale-95"
          >
            ADD
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {variables.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 grayscale">
            <div className="w-12 h-12 theme-bg-main border-2 theme-border rounded-xl flex items-center justify-center mb-4 shadow-xl rotate-3">
              <i className="fas fa-code text-xl theme-accent-text"></i>
            </div>
            <p className="theme-text-secondary text-[10px] font-black uppercase tracking-widest">
              No variables defined
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_40px] gap-4 text-[10px] font-black theme-text-secondary px-3 uppercase tracking-[0.2em] opacity-60 mb-2">
              <span>Variable Key</span>
              <span>Value</span>
              <span></span>
            </div>
            <div className="space-y-1">
              {variables &&
                variables.map((v) => (
                  <div
                    key={v.id}
                    className="grid grid-cols-[1fr_1fr_40px] gap-4 items-center theme-bg-surface/30 p-2 rounded-xl border border-transparent hover:border-[#71347B]/30 transition-all group"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-bold text-[#71347B] font-mono truncate">
                        ${v.name}
                      </span>
                      <span className="text-[8px] theme-text-secondary font-mono opacity-50 truncate">
                        {"{{" + v.name + "}}"}
                      </span>
                    </div>

                    <input
                      type="text"
                      value={localValues[v.id] ?? ""}
                      onChange={(e) => handleUpdate(v.id, e.target.value)}
                      onBlur={(e) => {
                        const newValue = e.target.value;

                        if (newValue !== v.value) {
                          editVariable({ ...v, value: newValue });
                        }
                      }}
                      className="theme-bg-main border theme-border rounded-lg px-3 py-1.5 text-xs font-mono theme-text-primary focus:ring-2 focus:ring-[#71347B]/50 outline-none transition-all"
                    />
                    <div className="flex justify-center">
                      <button
                        onClick={() => deleteVariable(v.id)}
                        className="text-rose-500 opacity-20 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-90"
                      >
                        <i className="fas fa-trash-alt text-[11px]"></i>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-[#71347B]/5 border-t theme-border">
        <p className="text-[9px] theme-text-secondary leading-relaxed font-medium italic">
          <i className="fas fa-info-circle mr-1.5 text-[#71347B]"></i>
          Variables are shared across all requests. Use{" "}
          <span className="text-[#71347B] font-bold">$key</span> to reference
          them.
        </p>
      </div>
    </div>
  );
};

export default VariablesPanel;
