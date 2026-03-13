import React, { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import WorkspacePage from "./pages/WorkspacePage";
import { User, SwaggerProject } from "./types";

type Theme = "light" | "dark";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>({
    username: "Fireflink User",
    email: "fireflink.com",
  });
  const [projects, setProjects] = useState<SwaggerProject[]>([]);
  const [activeProject, setActiveProject] = useState<SwaggerProject | null>(
    null,
  );
  const [theme, setTheme] = useState<Theme>("dark");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("apipro_user");
    const savedProjects = localStorage.getItem("apipro_projects");
    const savedTheme = localStorage.getItem("apipro_theme") as Theme;
    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedProjects) setProjects(JSON.parse(savedProjects));
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
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

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  if (!isInitialized) return null;

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
  };

  return (
    <HashRouter>
      <div className="min-h-screen theme-bg-main theme-text-primary flex flex-col">
        <header className="border-b theme-border px-6 py-3 flex items-center justify-between theme-bg-surface/50 backdrop-blur-md sticky top-0 z-50">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 theme-accent-bg rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              API
            </div>
            <span className="text-xl font-bold tracking-tight">
              APITest Pro
            </span>
          </Link>
          <nav className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-4 border-r theme-border pr-4 mr-2">
                <button
                  onClick={toggleTheme}
                  className="p-2.5 theme-bg-main border theme-border rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2 text-xs font-bold"
                  title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
                >
                  <i
                    className={`fas fa-${theme === "light" ? "moon text-indigo-400" : "sun text-amber-400"}`}
                  ></i>
                  <span className="capitalize">{theme} Theme</span>
                </button>
              </div>
            )}

            {user ? (
              <div className="flex items-center gap-4">
                <span className="theme-text-secondary text-sm hidden sm:inline">
                  Hi,{" "}
                  <span className="theme-accent-text font-semibold">
                    {user.username}
                  </span>
                </span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-1.5 text-xs bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 rounded-lg transition-all border border-red-500/20 font-bold uppercase tracking-wider"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium hover:theme-accent-text transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-6 py-2 text-sm font-bold theme-accent-bg text-white rounded-xl transition-all shadow-xl shadow-indigo-500/25 hover:opacity-90"
                >
                  Sign Up
                </Link>
              </div>
            )}
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
                <ProtectedRoute>
                  <LandingPage
                    user={user}
                    projects={projects}
                    addProject={addProject}
                    setActiveProject={setActiveProject}
                    deleteProject={deleteProject}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/workspace/:projectId"
              element={
                <ProtectedRoute>
                  {activeProject ? (
                    <WorkspacePage
                      project={activeProject}
                      updateProject={updateProject}
                    />
                  ) : (
                    <Navigate to="/" />
                  )}
                </ProtectedRoute>
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
