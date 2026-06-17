import { useEffect, useState } from "react";

import { ThemeProvider } from "@/contexts/ThemeContext";
import DestinationPickerPage from "@/pages/DestinationPickerPage";
import LandingPage from "@/pages/LandingPage";
import MyTripsPage from "@/pages/MyTripsPage";
import PreferencesPage from "@/pages/PreferencesPage";
import QuizPage from "@/pages/QuizPage";
import TripResult from "@/pages/TripResult";
import { clearLastTripId, loadLastPage, loadLastTripId, saveLastPage, saveLastTripId } from "@/lib/trips";

type TripPage = "landing" | "quiz" | "preferences" | "destinations" | "result" | "my-trips";

function TripPlanner() {
  const [page, setPage] = useState<TripPage>("landing");
  const [tripPlanId, setTripPlanId] = useState<number | null>(null);
  useEffect(() => {
    const savedId = loadLastTripId();
    const savedPage = loadLastPage();
    if (savedId !== null) {
      setTripPlanId(savedId);
      if (savedPage === "result") {
        setPage("result");
      }
    }
  }, []);

  function resetFlow() {
    setPage("landing");
    setTripPlanId(null);
    clearLastTripId();
  }

  function goToResult(id: number) {
    setTripPlanId(id);
    saveLastTripId(id);
    saveLastPage("result");
    setPage("result");
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }} className="min-h-screen">
      {page === "landing" && (
        <LandingPage
          onStart={() => setPage("quiz")}
          onMyTrips={() => setPage("my-trips")}
        />
      )}

      {page === "my-trips" && (
        <MyTripsPage
          onSelectTrip={goToResult}
          onNewTrip={() => setPage("quiz")}
          onHome={resetFlow}
          onTripDeleted={(id) => {
            if (tripPlanId === id) {
              setTripPlanId(null);
              clearLastTripId();
            }
          }}
        />
      )}

      {page === "quiz" && (
        <QuizPage
          onComplete={(id) => {
            setTripPlanId(id);
            saveLastTripId(id);
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
            saveLastTripId(id);
            if (needsSuggestion) {
              setPage("destinations");
            } else {
              goToResult(id);
            }
          }}
          onBack={() => setPage("quiz")}
        />
      )}

      {page === "destinations" && tripPlanId !== null && (
        <DestinationPickerPage
          tripPlanId={tripPlanId}
          onComplete={() => goToResult(tripPlanId)}
          onBack={() => setPage("preferences")}
        />
      )}

      {page === "result" && tripPlanId !== null && (
        <TripResult
          tripPlanId={tripPlanId}
          onHome={resetFlow}
          onMyTrips={() => setPage("my-trips")}
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
