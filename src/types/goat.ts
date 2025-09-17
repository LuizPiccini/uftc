export interface Player {
  id: string;
  name: string;
  emoji: string;
  profileImageUrl?: string;
  rating: number;
  ratingDeviation: number;
  volatility: number;
  exposureCount: number;
  winCount: number;
  lossCount: number;
}

export interface Topic {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface VotePair {
  pairId: string;
  playerA: Player;
  playerB: Player;
}

export interface Vote {
  pairId: string;
  winnerId: string;
  loserId: string;
  timestamp: number;
}

export interface RatingUpdate {
  winnerId: string;
  loserId: string;
  winnerNewRating: number;
  loserNewRating: number;
  winnerRatingChange: number;
  loserRatingChange: number;
  winnerNewRatingDeviation: number;
  loserNewRatingDeviation: number;
  winnerNewVolatility: number;
  loserNewVolatility: number;
  winnerOldRank?: number;
  winnerNewRank?: number;
  loserOldRank?: number;
  loserNewRank?: number;
}