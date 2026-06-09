export interface Destination {
  name: string;
  country: string;
  img: string;
}

// TODO: replace with API call — getDestinations()
export const destinations: Destination[] = [
  {
    name: "Tokyo",
    country: "Japan",
    img: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&h=400&fit=crop&q=80",
  },
  {
    name: "Santorini",
    country: "Greece",
    img: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=600&h=400&fit=crop&q=80",
  },
  {
    name: "Marrakech",
    country: "Morocco",
    img: "https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=600&h=400&fit=crop&q=80",
  },
  {
    name: "Kyoto",
    country: "Japan",
    img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&h=400&fit=crop&q=80",
  },
  {
    name: "Dubrovnik",
    country: "Croatia",
    img: "https://images.unsplash.com/photo-1555990793-da11153b2473?w=600&h=400&fit=crop&q=80",
  },
  {
    name: "Bali",
    country: "Indonesia",
    img: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&h=400&fit=crop&q=80",
  },
];
