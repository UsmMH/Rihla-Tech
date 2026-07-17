import { useState } from "react";

import { ThemeProvider } from "@/contexts/ThemeContext";
import AdminPage from "@/pages/AdminPage";
import AppDashboardPage from "@/pages/AppDashboardPage";
import CommunityPage from "@/pages/CommunityPage";
import CommunityTripPage from "@/pages/CommunityTripPage";
import DestinationPickerPage from "@/pages/DestinationPickerPage";
import LandingPage from "@/pages/LandingPage";
import MyTripsPage from "@/pages/MyTripsPage";
import PreferencesPage from "@/pages/PreferencesPage";
import ProfilePage from "@/pages/ProfilePage";
import QuizPage from "@/pages/QuizPage";
import TripResult from "@/pages/TripResult";
import type { TripPlan } from "@/lib/quiz";
import type { AppTab } from "@/lib/navigation";
import { clearLastPage, clearLastTripId, saveLastTripId } from "@/lib/trips";

type TripPage =
  | "home"
  | "profile"
  | "admin"
  | "community"
  | "community-trip"
  | "welcome"
  | "quiz"
  | "preferences"
  | "destinations"
  | "result"
  | "my-trips";

function tabToPage(tab: AppTab): TripPage {
  if (tab === "home") return "home";
  if (tab === "my-trips") return "my-trips";
  if (tab === "community") return "community";
  return "profile";
}

function TripPlanner() {
  const [page, setPage] = useState<TripPage>("home");
  const [tripPlanId, setTripPlanId] = useState<number | null>(null);
  const [pendingTripPlan, setPendingTripPlan] = useState<TripPlan | null>(null);
  const [communityTripId, setCommunityTripId] = useState<number | null>(null);

  function goToAppHome() {
    clearLastPage();
    setPage("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleNavigate(tab: AppTab) {
    setPage(tabToPage(tab));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetFlow() {
    goToAppHome();
    setTripPlanId(null);
    clearLastTripId();
  }

  function goToResult(id: number) {
    setTripPlanId(id);
    saveLastTripId(id);
    setPage("result");
  }

  function startNewTrip() {
    setTripPlanId(null);
    setPendingTripPlan(null);
    clearLastTripId();
    setPage("quiz");
  }

  function openTrip(id: number) {
    setTripPlanId(id);
    saveLastTripId(id);
    setPage("result");
  }

  function openCommunityTrip(id: number) {
    setCommunityTripId(id);
    setPage("community-trip");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }} className="min-h-screen">
      {page === "home" && (
        <AppDashboardPage
          onNavigate={handleNavigate}
          onPlanTrip={startNewTrip}
          onOpenTrip={openTrip}
        />
      )}

      {page === "profile" && (
        <ProfilePage
          onNavigate={handleNavigate}
          onOpenAdmin={() => setPage("admin")}
        />
      )}

      {page === "admin" && (
        <AdminPage onNavigate={handleNavigate} onBack={() => setPage("profile")} />
      )}

      {page === "community" && (
        <CommunityPage onNavigate={handleNavigate} onOpenTrip={openCommunityTrip} />
      )}

      {page === "community-trip" && communityTripId !== null && (
        <CommunityTripPage
          tripPlanId={communityTripId}
          onBack={() => {
            setCommunityTripId(null);
            setPage("community");
          }}
          onNavigate={handleNavigate}
        />
      )}

      {page === "welcome" && (
        <LandingPage
          onStart={startNewTrip}
          onMyTrips={() => setPage("my-trips")}
        />
      )}

      {page === "my-trips" && (
        <MyTripsPage
          onSelectTrip={goToResult}
          onNewTrip={startNewTrip}
          onHome={goToAppHome}
          onNavigate={handleNavigate}
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
          onComplete={(id, tripPlan) => {
            setTripPlanId(id);
            setPendingTripPlan(tripPlan);
            saveLastTripId(id);
            setPage("preferences");
          }}
          onBack={goToAppHome}
          onNavigate={handleNavigate}
        />
      )}

      {page === "preferences" && tripPlanId !== null && (
        <PreferencesPage
          tripPlanId={tripPlanId}
          needsDestinationPicker={
            pendingTripPlan ? !pendingTripPlan.destination_known && !pendingTripPlan.destination : false
          }
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
          onNavigate={handleNavigate}
        />
      )}

      {page === "destinations" && tripPlanId !== null && (
        <DestinationPickerPage
          tripPlanId={tripPlanId}
          onComplete={() => goToResult(tripPlanId)}
          onBack={() => setPage("preferences")}
          onNavigate={handleNavigate}
        />
      )}

      {page === "result" && tripPlanId !== null && (
        <TripResult
          tripPlanId={tripPlanId}
          onBack={() => setPage("my-trips")}
          onNavigate={handleNavigate}
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
