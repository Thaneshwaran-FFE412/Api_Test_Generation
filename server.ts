import express from "express";
import cors from "cors";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import path from "path";
import FormData from "form-data";
import https from "https";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  app.post("/api/proxy", async (req, res) => {
    try {
      const { method = "GET", url, headers = {}, data } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      const cleanHeaders: any = { ...headers };
      delete cleanHeaders.host;
      delete cleanHeaders.origin;
      delete cleanHeaders.referer;
      delete cleanHeaders["content-length"];

      let finalData: any = data;
      let finalHeaders = { ...cleanHeaders };

      if (typeof finalData === "string") {
        try {
          finalData = JSON.parse(finalData);
        } catch {
          // keep as string
        }
      }

      if (finalData && finalData._isFormData) {
        const form = new FormData();

        if (Array.isArray(finalData.items)) {
          finalData.items.forEach((item: any) => {
            form.append(item.key, item.value);
          });
        }

        finalData = form;
        finalHeaders = {
          ...finalHeaders,
          ...form.getHeaders(),
        };
      }

      const response = await axios({
        method,
        url,
        headers: finalHeaders,
        data: finalData,
        validateStatus: () => true,
        timeout: 30000,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        responseType: "arraybuffer",
      });
      let responseData: any = response.data;
      try {
        responseData = JSON.parse(response.data.toString());
      } catch {
        responseData = response.data.toString();
      }

      res.status(response.status).json({
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: responseData,
      });
    } catch (error: any) {
      console.error("Proxy error:", error.message);
      res.status(500).json({
        error: "Proxy request failed",
        details: error.message,
      });
    }
  });

  // Development (Vite middleware)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // ===============================
    // Production
    // ===============================
    const distPath = path.join(process.cwd(), "dist");

    app.use(express.static(distPath));
    // SPA fallback for React Router
    app.use((req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
