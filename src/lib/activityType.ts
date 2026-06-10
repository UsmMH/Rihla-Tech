import type { LucideIcon } from "lucide-react";
import {
  Camera,
  Landmark,
  Moon,
  Mountain,
  Palmtree,
  ShoppingBag,
  Sparkles,
  Trees,
  Utensils,
} from "lucide-react";

export type ActivityTypeStyle = {
  icon: LucideIcon;
  gradient: string;
  accent: string;
};

const DEFAULT_STYLE: ActivityTypeStyle = {
  icon: Sparkles,
  gradient: "linear-gradient(135deg, #1e4b88 0%, #58abd4 100%)",
  accent: "#58ABD4",
};

const TYPE_STYLES: Record<string, ActivityTypeStyle> = {
  Culture: {
    icon: Landmark,
    gradient: "linear-gradient(135deg, #4a3f8c 0%, #7b6fd6 100%)",
    accent: "#9B8CFF",
  },
  Food: {
    icon: Utensils,
    gradient: "linear-gradient(135deg, #8b4513 0%, #e8a04a 100%)",
    accent: "#FFB74D",
  },
  Nature: {
    icon: Trees,
    gradient: "linear-gradient(135deg, #1b5e3a 0%, #4caf50 100%)",
    accent: "#4CAF50",
  },
  Adventure: {
    icon: Mountain,
    gradient: "linear-gradient(135deg, #b84a00 0%, #ff8a50 100%)",
    accent: "#FF8A50",
  },
  Relaxation: {
    icon: Palmtree,
    gradient: "linear-gradient(135deg, #0d6b6b 0%, #4ecdc4 100%)",
    accent: "#4ECDC4",
  },
  Shopping: {
    icon: ShoppingBag,
    gradient: "linear-gradient(135deg, #6b2d5c 0%, #ce93d8 100%)",
    accent: "#CE93D8",
  },
  Nightlife: {
    icon: Moon,
    gradient: "linear-gradient(135deg, #1a1a4e 0%, #5c6bc0 100%)",
    accent: "#7986CB",
  },
  Scenic: {
    icon: Camera,
    gradient: "linear-gradient(135deg, #0d47a1 0%, #42a5f5 100%)",
    accent: "#42A5F5",
  },
};

export function getActivityTypeStyle(type: string): ActivityTypeStyle {
  const key = Object.keys(TYPE_STYLES).find((k) => k.toLowerCase() === type.toLowerCase());
  return key ? TYPE_STYLES[key] : DEFAULT_STYLE;
}

export const DAY_PIN_COLORS = ["#58ABD4", "#4CAF50", "#FFB74D", "#CE93D8", "#F06292", "#80CBC4", "#FFD54F"];

export function dayPinColor(dayNumber: number): string {
  return DAY_PIN_COLORS[(dayNumber - 1) % DAY_PIN_COLORS.length];
}
