export interface IcebreakerQuestion {
  id: string;
  category: "Food & Drink" | "Weekend Vibe" | "Fun & Debates" | "Travel & Adventures" | "Music & Culture" | "Hobbies & Games";
  emoji: string;
  question: string;
}

export const LIGHTHEARTED_ICEBREAKERS: IcebreakerQuestion[] = [
  {
    id: "food-1",
    category: "Food & Drink",
    emoji: "🍕",
    question: "Controversial food opinion: what popular food trend needs to retire immediately?",
  },
  {
    id: "food-2",
    category: "Food & Drink",
    emoji: "☕",
    question: "What's the best hidden gem cafe, bakery, or restaurant you've discovered lately?",
  },
  {
    id: "food-3",
    category: "Food & Drink",
    emoji: "🌮",
    question: "If you could only eat one for the rest of your life: endless tacos, artisan pizza, or brunch specials?",
  },
  {
    id: "food-4",
    category: "Food & Drink",
    emoji: "🍳",
    question: "Are you someone who follows a recipe down to the gram, or strictly a 'cook from the heart' improvisor?",
  },
  {
    id: "food-5",
    category: "Food & Drink",
    emoji: "🍦",
    question: "What's your ultimate comfort food order after an exhausting week?",
  },
  {
    id: "food-6",
    category: "Food & Drink",
    emoji: "🥐",
    question: "Morning coffee ritual: classic black, fancy oat latte, or are you secretly on team matcha/tea?",
  },
  {
    id: "weekend-1",
    category: "Weekend Vibe",
    emoji: "☀️",
    question: "If you had an entire Saturday with zero plans and zero obligations, what does your ideal day look like?",
  },
  {
    id: "weekend-2",
    category: "Weekend Vibe",
    emoji: "🧺",
    question: "If you're putting together the ultimate park picnic, what three essential items must be packed?",
  },
  {
    id: "weekend-3",
    category: "Weekend Vibe",
    emoji: "🌿",
    question: "Are you more of an early bird catching morning sunlight or a night owl thriving past 11 PM?",
  },
  {
    id: "weekend-4",
    category: "Weekend Vibe",
    emoji: "🛋️",
    question: "What's your favorite way to recharge: a cozy evening at home or heading out to explore a new spot?",
  },
  {
    id: "weekend-5",
    category: "Weekend Vibe",
    emoji: "🚲",
    question: "What's your go-to spot in the city for people-watching, strolling, or catching fresh air?",
  },
  {
    id: "fun-1",
    category: "Fun & Debates",
    emoji: "🍍",
    question: "Pineapple on pizza: bold culinary masterpiece or an unforgivable crime?",
  },
  {
    id: "fun-2",
    category: "Fun & Debates",
    emoji: "🍿",
    question: "What movie or TV show can you rewatch an unhealthy number of times without getting bored?",
  },
  {
    id: "fun-3",
    category: "Fun & Debates",
    emoji: "🧠",
    question: "What's a completely useless or niche fact you know that always amuses people?",
  },
  {
    id: "fun-4",
    category: "Fun & Debates",
    emoji: "🛒",
    question: "What's something you bought recently that was relatively cheap but 100% worth every single penny?",
  },
  {
    id: "fun-5",
    category: "Fun & Debates",
    emoji: "🎤",
    question: "If you were suddenly pushed onto a Karaoke stage right now, what song are you performing with confidence?",
  },
  {
    id: "fun-6",
    category: "Fun & Debates",
    emoji: "🤔",
    question: "What's an everyday minor inconvenience that mildly infuriates you more than it reasonably should?",
  },
  {
    id: "travel-1",
    category: "Travel & Adventures",
    emoji: "✈️",
    question: "Airport habits: are you arriving 3 hours early at the gate, or casually speed-walking through security?",
  },
  {
    id: "travel-2",
    category: "Travel & Adventures",
    emoji: "🗺️",
    question: "What's one destination currently sitting at the absolute very top of your travel bucket list?",
  },
  {
    id: "travel-3",
    category: "Travel & Adventures",
    emoji: "🚗",
    question: "What's the best spontaneous road trip or weekend getaway you've ever taken?",
  },
  {
    id: "travel-4",
    category: "Travel & Adventures",
    emoji: "🏖️",
    question: "When traveling, do you plan an hour-by-hour itinerary or do you just wander until you find cool spots?",
  },
  {
    id: "travel-5",
    category: "Travel & Adventures",
    emoji: "🎒",
    question: "What's the one item you never travel without, no matter how short the trip is?",
  },
  {
    id: "music-1",
    category: "Music & Culture",
    emoji: "🎵",
    question: "What was the very first concert you ever went to, and does your current music taste still resemble it?",
  },
  {
    id: "music-2",
    category: "Music & Culture",
    emoji: "🎧",
    question: "What song, artist, or podcast has been playing on heavy repeat for you lately?",
  },
  {
    id: "music-3",
    category: "Music & Culture",
    emoji: "🎸",
    question: "What's the best live performance or concert experience you've ever had in your life?",
  },
  {
    id: "music-4",
    category: "Music & Culture",
    emoji: "📺",
    question: "What's the best show you've binged recently that you would recommend to anyone without hesitation?",
  },
  {
    id: "hobbies-1",
    category: "Hobbies & Games",
    emoji: "🎲",
    question: "What board game, card game, or trivia category brings out your secretly ruthless competitive side?",
  },
  {
    id: "hobbies-2",
    category: "Hobbies & Games",
    emoji: "🎨",
    question: "What's a hobby, skill, or sport you've been secretly wanting to try out recently?",
  },
  {
    id: "hobbies-3",
    category: "Hobbies & Games",
    emoji: "📚",
    question: "What's the best book, thrift store gem, or vintage market find you've ever discovered?",
  },
  {
    id: "hobbies-4",
    category: "Hobbies & Games",
    emoji: "🎳",
    question: "For a casual group hangout: bowling, arcade bar, board game cafe, or a sunset outdoor walk?",
  },
];

export function getRandomIcebreaker(excludeId?: string): IcebreakerQuestion {
  const pool = excludeId
    ? LIGHTHEARTED_ICEBREAKERS.filter((item) => item.id !== excludeId)
    : LIGHTHEARTED_ICEBREAKERS;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}
