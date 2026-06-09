export interface Activity {
  name: string;
  time: string;
  type: string;
  desc: string;
  img: string;
  duration: string;
}

export interface DayPlan {
  day: number;
  theme: string;
  activities: Activity[];
}

export interface TripStat {
  label: string;
  value: string;
}

export interface TripSummary {
  destination: string;
  duration: string;
  tags: string;
  stats: TripStat[];
}

export interface AlternativeDestination {
  destination: string;
  tagline: string;
  highlights: string[];
  budget: string;
  img: string;
  match: string;
}

// TODO: replace with API call — getItinerary(tripId)
export const tripSummary: TripSummary = {
  destination: "Tokyo, Japan",
  duration: "3 Days",
  tags: "Culture + Futurism + Food",
  stats: [
    { label: "Est. Budget", value: "$1,800 – $2,200" },
    { label: "Best Time", value: "March – May" },
    { label: "AI Match", value: "97%" },
  ],
};

// TODO: replace with API call — getItinerary(tripId)
export const itinerary: DayPlan[] = [
  {
    day: 1,
    theme: "Ancient Tokyo",
    activities: [
      {
        name: "Senso-ji Temple",
        time: "7:00 AM",
        type: "Culture",
        desc: "Begin your Tokyo journey at Japan's oldest temple in Asakusa. Arrive at dawn for a serene experience before the crowds.",
        img: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=600&h=350&fit=crop&q=80",
        duration: "2 hrs",
      },
      {
        name: "Tsukiji Outer Market",
        time: "10:00 AM",
        type: "Food",
        desc: "Sample fresh seafood, tamagoyaki, and street snacks at the world-famous fish market. Don't miss the tuna sashimi.",
        img: "https://images.unsplash.com/photo-1617358372862-6bd0e31faa5d?w=600&h=350&fit=crop&q=80",
        duration: "1.5 hrs",
      },
      {
        name: "Shibuya Crossing",
        time: "8:00 PM",
        type: "Iconic",
        desc: "Experience the world's busiest intersection at its most electric — thousands of pedestrians criss-crossing in perfect choreography.",
        img: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&h=350&fit=crop&q=80",
        duration: "1 hr",
      },
    ],
  },
  {
    day: 2,
    theme: "Nature & Serenity",
    activities: [
      {
        name: "Meiji Shrine",
        time: "9:00 AM",
        type: "Spiritual",
        desc: "Walk through towering torii gates into a tranquil forest in the heart of the city. One of Tokyo's most visited Shinto shrines.",
        img: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&h=350&fit=crop&q=80",
        duration: "1.5 hrs",
      },
      {
        name: "Harajuku & Takeshita Street",
        time: "11:00 AM",
        type: "Culture",
        desc: "Dive into Tokyo's wildly creative youth fashion scene. Try crepes, browse vintage shops, and soak in the kaleidoscopic street style.",
        img: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600&h=350&fit=crop&q=80",
        duration: "2 hrs",
      },
      {
        name: "Shinjuku Gyoen Garden",
        time: "3:00 PM",
        type: "Nature",
        desc: "One of Japan's most beautiful national gardens — a perfect afternoon escape with French, English, and Japanese garden sections.",
        img: "https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?w=600&h=350&fit=crop&q=80",
        duration: "2 hrs",
      },
    ],
  },
  {
    day: 3,
    theme: "Futuristic Tokyo",
    activities: [
      {
        name: "teamLab Planets",
        time: "10:00 AM",
        type: "Art",
        desc: "Walk through immersive, ever-shifting digital art installations — one of the world's most remarkable art experiences.",
        img: "https://images.unsplash.com/photo-1548407260-da850faa41e3?w=600&h=350&fit=crop&q=80",
        duration: "2 hrs",
      },
      {
        name: "Odaiba Island",
        time: "1:00 PM",
        type: "Tech",
        desc: "Explore this futuristic artificial island — home to Teamlab, the Gundam statue, DiverCity, and sweeping views of Rainbow Bridge.",
        img: "https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=600&h=350&fit=crop&q=80",
        duration: "3 hrs",
      },
      {
        name: "Tokyo Tower at Sunset",
        time: "5:30 PM",
        type: "Iconic",
        desc: "Ride to the observation deck as the sun dips below the horizon, bathing the city in golden light. Spectacular 360° views.",
        img: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=600&h=350&fit=crop&q=80",
        duration: "1.5 hrs",
      },
    ],
  },
];

// TODO: replace with API call — getAlternatives(tripId)
export const alternatives: AlternativeDestination[] = [
  {
    destination: "Osaka, Japan",
    tagline: "Street food capital of Japan",
    highlights: ["Dotonbori", "Osaka Castle", "Namba Night Markets"],
    budget: "Similar budget",
    img: "https://images.unsplash.com/photo-1590559899731-a382839e5549?w=400&h=240&fit=crop&q=80",
    match: "94%",
  },
  {
    destination: "Seoul, South Korea",
    tagline: "K-culture meets ancient tradition",
    highlights: ["Gyeongbokgung Palace", "Gangnam District", "Myeongdong"],
    budget: "+$200 est.",
    img: "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=400&h=240&fit=crop&q=80",
    match: "91%",
  },
  {
    destination: "Kyoto, Japan",
    tagline: "Where ancient Japan lives on",
    highlights: ["Fushimi Inari", "Arashiyama Bamboo", "Gion District"],
    budget: "Similar budget",
    img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&h=240&fit=crop&q=80",
    match: "89%",
  },
];
