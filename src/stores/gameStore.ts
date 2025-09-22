import { create } from 'zustand';
import { Player, Vote, VotePair, RatingUpdate } from '@/types/goat';
import { supabase } from '@/integrations/supabase/client';
import { resolveProfileImageUrl } from '@/utils/profileImage';
import { recalculateAllGlickoRatings, type RecalculationResult } from './glickoRecalculation';

const MAX_PAIR_GENERATION_ATTEMPTS = 50;

const selectWeightedRandomPlayer = (
  players: Player[],
  excludedIds: Set<string> = new Set()
): Player | null => {
  const availablePlayers = players.filter((player) => !excludedIds.has(player.id));

  if (availablePlayers.length === 0) {
    return null;
  }

  const maxExposure = players.length
    ? Math.max(...players.map((player) => player.exposureCount))
    : 0;

  const weights = availablePlayers.map((player) => {
    const exposureOffset = maxExposure - player.exposureCount + 1;
    return Math.max(exposureOffset, 1);
  });

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let randomValue = Math.random() * totalWeight;

  for (let index = 0; index < availablePlayers.length; index++) {
    randomValue -= weights[index];
    if (randomValue <= 0) {
      return availablePlayers[index];
    }
  }

  return availablePlayers[availablePlayers.length - 1];
};

interface GameState {
  players: Player[];
  votes: Vote[];
  currentPair: VotePair | null;
  pairQueue: VotePair[]; // Pre-fetched pairs queue
  totalVotes: number;
  sessionVotes: number;
  recentVotes: string[]; // Store recent pair IDs to prevent duplicates
  isLoading: boolean;
  
  // Actions
  initializePlayers: () => Promise<void>;
  generatePair: () => Promise<VotePair>;
  generateMultiplePairs: (count: number) => VotePair[];
  fillPairQueue: () => void;
  castVote: (winnerId: string, loserId: string) => Promise<RatingUpdate | null>;
  getLeaderboard: () => Player[];
  hasVotedRecently: (pairId: string) => boolean;
  loadPlayersFromDB: () => Promise<void>;
  loadVotesFromDB: () => Promise<void>;
  recalculateAllRatings: () => Promise<RecalculationResult[]>;
}

const useGameStore = create<GameState>()((set, get) => ({
  players: [],
  votes: [],
  currentPair: null,
  pairQueue: [],
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
      
      const formattedPlayers: Player[] =
        players?.map((p) => {

          const profileUrl = resolveProfileImageUrl(p.profile_image_url);

          return {
            id: p.id,
            name: p.name,
            emoji: p.emoji,
            profileImageUrl: profileUrl,
            rating: p.rating,
            ratingDeviation: p.rating_deviation,
            volatility: p.volatility,
            exposureCount: p.exposure_count,
            winCount: p.win_count,
            lossCount: p.loss_count,
          };
        }) || [];
      
      set({ players: formattedPlayers });
    } catch (error) {
      console.error('Error loading players:', error);
    }
  },

  loadVotesFromDB: async () => {
    try {
      // Get all votes without pagination limits
      let allVotes: any[] = [];
      let from = 0;
      const limit = 1000;
      
      while (true) {
        const { data: votes, error } = await supabase
          .from('votes')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + limit - 1);
        
        if (error) throw error;
        
        if (!votes || votes.length === 0) break;
        
        allVotes = [...allVotes, ...votes];
        
        if (votes.length < limit) break;
        
        from += limit;
      }
      
      const formattedVotes: Vote[] = allVotes.map(v => ({
        pairId: v.pair_id,
        winnerId: v.winner_id,
        loserId: v.loser_id,
        timestamp: v.timestamp,
      }));
      
      console.log(`Loaded ${formattedVotes.length} total votes from database`);
      
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
      // Pre-fill the queue after loading players
      setTimeout(() => get().fillPairQueue(), 0);
    }
  },

  generateMultiplePairs: (count: number) => {
    const { players, recentVotes } = get();

    if (players.length < 2) {
      return [];
    }

    const pairs: VotePair[] = [];
    const usedPairIds = new Set([...recentVotes]);

    for (let index = 0; index < count; index++) {
      let attempts = 0;
      let pairGenerated = false;

      while (attempts < MAX_PAIR_GENERATION_ATTEMPTS) {
        attempts++;

        const playerA = selectWeightedRandomPlayer(players);
        if (!playerA) {
          break;
        }

        const playerB = selectWeightedRandomPlayer(players, new Set([playerA.id]));
        if (!playerB) {
          break;
        }

        const pairId = `${playerA.id}-${playerB.id}`;
        const reversePairId = `${playerB.id}-${playerA.id}`;

        if (usedPairIds.has(pairId) || usedPairIds.has(reversePairId)) {
          continue;
        }

        const fullPairId = `${pairId}-${Date.now()}-${index}`;
        const pair: VotePair = { pairId: fullPairId, playerA, playerB };

        pairs.push(pair);
        usedPairIds.add(pairId);
        usedPairIds.add(reversePairId);

        pairGenerated = true;
        break;
      }

      if (!pairGenerated) {
        break;
      }
    }

    return pairs;
  },

      fillPairQueue: () => {
        const { pairQueue } = get();
        const targetQueueSize = 5;
        const needed = targetQueueSize - pairQueue.length;
        
        if (needed > 0) {
          const newPairs = get().generateMultiplePairs(needed);
          set({ pairQueue: [...pairQueue, ...newPairs] });
        }
      },

      generatePair: async () => {
        const { pairQueue, players } = get();
        
        if (players.length < 2) {
          await get().loadPlayersFromDB();
          const updatedPlayers = get().players;
          if (updatedPlayers.length < 2) {
            throw new Error('Not enough players');
          }
        }

        let pair: VotePair;
        
        // Use from queue if available
        if (pairQueue.length > 0) {
          pair = pairQueue[0];
          set({ 
            currentPair: pair, 
            pairQueue: pairQueue.slice(1) 
          });
          
          // Refill queue in background
          setTimeout(() => get().fillPairQueue(), 0);
        } else {
          // Fallback: generate single pair immediately
          const newPairs = get().generateMultiplePairs(1);
          if (newPairs.length > 0) {
            pair = newPairs[0];
            set({ currentPair: pair });
            
            // Fill queue for next time
            setTimeout(() => get().fillPairQueue(), 0);
          } else {
            throw new Error('Could not generate pair');
          }
        }
        
        return pair;
      },

      castVote: async (winnerId: string, loserId: string) => {
        const { players, currentPair, votes, recentVotes } = get();

        if (!currentPair) return null;

        if (recentVotes.includes(currentPair.pairId)) {
          return null;
        }

        const winner = players.find((p) => p.id === winnerId);
        const loser = players.find((p) => p.id === loserId);

        if (!winner || !loser) return null;

        try {
          set({ isLoading: true });

          const currentLeaderboard = get().getLeaderboard();
          const winnerOldRank = currentLeaderboard.findIndex((p) => p.id === winnerId) + 1;
          const loserOldRank = currentLeaderboard.findIndex((p) => p.id === loserId) + 1;

          const { data, error } = await supabase.rpc('cast_vote_and_update_players', {
            p_winner_id: winnerId,
            p_loser_id: loserId,
            p_pair_id: currentPair.pairId,
          });

          if (error) throw error;

          const update = data?.[0];
          if (!update) {
            throw new Error('No rating update returned');
          }

          const winnerRatingChange = update.winner_new_rating - update.winner_old_rating;
          const loserRatingChange = update.loser_new_rating - update.loser_old_rating;

          const updatedPlayers = players.map((player) => {
            if (player.id === winnerId) {
              return {
                ...player,
                rating: update.winner_new_rating,
                ratingDeviation: update.winner_new_rating_deviation,
                volatility: update.winner_new_volatility,
                exposureCount: player.exposureCount + 1,
                winCount: player.winCount + 1,
              };
            }
            if (player.id === loserId) {
              return {
                ...player,
                rating: update.loser_new_rating,
                ratingDeviation: update.loser_new_rating_deviation,
                volatility: update.loser_new_volatility,
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

          const newLeaderboard = get().getLeaderboard();
          const winnerNewRank = newLeaderboard.findIndex((p) => p.id === winnerId) + 1;
          const loserNewRank = newLeaderboard.findIndex((p) => p.id === loserId) + 1;

          const result: RatingUpdate = {
            winnerId,
            loserId,
            winnerNewRating: update.winner_new_rating,
            loserNewRating: update.loser_new_rating,
            winnerRatingChange,
            loserRatingChange,
            winnerNewRatingDeviation: update.winner_new_rating_deviation,
            loserNewRatingDeviation: update.loser_new_rating_deviation,
            winnerNewVolatility: update.winner_new_volatility,
            loserNewVolatility: update.loser_new_volatility,
            winnerOldRank,
            winnerNewRank,
            loserOldRank,
            loserNewRank,
          };

          return result;
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

      recalculateAllRatings: async () => {
        const results = await recalculateAllGlickoRatings();
        // Reload players from database to get updated ratings
        await get().loadPlayersFromDB();
        return results;
      },
    }));

export { useGameStore };
