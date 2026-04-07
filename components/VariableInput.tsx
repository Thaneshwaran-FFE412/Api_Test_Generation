import { useRef, useState } from "react";

const VariableInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  variables: Record<string, string>;
  readOnly?: boolean;
  type?: "text" | "textarea";
  insertRawName?: boolean;
}> = ({
  value,
  onChange,
  placeholder,
  className,
  variables,
  readOnly,
  type = "text",
  insertRawName = false,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const updateCursorPos = () => {
    if (inputRef.current) {
      setCursorPos(inputRef.current.selectionStart || 0);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const newVal = e.target.value;
    const pos = e.target.selectionStart || 0;
    setCursorPos(pos);
    onChange(newVal);

    // Show dropdown if last typed char was $
    if (newVal[pos - 1] === "$") {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  };

  const selectVariable = (varName: string) => {
    const before = value.substring(0, cursorPos);
    const after = value.substring(cursorPos);

    const cleanBefore = before.endsWith("$") ? before.slice(0, -1) : before;
    const newVal = insertRawName
      ? cleanBefore + varName + after
      : cleanBefore + "${" + varName + "}" + after;

    onChange(newVal);
    setShowDropdown(false);

    // Focus back and set cursor after the inserted variable
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = insertRawName
          ? cleanBefore.length + varName.length
          : cleanBefore.length + varName.length + 3;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  return (
    <div
      className={`relative flex-1 flex ${type === "textarea" ? "items-stretch" : "items-center"}`}
    >
      {type === "textarea" ? (
        <textarea
          ref={inputRef as any}
          className={`${className} h-full`}
          placeholder={placeholder}
          value={value}
          readOnly={readOnly}
          onChange={handleInputChange}
          onKeyUp={updateCursorPos}
          onClick={updateCursorPos}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        />
      ) : (
        <input
          ref={inputRef as any}
          type="text"
          className={className}
          placeholder={placeholder}
          value={value}
          readOnly={readOnly}
          onChange={handleInputChange}
          onKeyUp={updateCursorPos}
          onClick={updateCursorPos}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        />
      )}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          updateCursorPos();
          setShowDropdown(!showDropdown);
        }}
        className={`absolute right-3 text-indigo-400 hover:text-indigo-300 transition-colors p-1 z-10 ${type === "textarea" ? "top-3" : ""}`}
        title="Insert variable"
      >
        <i className="fas fa-dollar-sign text-[10px]"></i>
      </button>
      {showDropdown && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className={`absolute z-50 right-2 w-48 theme-bg-surface border theme-border rounded-lg shadow-2xl max-h-48 overflow-y-auto py-1 animate-in fade-in zoom-in duration-150 ${type === "textarea" ? "top-10" : "top-8"}`}
        >
          <div className="px-3 py-1 border-b theme-border mb-1">
            <span className="text-[8px] font-black theme-text-secondary uppercase tracking-widest">
              Select Variable
            </span>
          </div>
          {Object.keys(variables).length === 0 ? (
            <div className="px-3 py-4 text-center text-[10px] theme-text-secondary italic">
              No variables defined
            </div>
          ) : (
            Object.keys(variables).map((v) => (
              <button
                key={v}
                onClick={() => selectVariable(v)}
                className="w-full text-left px-3 py-2 text-[10px] font-bold theme-text-primary hover:theme-accent-bg hover:text-white transition-all flex items-center justify-between group"
              >
                <span>{v}</span>
                <i className="fas fa-plus text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"></i>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default VariableInput;