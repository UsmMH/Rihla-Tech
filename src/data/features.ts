export interface Feature {
  id: string;
  title: string;
  description: string;
}

// TODO: replace with API call — getFeatures()
export const features: Feature[] = [
  {
    id: "ai-planning",
    title: "AI Trip Planning",
    description:
      "Tell us where you want to go and let our AI craft a complete, personalized itinerary — from hidden gems to iconic landmarks — in seconds.",
  },
  {
    id: "personalized",
    title: "Personalized Preferences",
    description:
      "Budget traveler or luxury seeker? Adventure junkie or culture enthusiast? RihlaTech learns your style and tailors every recommendation.",
  },
  {
    id: "chatbot",
    title: "Smart Chatbot",
    description:
      "Need to change your plans mid-trip? Our AI chatbot is available 24/7 to reroute, suggest alternatives, or answer any travel question.",
  },
];
