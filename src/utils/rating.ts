export function getRatingColor(rating: number): string {
  if (rating >= 1800) return "text-gold";
  if (rating >= 1650) return "text-orange";
  if (rating >= 1500) return "text-electric-blue";
  if (rating >= 1350) return "text-green";
  return "text-muted-foreground";
}

export function getRankEmoji(rank: number): string {
  switch (rank) {
    case 1: return "🥇";
    case 2: return "🥈";
    case 3: return "🥉";
    default: return `#${rank}`;
  }
}