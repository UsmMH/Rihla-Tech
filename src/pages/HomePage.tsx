import { useState } from "react";

import { ThemeProvider } from "@/contexts/ThemeContext";
import DestinationPickerPage from "@/pages/DestinationPickerPage";
import LandingPage from "@/pages/LandingPage";
import PreferencesPage from "@/pages/PreferencesPage";
import QuizPage from "@/pages/QuizPage";
import TripResult from "@/pages/TripResult";

type TripPage = "landing" | "quiz" | "preferences" | "destinations" | "result";

function TripPlanner() {
  const [page, setPage] = useState<TripPage>("landing");
  const [tripPlanId, setTripPlanId] = useState<number | null>(null);

  function resetFlow() {
    setPage("landing");
    setTripPlanId(null);
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }} className="min-h-screen">
      {page === "landing" && <LandingPage onStart={() => setPage("quiz")} />}

      {page === "quiz" && (
        <QuizPage
          onComplete={(id) => {
            setTripPlanId(id);
            setPage("preferences");
          }}
          onBack={resetFlow}
        />
      )}

      {page === "preferences" && tripPlanId !== null && (
        <PreferencesPage
          tripPlanId={tripPlanId}
          onComplete={(id, needsSuggestion) => {
            setTripPlanId(id);
            setPage(needsSuggestion ? "destinations" : "result");
          }}
          onBack={() => setPage("quiz")}
        />
      )}

      {page === "destinations" && tripPlanId !== null && (
        <DestinationPickerPage
          tripPlanId={tripPlanId}
          onComplete={() => setPage("result")}
          onBack={() => setPage("preferences")}
        />
      )}

      {page === "result" && (
        <TripResult
          onEdit={() => setPage("quiz")}
          onHome={resetFlow}
        />
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
