import React from "react";
import { GlobalAuth } from "../types";

interface AuthHeaderProps {
  auth: GlobalAuth;
  setAuth: (a: GlobalAuth) => void;
  compact?: boolean;
}

const AuthHeader: React.FC<AuthHeaderProps> = ({ auth, setAuth, compact }) => {
  return (
    <div
      className={`${compact ? "flex items-center gap-4" : "px-6 py-3 border-b theme-border theme-bg-surface/30 flex items-center justify-between transition-all"}`}
    >
      <div className="flex items-center gap-4">
        {!compact && (
          <div className="flex items-center gap-2 text-xs font-bold theme-text-secondary uppercase">
            <i className="fas fa-shield-alt"></i>
            <span>Global Auth</span>
          </div>
        )}
        <div className="relative group">
          <select
            disabled={auth.isLocked}
            value={auth.type}
            onChange={(e) => setAuth({ ...auth, type: e.target.value as any })}
            className={`theme-bg-main border theme-border rounded px-3 py-1 text-xs focus:ring-1 focus:ring-indigo-500 cursor-pointer theme-text-primary transition-all ${auth.isLocked ? "opacity-60 cursor-not-allowed border-indigo-500/50 ring-1 ring-indigo-500/20" : ""}`}
          >
            <option value="none">No Auth</option>
            <option value="bearer">Bearer Token</option>
            <option value="basic">Basic Auth</option>
            <option value="oauth_1.0">OAuth 1.0</option>
            <option value="oauth_2.0">OAuth 2.0</option>
          </select>
          {auth.isLocked && (
            <div className="absolute left-0 -top-6 hidden group-hover:block whitespace-nowrap bg-indigo-600 text-white text-[9px] px-2 py-1 rounded shadow-lg z-50">
              Locked by Swagger Spec
            </div>
          )}
        </div>

        <div className="flex theme-bg-workbench p-0.5 rounded-lg border theme-border shrink-0">
          <button
            onClick={() => setAuth({ ...auth, mode: "static" })}
            className={`px-3 py-1 text-[9px] font-black uppercase rounded transition-all ${!auth.mode || auth.mode === "static" ? "bg-indigo-600 text-white shadow-lg" : "theme-text-secondary hover:theme-text-primary"}`}
          >
            Static
          </button>
          <button
            onClick={() => setAuth({ ...auth, mode: "dynamic" })}
            className={`px-3 py-1 text-[9px] font-black uppercase rounded transition-all ${auth.mode === "dynamic" ? "bg-indigo-600 text-white shadow-lg" : "theme-text-secondary hover:theme-text-primary"}`}
          >
            Dynamic
          </button>
        </div>

        {auth.type === "bearer" && (
          <input
            type="password"
            placeholder="Bearer Token"
            value={auth.bearerToken || ""}
            onChange={(e) => setAuth({ ...auth, bearerToken: e.target.value })}
            className={`theme-bg-main border theme-border rounded px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono w-[500px]}`}
          />
        )}

        {auth.type === "oauth_1.0" && (
          <input
            type="password"
            placeholder="O Auth 1.0 Token"
            value={auth.bearerToken || ""}
            onChange={(e) => setAuth({ ...auth, bearerToken: e.target.value })}
            className={`theme-bg-main border theme-border rounded px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono w-[500px]}`}
          />
        )}
        {auth.type === "oauth_2.0" && (
          <input
            type="password"
            placeholder="O Auth 2.0 Token"
            value={auth.bearerToken || ""}
            onChange={(e) => setAuth({ ...auth, bearerToken: e.target.value })}
            className={`theme-bg-main border theme-border rounded px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono w-[500px]}`}
          />
        )}

        {auth.type === "basic" && (
          <div className="flex gap-4">
            <input
              placeholder="Username"
              value={auth.username || ""}
              onChange={(e) => setAuth({ ...auth, username: e.target.value })}
              className={`theme-bg-main border theme-border rounded px-2 py-1 text-xs font-mono w-[500px]}`}
            />
            <input
              placeholder="Password"
              type="password"
              value={auth.password || ""}
              onChange={(e) => setAuth({ ...auth, password: e.target.value })}
              className={`theme-bg-main border theme-border rounded px-2 py-1 text-xs font-mono w-[500px]}`}
            />
          </div>
        )}
      </div>

      {!compact && (
        <div className="flex items-center gap-3">
          {auth.isLocked && (
            <span className="text-[10px] text-indigo-400 flex items-center gap-1 font-bold italic">
              <i className="fas fa-info-circle"></i>
              Strict Auth mode enabled
            </span>
          )}
          <div className="flex items-center gap-2 text-[10px] theme-text-secondary">
            <i className="fas fa-check-circle text-emerald-500/50"></i>
            <span>Persisted Settings</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthHeader;
