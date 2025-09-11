import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Player, Vote, VotePair, EloUpdate } from '@/types/goat';
import { initialPlayers } from '@/data/players';
import { calculateElo } from '@/utils/elo';

interface GameState {
  players: Player[];
  votes: Vote[];
  currentPair: VotePair | null;
  totalVotes: number;
  sessionVotes: number;
  recentVotes: string[]; // Store recent pair IDs to prevent duplicates
  
  // Actions
  initializePlayers: () => void;
  generatePair: () => VotePair;
  castVote: (winnerId: string, loserId: string) => EloUpdate | null;
  getLeaderboard: () => Player[];
  hasVotedRecently: (pairId: string) => boolean;
}

const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      players: [],
      votes: [],
      currentPair: null,
      totalVotes: 0,
      sessionVotes: 0,
      recentVotes: [],

      initializePlayers: () => {
        const state = get();
        if (state.players.length === 0) {
          const playersWithIds = initialPlayers.map((player, index) => ({
            ...player,
            id: `player-${index + 1}`,
          }));
          set({ players: playersWithIds });
        }
      },

      generatePair: () => {
        const { players, recentVotes } = get();
        
        if (players.length < 2) {
          throw new Error('Not enough players');
        }

        // Simple pair generation with some variety
        let playerA: Player, playerB: Player;
        let attempts = 0;
        const maxAttempts = 20;

        do {
          const shuffled = [...players].sort(() => Math.random() - 0.5);
          playerA = shuffled[0];
          playerB = shuffled[1];
          attempts++;
        } while (
          attempts < maxAttempts && 
          (playerA.id === playerB.id || 
           recentVotes.includes(`${playerA.id}-${playerB.id}`) ||
           recentVotes.includes(`${playerB.id}-${playerA.id}`))
        );

        const pairId = `${playerA.id}-${playerB.id}-${Date.now()}`;
        const pair: VotePair = { pairId, playerA, playerB };
        
        set({ currentPair: pair });
        return pair;
      },

      castVote: (winnerId: string, loserId: string) => {
        const { players, currentPair, votes, recentVotes } = get();
        
        if (!currentPair) return null;
        
        // Check for duplicate vote
        if (recentVotes.includes(currentPair.pairId)) {
          return null;
        }

        const winner = players.find(p => p.id === winnerId);
        const loser = players.find(p => p.id === loserId);
        
        if (!winner || !loser) return null;

        // Calculate Elo update
        const eloUpdate = calculateElo(winner, loser);
        
        // Update players
        const updatedPlayers = players.map(player => {
          if (player.id === winnerId) {
            return {
              ...player,
              rating: eloUpdate.winnerNewRating,
              exposureCount: player.exposureCount + 1,
              winCount: player.winCount + 1,
            };
          }
          if (player.id === loserId) {
            return {
              ...player,
              rating: eloUpdate.loserNewRating,
              exposureCount: player.exposureCount + 1,
              lossCount: player.lossCount + 1,
            };
          }
          return player;
        });

        // Create vote record
        const vote: Vote = {
          pairId: currentPair.pairId,
          winnerId,
          loserId,
          timestamp: Date.now(),
        };

        // Update recent votes (keep last 10)
        const newRecentVotes = [currentPair.pairId, ...recentVotes].slice(0, 10);

        set({
          players: updatedPlayers,
          votes: [...votes, vote],
          totalVotes: votes.length + 1,
          sessionVotes: get().sessionVotes + 1,
          recentVotes: newRecentVotes,
          currentPair: null,
        });

        return eloUpdate;
      },

      getLeaderboard: () => {
        const { players } = get();
        return [...players]
          .sort((a, b) => b.rating - a.rating)
          .map((player, index) => ({ ...player, rank: index + 1 }));
      },

      hasVotedRecently: (pairId: string) => {
        const { recentVotes } = get();
        return recentVotes.includes(pairId);
      },
    }),
    {
      name: 'goat-arena-storage',
      partialize: (state) => ({
        players: state.players,
        votes: state.votes,
        totalVotes: state.totalVotes,
        recentVotes: state.recentVotes,
      }),
    }
  )
);

export { useGameStore };
