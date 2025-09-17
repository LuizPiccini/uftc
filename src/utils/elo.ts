import { Player, EloUpdate } from "@/types/goat";

const K_FACTOR = 24;
const BASE_K = 16;

export function calculateElo(winner: Player, loser: Player): EloUpdate {
  // Calculate K-factor with decay based on exposure - FIXED: use Math.min instead of Math.max
  const winnerK = Math.min(K_FACTOR, Math.max(BASE_K, K_FACTOR - Math.floor(winner.exposureCount / 50)));
  const loserK = Math.min(K_FACTOR, Math.max(BASE_K, K_FACTOR - Math.floor(loser.exposureCount / 50)));

  // Calculate expected scores
  const expectedWinner = 1 / (1 + Math.pow(10, (loser.rating - winner.rating) / 400));
  const expectedLoser = 1 - expectedWinner;

  // Calculate new ratings
  const winnerRatingChange = winnerK * (1 - expectedWinner);
  const loserRatingChange = loserK * (0 - expectedLoser);

  const winnerNewRating = Math.round(winner.rating + winnerRatingChange);
  const loserNewRating = Math.round(loser.rating + loserRatingChange);

  return {
    winnerId: winner.id,
    loserId: loser.id,
    winnerNewRating,
    loserNewRating,
    winnerRatingChange: Math.round(winnerRatingChange),
    loserRatingChange: Math.round(loserRatingChange),
  };
}

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