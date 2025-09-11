import React, { useState, useEffect, useCallback } from 'react';
import { VoteCard } from './VoteCard';
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
    hasVotedRecently 
  } = useGameStore();
  
  const [isVoting, setIsVoting] = useState(false);
  const [lastVoteResult, setLastVoteResult] = useState<{winnerId: string, ratingChange: number} | null>(null);

  // Generate initial pair
  useEffect(() => {
    if (!currentPair) {
      try {
        generatePair();
      } catch (error) {
        console.error('Failed to generate pair:', error);
      }
    }
  }, [currentPair, generatePair]);

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
  }, [currentPair, isVoting]);

  const handleVote = useCallback(async (winnerId: string, loserId: string) => {
    if (isVoting || !currentPair) return;
    
    // Check for duplicate vote
    if (hasVotedRecently(currentPair.pairId)) {
      toast.error('You already voted on this matchup!');
      return;
    }

    setIsVoting(true);
    
    // Cast vote
    const result = castVote(winnerId, loserId);
    
    if (result) {
      setLastVoteResult({
        winnerId,
        ratingChange: result.winnerRatingChange
      });
      
      toast.success(`+${result.winnerRatingChange} rating!`, {
        duration: 2000,
      });

      // Wait for animation, then generate new pair
      setTimeout(() => {
        generatePair();
        setIsVoting(false);
        setLastVoteResult(null);
      }, 1500);
    } else {
      setIsVoting(false);
      toast.error('Vote failed. Please try again.');
    }
  }, [currentPair, isVoting, castVote, generatePair, hasVotedRecently]);

  if (!currentPair) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⚽</div>
          <p className="text-muted-foreground">Loading matchup...</p>
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
            <p className="text-muted-foreground">Regras: sem armas, arena de UFC (Octógono) com teto de 3m de altura, até a morte, incapacitação ou desistência</p>
          </div>

          {/* Duel Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
            <VoteCard
              player={currentPair.playerA}
              position="left"
              onVote={() => handleVote(currentPair.playerA.id, currentPair.playerB.id)}
              isWinner={lastVoteResult?.winnerId === currentPair.playerA.id}
              disabled={isVoting}
            />

            {/* VS Divider */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
              <div className="bg-gradient-primary text-white w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl shadow-glow">
                VS
              </div>
            </div>

            <VoteCard
              player={currentPair.playerB}
              position="right"
              onVote={() => handleVote(currentPair.playerB.id, currentPair.playerA.id)}
              isWinner={lastVoteResult?.winnerId === currentPair.playerB.id}
              disabled={isVoting}
            />
          </div>

          {/* Mobile VS */}
          <div className="flex justify-center my-8 md:hidden">
            <div className="bg-gradient-primary text-white w-12 h-12 rounded-full flex items-center justify-center font-bold shadow-glow">
              VS
            </div>
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