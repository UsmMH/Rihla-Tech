export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  time: string;
}

// TODO: replace with API call — getChatHistory(tripId)
export const initialMessages: ChatMessage[] = [
  {
    id: 1,
    role: "assistant",
    content:
      "Hi! I'm your RihlaTech AI travel companion. I've built your Tokyo itinerary — ask me anything about it, or tell me what you'd like to change.",
    time: "10:32 AM",
  },
  {
    id: 2,
    role: "user",
    content: "What's the best time to visit Senso-ji Temple to avoid crowds?",
    time: "10:33 AM",
  },
  {
    id: 3,
    role: "assistant",
    content:
      "Great question! Senso-ji is best visited early morning — ideally before 8 AM. The temple opens at 6 AM and the first hour is serene and nearly crowd-free. By 9 AM tour groups start arriving. I've already scheduled it as your Day 1 morning activity. ✓",
    time: "10:33 AM",
  },
  {
    id: 4,
    role: "user",
    content: "Can you add a day trip to Mount Fuji?",
    time: "10:35 AM",
  },
  {
    id: 5,
    role: "assistant",
    content:
      "Absolutely! I can add a Fuji Five Lakes day trip — it's about 2 hours from Shinjuku by direct bus. Would you like it on Day 4 (replacing the Odaiba afternoon), or should I extend your trip by one day? The views from Lake Kawaguchiko are stunning in spring.",
    time: "10:35 AM",
  },
];
