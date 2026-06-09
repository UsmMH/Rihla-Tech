export interface QuizOption {
  id: string;
  label: string;
  icon: string;
  desc: string;
}

export interface QuizStep {
  id: number;
  title: string;
  subtitle: string;
  multi?: boolean;
  options: QuizOption[];
}

// TODO: replace with API call — getQuizSteps()
export const quizSteps: QuizStep[] = [
  {
    id: 1,
    title: "What's your travel style?",
    subtitle: "Pick the one that feels most like you.",
    options: [
      { id: "adventure", label: "Adventure Seeker", icon: "🏔️", desc: "Hiking, diving, and off-the-beaten-path" },
      { id: "culture", label: "Culture Explorer", icon: "🏛️", desc: "Museums, history, and local traditions" },
      { id: "relaxation", label: "Rest & Recharge", icon: "🌴", desc: "Beaches, spas, and slow mornings" },
      { id: "food", label: "Foodie Traveler", icon: "🍜", desc: "Street food, fine dining, and local markets" },
      { id: "luxury", label: "Luxury Enthusiast", icon: "✨", desc: "5-star stays, private tours, and exclusivity" },
      { id: "budget", label: "Budget Explorer", icon: "🎒", desc: "Hostels, local transit, and hidden gems" },
    ],
  },
  {
    id: 2,
    title: "What's your budget range?",
    subtitle: "Per person, for the full trip.",
    options: [
      { id: "b1", label: "Under $500", icon: "💸", desc: "Backpacker-friendly" },
      { id: "b2", label: "$500 – $1,500", icon: "💵", desc: "Comfortable mid-range" },
      { id: "b3", label: "$1,500 – $3,000", icon: "💳", desc: "Premium experience" },
      { id: "b4", label: "$3,000 – $6,000", icon: "💎", desc: "Luxury getaway" },
      { id: "b5", label: "$6,000+", icon: "🏆", desc: "No-limit adventure" },
    ],
  },
  {
    id: 3,
    title: "How long is your trip?",
    subtitle: "We'll plan the perfect number of activities.",
    options: [
      { id: "d1", label: "Weekend (2–3 days)", icon: "⚡", desc: "Quick escape" },
      { id: "d2", label: "Short Trip (4–6 days)", icon: "📅", desc: "Perfect for a week off" },
      { id: "d3", label: "One Week (7 days)", icon: "🗓️", desc: "The classic holiday" },
      { id: "d4", label: "Two Weeks (14 days)", icon: "🌍", desc: "Deep dive into a destination" },
      { id: "d5", label: "Extended (3+ weeks)", icon: "✈️", desc: "Long-term travel or sabbatical" },
    ],
  },
  {
    id: 4,
    title: "What interests you most?",
    subtitle: "Select all that apply.",
    multi: true,
    options: [
      { id: "i1", label: "Temples & Shrines", icon: "⛩️", desc: "" },
      { id: "i2", label: "Art & Design", icon: "🎨", desc: "" },
      { id: "i3", label: "Night Markets", icon: "🏮", desc: "" },
      { id: "i4", label: "Street Food", icon: "🍡", desc: "" },
      { id: "i5", label: "Nature & Parks", icon: "🌿", desc: "" },
      { id: "i6", label: "Tech & Futurism", icon: "🤖", desc: "" },
      { id: "i7", label: "Shopping", icon: "🛍️", desc: "" },
      { id: "i8", label: "Anime & Pop Culture", icon: "🌸", desc: "" },
    ],
  },
];
