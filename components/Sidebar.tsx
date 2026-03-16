import React, { useState, useMemo } from "react";
import { ApiEndpoint } from "../types";

interface SidebarProps {
  endpoints: ApiEndpoint[];
  selectedId: string;
  onSelect: (endpoint: ApiEndpoint) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  endpoints,
  selectedId,
  onSelect,
}) => {
  const [filter, setFilter] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const getMethodColor = (method: string) => {
    switch (method.toLowerCase()) {
      case "get":
        return "text-emerald-500 bg-emerald-500/10";
      case "post":
        return "text-indigo-500 bg-indigo-500/10";
      case "put":
        return "text-amber-500 bg-amber-500/10";
      case "delete":
        return "text-rose-500 bg-rose-500/10";
      default:
        return "theme-text-secondary theme-bg-workbench";
    }
  };

  const groupedEndpoints = useMemo(() => {
    const groups: Record<string, ApiEndpoint[]> = {};

    const filtered = endpoints.filter(
      (e) =>
        e.path.toLowerCase().includes(filter.toLowerCase()) ||
        e.summary.toLowerCase().includes(filter.toLowerCase()),
    );

    filtered.forEach((e) => {
      const groupName = e.tags && e.tags.length > 0 ? e.tags[0] : "General";
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(e);
    });

    return groups;
  }, [endpoints, filter]);

  const groupKeys = Object.keys(groupedEndpoints).sort();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 border-b theme-border">
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 theme-text-secondary text-xs"></i>
          <input
            type="text"
            placeholder="Search API..."
            className="w-full theme-bg-main border theme-border rounded-md pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-1">
        {groupKeys.length === 0 ? (
          <p className="text-center theme-text-secondary text-xs py-4 italic">
            No matching APIs
          </p>
        ) : (
          groupKeys.map((group) => {
            // toggleGroup(group);
            console.log("group");
            console.log(collapsedGroups);

            return (
              <div key={group} className="mb-1">
                <button
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center gap-2 p-2 hover:theme-bg-surface rounded transition-colors text-left"
                >
                  <i
                    className={`fas fa-chevron-${collapsedGroups[group] ? "down" : "right"} text-[10px] theme-text-secondary w-3`}
                  ></i>
                  <i className={`fas fa-folder text-indigo-400 text-xs`}></i>
                  <span className="text-xs font-bold theme-text-primary uppercase tracking-wider truncate">
                    {group}
                  </span>
                  <span className="ml-auto text-[10px] theme-text-secondary px-1.5 py-0.5 rounded-full theme-bg-workbench">
                    {groupedEndpoints[group].length}
                  </span>
                </button>

                {collapsedGroups[group] && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l theme-border">
                    {groupedEndpoints[group].map((e) => (
                      <button
                        key={e.id}
                        onClick={() => onSelect(e)}
                        className={`w-full text-left p-2 pl-4 rounded-r-md transition-all group relative ${selectedId === e.id ? "theme-bg-surface ring-1 ring-inset ring-indigo-500/30" : "hover:theme-bg-surface"}`}
                      >
                        {selectedId === e.id && (
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500"></div>
                        )}
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className={`text-[9px] font-bold px-1 py-0.25 rounded uppercase flex-shrink-0 ${getMethodColor(e.method)}`}
                          >
                            {e.method}
                          </span>
                          <span className="text-[11px] font-medium theme-text-primary truncate flex-1">
                            {e.path}
                          </span>
                        </div>
                        <p className="text-[10px] theme-text-secondary truncate group-hover:theme-text-primary transition-colors">
                          {e.summary}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Sidebar;
