import React, { useState, useEffect, useCallback } from 'react';
import { VoteCard } from './VoteCard';
import { RankingDisplay } from './RankingDisplay';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/stores/gameStore';
import { Trophy, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

interface DuelScreenProps {
  onViewLeaderboard: () => void;
}

export const DuelScreen: React.FC<DuelScreenProps> = ({ onViewLeaderboard }) => {
  const {
    currentPair,
    generatePair,
    castVote,
    sessionVotes,
    hasVotedRecently,
    initializePlayers,
    fillPairQueue,
    isLoading
  } = useGameStore();
  
  const [isVoting, setIsVoting] = useState(false);
  const [lastVoteResult, setLastVoteResult] = useState<{winnerId: string, winnerNewRank?: number, winnerOldRank?: number, loserNewRank?: number, loserOldRank?: number} | null>(null);

  const handleVote = useCallback(async (winnerId: string, loserId: string) => {
    if (isVoting || !currentPair || isLoading) return;
    
    // Check for duplicate vote
    if (hasVotedRecently(currentPair.pairId)) {
      toast.error('You already voted on this matchup!');
      return;
    }

    setIsVoting(true);
    
    // Cast vote
    const result = await castVote(winnerId, loserId);
    
    if (result) {
      setLastVoteResult({
        winnerId,
        winnerNewRank: result.winnerNewRank,
        winnerOldRank: result.winnerOldRank,
        loserNewRank: result.loserNewRank,
        loserOldRank: result.loserOldRank,
      });
      
      // Get player names for the toast
      const winnerName = currentPair.playerA.id === winnerId ? currentPair.playerA.name : currentPair.playerB.name;
      const loserName = currentPair.playerA.id === winnerId ? currentPair.playerB.name : currentPair.playerA.name;
      
      // Create detailed ranking change message
      let message = '';
      
      if (result.winnerOldRank && result.winnerNewRank) {
        if (result.winnerNewRank < result.winnerOldRank) {
          message += `${winnerName} subiu do ranking #${result.winnerOldRank} para #${result.winnerNewRank}`;
        } else if (result.winnerNewRank === result.winnerOldRank) {
          message += `${winnerName} manteve a posição #${result.winnerNewRank}`;
        }
      }
      
      if (result.loserOldRank && result.loserNewRank) {
        if (message) message += '\n';
        if (result.loserNewRank > result.loserOldRank) {
          message += `${loserName} caiu do ranking #${result.loserOldRank} para #${result.loserNewRank}`;
        } else if (result.loserNewRank === result.loserOldRank) {
          message += `${loserName} manteve a posição #${result.loserNewRank}`;
        }
      }
      
      if (message) {
        toast.success(message, {
          duration: 3000,
        });
      } else if (result.winnerNewRank) {
        toast.success(`${winnerName} está em #${result.winnerNewRank}!`, {
          duration: 2000,
        });
      }

      // Wait for animation, then get next pair from queue (instant)
      setTimeout(async () => {
        try {
          await generatePair();
        } catch (error) {
          console.error('Failed to generate next pair:', error);
        }
        setIsVoting(false);
        setLastVoteResult(null);
      }, 1500);
    } else {
      setIsVoting(false);
      toast.error('Vote failed. Please try again.');
    }
  }, [currentPair, isVoting, isLoading, castVote, generatePair, hasVotedRecently]);

  // Generate initial pair and start background queue filling
  useEffect(() => {
    const init = async () => {
      await initializePlayers();
      if (!currentPair) {
        try {
          await generatePair();
        } catch (error) {
          console.error('Failed to generate pair:', error);
        }
      }
    };
    init();
  }, [currentPair, generatePair, initializePlayers]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isVoting || !currentPair) return;

      if (e.key === 'ArrowLeft') {
        handleVote(currentPair.playerA.id, currentPair.playerB.id);
      } else if (e.key === 'ArrowRight') {
        handleVote(currentPair.playerB.id, currentPair.playerA.id);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPair, isVoting, handleVote]);

  if (!currentPair || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🥊</div>
          <p className="text-muted-foreground">
            {isLoading ? "Processing vote..." : "Loading matchup..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/80 flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-border/50 backdrop-blur-sm bg-background/80">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              UFTC Segunda Edição
            </h1>
            <p className="text-sm text-muted-foreground">Quem vai ser o campeão?</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-electric-blue">{sessionVotes}</div>
              <div className="text-xs text-muted-foreground">Votos</div>
            </div>
            
            <Button 
              variant="leaderboard" 
              onClick={onViewLeaderboard}
              className="gap-2"
            >
              <Trophy className="w-4 h-4" />
              Rankings
            </Button>
          </div>
        </div>
      </header>

      {/* Main Duel Area */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-6xl">
          {/* VS Header */}
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold mb-2">Quem ganharia em uma luta?</h2>
          </div>

          {/* Duel Cards - Mobile First Layout */}
          <div className="relative max-w-4xl mx-auto">
            <div className="grid grid-cols-2 gap-3 sm:gap-6 md:gap-8 items-center">
              <div className="space-y-2">
                <VoteCard
                  player={currentPair.playerA}
                  position="left"
                  onVote={() => handleVote(currentPair.playerA.id, currentPair.playerB.id)}
                  isWinner={lastVoteResult?.winnerId === currentPair.playerA.id}
                  disabled={isVoting}
                />
                {lastVoteResult && (
                  <RankingDisplay
                    player={currentPair.playerA}
                    oldRank={lastVoteResult.winnerId === currentPair.playerA.id ? lastVoteResult.winnerOldRank : lastVoteResult.loserOldRank}
                    newRank={lastVoteResult.winnerId === currentPair.playerA.id ? lastVoteResult.winnerNewRank : lastVoteResult.loserNewRank}
                    isWinner={lastVoteResult.winnerId === currentPair.playerA.id}
                  />
                )}
              </div>
              
              <div className="space-y-2">
                <VoteCard
                  player={currentPair.playerB}
                  position="right"
                  onVote={() => handleVote(currentPair.playerB.id, currentPair.playerA.id)}
                  isWinner={lastVoteResult?.winnerId === currentPair.playerB.id}
                  disabled={isVoting}
                />
                {lastVoteResult && (
                  <RankingDisplay
                    player={currentPair.playerB}
                    oldRank={lastVoteResult.winnerId === currentPair.playerB.id ? lastVoteResult.winnerOldRank : lastVoteResult.loserOldRank}
                    newRank={lastVoteResult.winnerId === currentPair.playerB.id ? lastVoteResult.winnerNewRank : lastVoteResult.loserNewRank}
                    isWinner={lastVoteResult.winnerId === currentPair.playerB.id}
                  />
                )}
              </div>
            </div>
            
            {/* VS Divider */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="bg-gradient-to-r from-electric-blue to-purple text-white px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-3 rounded-full font-bold text-sm sm:text-lg md:text-xl shadow-glow">
                VS
              </div>
            </div>
          </div>

          {/* Skip Button */}
          <div className="text-center mt-8">
            <Button 
              variant="default" 
              onClick={() => generatePair()}
              disabled={isVoting || isLoading}
              className="px-6 py-2"
            >
              Pular
            </Button>
          </div>

          {/* Rules */}
          <div className="text-center mt-8">
            <p className="text-muted-foreground">Regras: sem armas, arena de UFC (Octógono) com teto de 3m de altura, até a morte, incapacitação ou desistência</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center border-t border-border/50 backdrop-blur-sm bg-background/80">
        <p className="text-xs text-muted-foreground">
          Rankings update with every vote using Elo rating system
        </p>
      </footer>
    </div>
  );
};