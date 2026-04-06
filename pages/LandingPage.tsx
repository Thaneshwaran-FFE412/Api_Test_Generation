import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, SwaggerProject, ApiEndpoint } from "../types";
import toast from "react-hot-toast";

export const BASE_URL = "http://localhost:8080";

interface LandingPageProps {
  addProject: (p: SwaggerProject) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ addProject }) => {
  const [url, setUrl] = useState("https://petstore.swagger.io/v2/swagger.json");
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

  const handleImportUrl = async () => {
    if (!url) return;
    setIsLoading(true);
    setError("");
    try {
      const data: any = await fetch(`${BASE_URL}/project/url?url=${url}`, {
        method: "GET",
      });
      const response = await data.json();
      addProject(response.responseObject);
      toast.success("API's Imported successfully");
      navigate(`/workspace/${response.responseObject.id}`);
    } catch (err: any) {
      setError(
        err.message ||
          "Failed to load Swagger from URL. Ensure the URL is accessible.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>,
  ) => {
    let file: File | undefined;
    if ("dataTransfer" in e) {
      e.preventDefault();
      file = e.dataTransfer.files?.[0];
    } else {
      file = e.target.files?.[0];
    }
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const data: any = await fetch(`${BASE_URL}/project/create`, {
      method: "POST",
      body: formData,
    });

    const response = await data.json();
    addProject(response.responseObject);
    toast.success("API's Imported successfully");
    navigate(`/workspace/${response.responseObject.id}`);
  };

  return (
    <div className="h-screen overflow-hidden bg-[#F9F5FF] py-4 px-6">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-extrabold mb-4 text-slate-900">
          Automate Your API Testing
        </h1>
        <p className="text-slate-600 text-xl max-w-2xl mx-auto">
          The all-in-one platform to parse OpenAPI specs, generate manual test
          cases, run automation reports, and export Postman collections.
        </p>
      </div>
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Import URL Card */}
        <div className="bg-[#71347B1A] p-6 rounded-2xl border-2 border-dashed border-[#71347B] flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-[#71347B]/10 text-[#71347B] rounded-full flex items-center justify-center mb-6">
            <i className="fas fa-link text-3xl"></i>
          </div>

          <h2 className="text-xl font-bold mb-6 text-slate-900">Import URL</h2>

          <div className="w-full flex gap-2">
            <input
              type="text"
              placeholder="Enter URL (Supports JSON Only)"
              className="w-full border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#71347B]"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />

            <button
              onClick={handleImportUrl}
              disabled={isLoading}
              className="bg-[#71347B] hover:bg-[#5c2964] text-white px-6 py-1 rounded font transition-colors disabled:opacity-50"
            >
              {isLoading ? "Loading..." : "Import"}
            </button>
          </div>
          {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}
        </div>

        {/* Upload Card */}
        <div
          className="bg-[#71347B1A] p-6 rounded-2xl border-2 border-dashed border-[#71347B] flex flex-col items-center text-center cursor-pointer"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileUpload}
        >
          <input
            type="file"
            accept=".json,.yaml,.yml"
            onChange={handleFileUpload}
            className="hidden"
            ref={fileInputRef}
          />
          <div className="w-16 h-16 bg-[#71347B]/10 text-[#71347B] rounded-full flex items-center justify-center mb-6">
            <i className="fas fa-file-upload text-3xl"></i>
          </div>
          <h2 className="text-xl font-bold mb-2 text-slate-900">
            Drag & Drop your file to upload
          </h2>
          <p className="text-slate-500 text-sm mb-2">
            (Supports JSON & YAML Formats)
          </p>
          <p className="text-slate-900 font-bold mb-2">Or</p>
          <div className="w-full">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#71347B] hover:bg-[#5c2964] text-white px-6 py-1 rounded font transition-colors"
            >
              Choose File to Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
