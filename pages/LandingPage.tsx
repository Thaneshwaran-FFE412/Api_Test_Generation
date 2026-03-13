import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, SwaggerProject, ApiEndpoint } from "../types";
import yaml from "js-yaml";

interface LandingPageProps {
  user: User | null;
  projects: SwaggerProject[];
  addProject: (p: SwaggerProject) => void;
  setActiveProject: (p: SwaggerProject) => void;
  deleteProject: (id: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({
  user,
  projects,
  addProject,
  setActiveProject,
  deleteProject,
}) => {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const parseSpec = (spec: any): ApiEndpoint[] => {
    const endpoints: ApiEndpoint[] = [];
    const paths = spec.paths || {};
    const globalSecurity = spec.security || [];

    Object.keys(paths).forEach((path) => {
      Object.keys(paths[path]).forEach((method) => {
        const details = paths[path][method];
        endpoints.push({
          id: Math.random().toString(36).substr(2, 9),
          method,
          path,
          summary:
            details.summary ||
            details.description ||
            `${method.toUpperCase()} ${path}`,
          tags: details.tags,
          parameters: details.parameters,
          requestBody: details.requestBody,
          responses: details.responses,
          security: details.security || globalSecurity,
        });
      });
    });
    return endpoints;
  };

  const getBaseUrl = (spec: any): string => {
    if (spec.servers && spec.servers.length > 0) {
      return spec.servers[0].url.replace(/\/$/, "");
    }
    const host = spec.host || "";
    const basePath = spec.basePath || "";
    const schemes = spec.schemes || ["http"];
    if (host.length === 0) {
      return "";
    }
    if (host.includes("http")) {
      return host;
    } else {
      return `${schemes[0]}://${host}${basePath}`.replace(/\/$/, "");
    }
  };

  const processSpecString = (rawSpec: string, fileName?: string) => {
    let spec: any;
    try {
      // Try JSON first
      spec = JSON.parse(rawSpec);
    } catch (e) {
      try {
        // Try YAML
        spec = yaml.load(rawSpec);
      } catch (e2) {
        throw new Error("Invalid format: Spec must be JSON or YAML");
      }
    }

    if (!spec || typeof spec !== "object") {
      throw new Error("Invalid spec format");
    }

    const endpoints = parseSpec(spec);
    const baseUrl = getBaseUrl(spec);

    const newProject: SwaggerProject = {
      id: Math.random().toString(36).substr(2, 9),
      name: spec.info?.title || fileName || "New Project",
      description: spec.info?.description || "",
      baseUrl,
      spec,
      endpoints,
      savedTestCases: [],
      createdAt: Date.now(),
    };
    addProject(newProject);
    navigate(`/workspace/${newProject.id}`);
  };

  const handleImportUrl = async () => {
    if (!url) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(url);
      const rawText = await response.text();
      processSpecString(rawText);
    } catch (err: any) {
      setError(
        err.message ||
          "Failed to load Swagger from URL. Ensure the URL is accessible and CORS is enabled.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawText = event.target?.result as string;
        processSpecString(rawText, file.name);
      } catch (err: any) {
        setError(err.message || "Invalid Swagger/OpenAPI file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-extrabold mb-4">
          Automate Your API Testing
        </h1>
        <p className="theme-text-secondary text-xl max-w-2xl mx-auto">
          The all-in-one platform to parse OpenAPI specs, generate manual test
          cases, run automation reports, and export Postman collections.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <div className="theme-bg-surface p-8 rounded-2xl border theme-border hover:border-indigo-500/50 transition-all">
          <div className="w-12 h-12 bg-indigo-500/20 text-indigo-500 rounded-lg flex items-center justify-center mb-6">
            <i className="fas fa-link text-xl"></i>
          </div>
          <h2 className="text-2xl font-bold mb-4">Import from URL</h2>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://petstore.swagger.io/v2/swagger.json"
                className="flex-1 theme-bg-main border theme-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button
                onClick={handleImportUrl}
                disabled={isLoading}
                className="theme-accent-bg hover:opacity-90 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isLoading ? "Loading..." : "Import"}
              </button>
            </div>
            <p className="text-[10px] theme-text-secondary italic">
              Supports JSON and YAML formats
            </p>
          </div>
          {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
        </div>

        <div className="theme-bg-surface p-8 rounded-2xl border theme-border hover:border-emerald-500/50 transition-all">
          <div className="w-12 h-12 bg-emerald-500/20 text-emerald-500 rounded-lg flex items-center justify-center mb-6">
            <i className="fas fa-file-upload text-xl"></i>
          </div>
          <h2 className="text-2xl font-bold mb-4">Upload Specification</h2>
          <label className="block w-full cursor-pointer theme-bg-main border-2 border-dashed theme-border hover:border-emerald-500/50 rounded-lg py-12 text-center transition-all">
            <input
              type="file"
              accept=".json,.yaml,.yml"
              onChange={handleFileUpload}
              className="hidden"
            />
            <i className="fas fa-cloud-upload-alt text-3xl mb-4 theme-text-secondary opacity-50"></i>
            <p className="theme-text-secondary">
              Click to upload or drag and drop JSON/YAML
            </p>
          </label>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold">Recent Projects</h3>
          <span className="theme-text-secondary text-sm">
            {projects.length} Projects Total
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="theme-bg-surface border theme-border rounded-xl p-12 text-center">
            <p className="theme-text-secondary italic">
              No projects yet. Import one to get started!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((p) => (
                <div
                  key={p.id}
                  className="group relative theme-bg-surface border theme-border rounded-xl p-6 hover:shadow-xl transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 theme-bg-main rounded flex items-center justify-center theme-text-secondary font-bold uppercase border theme-border">
                      {p.name.charAt(0)}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProject(p.id);
                      }}
                      className="theme-text-secondary hover:text-red-500 transition-colors"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                  <h4 className="text-lg font-bold mb-2 group-hover:theme-accent-text transition-colors">
                    {p.name}
                  </h4>
                  <p className="theme-text-secondary text-sm line-clamp-2 mb-4">
                    {p.description || "No description available."}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs theme-text-secondary">
                      {p.endpoints.length} Endpoints
                    </span>
                    <button
                      onClick={() => {
                        setActiveProject(p);
                        navigate(`/workspace/${p.id}`);
                      }}
                      className="theme-accent-text text-sm font-medium hover:underline"
                    >
                      Open Workspace →
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingPage;
