export interface Player {
  id: string;
  name: string;
  emoji: string;
  rating: number;
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

export interface EloUpdate {
  winnerId: string;
  loserId: string;
  winnerNewRating: number;
  loserNewRating: number;
  winnerRatingChange: number;
  loserRatingChange: number;
}