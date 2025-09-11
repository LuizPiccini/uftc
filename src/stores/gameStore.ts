import { create } from 'zustand';
import { Player, Vote, VotePair, EloUpdate } from '@/types/goat';
import { calculateElo } from '@/utils/elo';
import { supabase } from '@/integrations/supabase/client';

interface GameState {
  players: Player[];
  votes: Vote[];
  currentPair: VotePair | null;
  totalVotes: number;
  sessionVotes: number;
  recentVotes: string[]; // Store recent pair IDs to prevent duplicates
  isLoading: boolean;
  
  // Actions
  initializePlayers: () => Promise<void>;
  generatePair: () => Promise<VotePair>;
  castVote: (winnerId: string, loserId: string) => Promise<EloUpdate | null>;
  getLeaderboard: () => Player[];
  hasVotedRecently: (pairId: string) => boolean;
  loadPlayersFromDB: () => Promise<void>;
  loadVotesFromDB: () => Promise<void>;
}

const useGameStore = create<GameState>()((set, get) => ({
  players: [],
  votes: [],
  currentPair: null,
  totalVotes: 0,
  sessionVotes: 0,
  recentVotes: [],
  isLoading: false,

  loadPlayersFromDB: async () => {
    try {
      const { data: players, error } = await supabase
        .from('players')
        .select('*')
        .order('rating', { ascending: false });
      
      if (error) throw error;
      
      const formattedPlayers: Player[] = players?.map(p => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        rating: p.rating,
        exposureCount: p.exposure_count,
        winCount: p.win_count,
        lossCount: p.loss_count,
      })) || [];
      
      set({ players: formattedPlayers });
    } catch (error) {
      console.error('Error loading players:', error);
    }
  },

  loadVotesFromDB: async () => {
    try {
      const { data: votes, error } = await supabase
        .from('votes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const formattedVotes: Vote[] = votes?.map(v => ({
        pairId: v.pair_id,
        winnerId: v.winner_id,
        loserId: v.loser_id,
        timestamp: v.timestamp,
      })) || [];
      
      set({ 
        votes: formattedVotes,
        totalVotes: formattedVotes.length 
      });
    } catch (error) {
      console.error('Error loading votes:', error);
    }
  },

  initializePlayers: async () => {
    const state = get();
    if (state.players.length === 0) {
      await get().loadPlayersFromDB();
    }
  },

      generatePair: async () => {
        const { players, recentVotes } = get();
        
        if (players.length < 2) {
          await get().loadPlayersFromDB();
          const updatedPlayers = get().players;
          if (updatedPlayers.length < 2) {
            throw new Error('Not enough players');
          }
        }

        const currentPlayers = get().players;
        
        // Simple pair generation with some variety
        let playerA: Player, playerB: Player;
        let attempts = 0;
        const maxAttempts = 20;

        do {
          const shuffled = [...currentPlayers].sort(() => Math.random() - 0.5);
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

      castVote: async (winnerId: string, loserId: string) => {
        const { players, currentPair, votes, recentVotes } = get();
        
        if (!currentPair) return null;
        
        // Check for duplicate vote
        if (recentVotes.includes(currentPair.pairId)) {
          return null;
        }

        const winner = players.find(p => p.id === winnerId);
        const loser = players.find(p => p.id === loserId);
        
        if (!winner || !loser) return null;

        try {
          set({ isLoading: true });

          // Calculate Elo update
          const eloUpdate = calculateElo(winner, loser);
          
          // Update winner in database
          const { error: winnerError } = await supabase
            .from('players')
            .update({
              rating: eloUpdate.winnerNewRating,
              exposure_count: winner.exposureCount + 1,
              win_count: winner.winCount + 1,
            })
            .eq('id', winnerId);

          if (winnerError) throw winnerError;

          // Update loser in database
          const { error: loserError } = await supabase
            .from('players')
            .update({
              rating: eloUpdate.loserNewRating,
              exposure_count: loser.exposureCount + 1,
              loss_count: loser.lossCount + 1,
            })
            .eq('id', loserId);

          if (loserError) throw loserError;

          // Save vote to database
          const { error: voteError } = await supabase
            .from('votes')
            .insert({
              pair_id: currentPair.pairId,
              winner_id: winnerId,
              loser_id: loserId,
              timestamp: Date.now(),
            });

          if (voteError) throw voteError;

          // Update local state
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

          const vote: Vote = {
            pairId: currentPair.pairId,
            winnerId,
            loserId,
            timestamp: Date.now(),
          };

          const newRecentVotes = [currentPair.pairId, ...recentVotes].slice(0, 10);

          set({
            players: updatedPlayers,
            votes: [...votes, vote],
            totalVotes: votes.length + 1,
            sessionVotes: get().sessionVotes + 1,
            recentVotes: newRecentVotes,
            currentPair: null,
            isLoading: false,
          });

          return eloUpdate;
        } catch (error) {
          console.error('Error casting vote:', error);
          set({ isLoading: false });
          return null;
        }
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
    }));

export { useGameStore };
