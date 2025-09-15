import { create } from 'zustand';
import { Player, Vote, VotePair, EloUpdate } from '@/types/goat';
import { calculateElo } from '@/utils/elo';
import { supabase } from '@/integrations/supabase/client';
import { resolveProfileImageUrl } from '@/utils/profileImage';

const FORCED_PLAYER_ID = 'be89fe0f-e25c-43b5-b6b0-06a195807246';

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
      // Pre-fill the queue after loading players
      setTimeout(() => get().fillPairQueue(), 0);
    }
  },

      generateMultiplePairs: (count: number) => {
        const { players, recentVotes } = get();

        if (players.length < 2) {
          return [];
        }

        const forcedPlayer = players.find(player => player.id === FORCED_PLAYER_ID);
        const availableOpponents = forcedPlayer
          ? players.filter(player => player.id !== FORCED_PLAYER_ID)
          : players;

        if (forcedPlayer && availableOpponents.length === 0) {
          return [];
        }

        const opponentsPool = forcedPlayer ? [...availableOpponents] : [];
        const pairs: VotePair[] = [];
        const usedPairIds = new Set([...recentVotes]);

        for (let i = 0; i < count; i++) {
          let playerA: Player | undefined;
          let playerB: Player | undefined;
          let attempts = 0;
          const maxAttempts = 50;
          let pairId = '';
          let reversePairId = '';

          do {
            attempts++;

            if (forcedPlayer) {
              if (opponentsPool.length === 0) {
                opponentsPool.push(...availableOpponents);
              }

              const opponentIndex = Math.floor(Math.random() * opponentsPool.length);
              const [opponent] = opponentsPool.splice(opponentIndex, 1);

              if (!opponent) {
                break;
              }

              const forcedFirst = Math.random() < 0.5;
              playerA = forcedFirst ? forcedPlayer : opponent;
              playerB = forcedFirst ? opponent : forcedPlayer;
            } else {
              const shuffled = [...players].sort(() => Math.random() - 0.5);
              playerA = shuffled[0];
              playerB = shuffled[1];
            }

            if (!playerA || !playerB) {
              continue;
            }

            pairId = `${playerA.id}-${playerB.id}`;
            reversePairId = `${playerB.id}-${playerA.id}`;
          } while (
            attempts < maxAttempts &&
            (
              !playerA ||
              !playerB ||
              playerA.id === playerB.id ||
              usedPairIds.has(pairId) ||
              usedPairIds.has(reversePairId)
            )
          );

          if (!playerA || !playerB) {
            continue;
          }

          if (attempts < maxAttempts) {
            const fullPairId = `${pairId}-${Date.now()}-${i}`;
            const pair: VotePair = { pairId: fullPairId, playerA, playerB };
            pairs.push(pair);
            usedPairIds.add(pairId);
            usedPairIds.add(`${playerB.id}-${playerA.id}`);
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
        
        // Check for duplicate vote
        if (recentVotes.includes(currentPair.pairId)) {
          return null;
        }

        const winner = players.find(p => p.id === winnerId);
        const loser = players.find(p => p.id === loserId);
        
        if (!winner || !loser) return null;

        try {
          set({ isLoading: true });

          // Get current rankings before update
          const currentLeaderboard = get().getLeaderboard();
          const winnerOldRank = currentLeaderboard.findIndex(p => p.id === winnerId) + 1;
          const loserOldRank = currentLeaderboard.findIndex(p => p.id === loserId) + 1;

          // Calculate Elo update
          const eloUpdate = calculateElo(winner, loser);
          
          // Use the secure database function to cast vote and update players
          const { data, error } = await supabase.rpc('cast_vote_and_update_players', {
            p_winner_id: winnerId,
            p_loser_id: loserId,
            p_pair_id: currentPair.pairId,
            p_winner_new_rating: eloUpdate.winnerNewRating,
            p_loser_new_rating: eloUpdate.loserNewRating,
          });

          if (error) throw error;

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

          // Get new rankings after update
          const newLeaderboard = get().getLeaderboard();
          const winnerNewRank = newLeaderboard.findIndex(p => p.id === winnerId) + 1;
          const loserNewRank = newLeaderboard.findIndex(p => p.id === loserId) + 1;

          return {
            ...eloUpdate,
            winnerOldRank,
            winnerNewRank,
            loserOldRank,
            loserNewRank,
          };
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
