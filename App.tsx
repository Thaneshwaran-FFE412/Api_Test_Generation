import React, { useState, useEffect, useRef } from "react";
import { HashRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import logo from "./assets/image/fireflink_logo.svg";
import { Toaster } from "react-hot-toast";
import { Mail } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import LandingPage from "./pages/LandingPage";
import WorkspacePage from "./pages/WorkspacePage";
import { User, SwaggerProject } from "./types";

type Theme = "light";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>({
    username: "Fireflink User",
    email: "http://app.v3.fireflink.com",
  });
  const [activeProject, setActiveProject] = useState<SwaggerProject | null>(
    null,
  );
  const [theme, setTheme] = useState<Theme>("light");
  const [isInitialized, setIsInitialized] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    setActiveProject(project);
  };

  if (!isInitialized) return null;

  return (
    <HashRouter>
      <Toaster position="bottom-right" />
      <div className="min-h-screen theme-bg-main theme-text-primary flex flex-col">
        <header className="border-b theme-border px-6 py-3 flex items-center justify-between theme-bg-surface/50 backdrop-blur-md sticky top-0 z-50">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Fireflink API Logo" className="w-32 h-8" />
          </Link>
          <nav className="flex items-center gap-4">
            <div className="relative" ref={profileRef}>
              <div
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="cursor-pointer w-8 h-8 theme-accent-bg rounded-full flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20"
              >
                {user?.username?.[0] || "U"}
              </div>

              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-64 theme-bg-surface border theme-border rounded-2xl shadow-2xl z-[100] overflow-hidden"
                  >
                    <div className="p-4 border-b theme-border bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 theme-accent-bg rounded-full flex items-center justify-center font-bold text-white text-lg">
                          {user?.username?.[0] || "U"}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="font-bold theme-text-primary truncate">
                            {user?.username || "Guest User"}
                          </span>
                          <span className="text-xs theme-text-secondary truncate flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user?.email || "No email"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>
        </header>
        <main
          style={{ height: "calc(100vh - 65px)" }}
          className="flex flex-col"
        >
          <Routes>
            <Route path="/" element={<LandingPage addProject={addProject} />} />
            <Route
              path="/workspace/:projectId"
              element={
                <>
                  {activeProject ? (
                    <WorkspacePage project={activeProject} />
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
