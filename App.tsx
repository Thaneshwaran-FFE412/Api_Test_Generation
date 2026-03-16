import React, { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import WorkspacePage from "./pages/WorkspacePage";
import { User, SwaggerProject } from "./types";

type Theme = "light";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>({
    username: "Fireflink User",
    email: "fireflink.com",
  });
  const [projects, setProjects] = useState<SwaggerProject[]>([]);
  const [activeProject, setActiveProject] = useState<SwaggerProject | null>(
    null,
  );
  const [theme, setTheme] = useState<Theme>("light");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("apipro_user");
    const savedProjects = localStorage.getItem("apipro_projects");
    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedProjects) setProjects(JSON.parse(savedProjects));
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("apipro_projects", JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("apipro_theme", theme);
  }, [theme]);

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem("apipro_user", JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("apipro_user");
  };

  const addProject = (project: SwaggerProject) => {
    setProjects((prev) => [...prev, project]);
    setActiveProject(project);
  };

  const updateProject = (updated: SwaggerProject) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    if (activeProject?.id === updated.id) setActiveProject(updated);
  };

  const deleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProject?.id === id) setActiveProject(null);
  };

  if (!isInitialized) return null;

  return (
    <HashRouter>
      <div className="min-h-screen theme-bg-main theme-text-primary flex flex-col">
        <header className="border-b theme-border px-6 py-3 flex items-center justify-between theme-bg-surface/50 backdrop-blur-md sticky top-0 z-50">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="../assets/image/fireflink_logo.svg"
              alt="Fireflink API Logo"
              className="w-32 h-8 rounded-sm"
            />
          </Link>
          <nav className="flex items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-[#71347B] rounded-full cursor-pointer flex items-center justify-center text-white shadow-lg">
                F
              </div>
            </div>
          </nav>
        </header>
        <main
          style={{ height: "calc(100vh - 65px)" }}
          className="flex flex-col"
        >
          <Routes>
            <Route
              path="/"
              element={
                <LandingPage
                  user={user}
                  projects={projects}
                  addProject={addProject}
                  setActiveProject={setActiveProject}
                  deleteProject={deleteProject}
                />
              }
            />
            <Route
              path="/workspace/:projectId"
              element={
                <>
                  {activeProject ? (
                    <WorkspacePage
                      project={activeProject}
                      updateProject={updateProject}
                    />
                  ) : (
                    <Navigate to="/" />
                  )}
                </>
              }
            />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
