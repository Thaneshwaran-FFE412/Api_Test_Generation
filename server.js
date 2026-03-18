import express from "express";
import cors from "cors";
import axios from "axios";
import path from "path";
import FormData from "form-data";
import https from "https";

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  app.post("/api/proxy", async (req, res) => {
    try {
      const { method, url, headers, data } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      // Remove headers that might cause issues when proxying
      const cleanHeaders = { ...headers };
      delete cleanHeaders["host"];
      delete cleanHeaders["origin"];
      delete cleanHeaders["referer"];
      delete cleanHeaders["content-length"];

      let finalData = data;
      let finalHeaders = { ...cleanHeaders };

      if (data && data._isFormData) {
        const form = new FormData();
        if (data.items && Array.isArray(data.items)) {
          data.items.forEach((item) => {
            form.append(item.key, item.value);
          });
        }
        finalData = form;
        finalHeaders = { ...finalHeaders, ...form.getHeaders() };
      }

      const response = await axios({
        method: method || "GET",
        url,
        headers: finalHeaders,
        data: finalData,
        validateStatus: () => true, // Resolve promise for all HTTP status codes
        timeout: 30000,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      });

      res.status(response.status).json({
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
      });
    } catch (error) {
      console.error("Proxy error:", error.message);
      res.status(500).json({
        error: "Proxy request failed",
        details: error.message,
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(3000, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${3000}`);
  });
}

startServer();
