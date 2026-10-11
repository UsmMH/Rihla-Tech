import { useEffect, useState } from "react";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { navigate } from "@/lib/navigation";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";

function getBasePath(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

function getAppPath(): string {
  const basePath = getBasePath();
  const { pathname } = window.location;
  const local =
    basePath && pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || "/"
      : pathname;
  return local;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  const [path, setPath] = useState(getAppPath);
  const [pendingVerification, setPendingVerification] = useState<{ email: string; autoSend: boolean } | null>(null);

  useEffect(() => {
    const onPopState = () => setPath(getAppPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && (path === "/login" || path === "/register")) {
      navigate("/");
    }
  }, [isLoading, isAuthenticated, path]);

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#F4F8FC", color: "#4E7090", fontFamily: "system-ui, sans-serif" }}
      >
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    if (pendingVerification) {
      return (
        <VerifyEmailPage
          email={pendingVerification.email}
          autoSendOnMount={pendingVerification.autoSend}
          onVerified={() => {
            setPendingVerification(null);
            navigate("/");
          }}
          onBack={() => {
            setPendingVerification(null);
            navigate("/login");
          }}
        />
      );
    }

    if (path === "/register") {
      return (
        <RegisterPage
          onSuccess={(email) => setPendingVerification({ email, autoSend: false })}
          onGoLogin={() => navigate("/login")}
        />
      );
    }

    return (
      <LoginPage
        onSuccess={() => navigate("/")}
        onGoRegister={() => navigate("/register")}
        onUnverified={(email) => setPendingVerification({ email, autoSend: true })}
      />
    );
  }

  return <HomePage />;
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
