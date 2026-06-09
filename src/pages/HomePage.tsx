import { useState } from "react";

import { ThemeProvider } from "@/contexts/ThemeContext";
import LandingPage from "@/pages/LandingPage";
import OnboardingQuiz from "@/pages/OnboardingQuiz";
import TripResult from "@/pages/TripResult";

type TripPage = "landing" | "quiz" | "result";

function TripPlanner() {
  const [page, setPage] = useState<TripPage>("landing");

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }} className="min-h-screen">
      {page === "landing" && <LandingPage onStart={() => setPage("quiz")} />}
      {page === "quiz" && (
        <OnboardingQuiz onComplete={() => setPage("result")} onBack={() => setPage("landing")} />
      )}
      {page === "result" && (
        <TripResult onEdit={() => setPage("quiz")} onHome={() => setPage("landing")} />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <ThemeProvider>
      <TripPlanner />
    </ThemeProvider>
  );
}
