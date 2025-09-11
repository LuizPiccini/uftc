import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/stores/gameStore';
import { ArrowLeft, Trophy, TrendingUp } from 'lucide-react';
import { getRatingColor, getRankEmoji } from '@/utils/elo';
import { cn } from '@/lib/utils';

interface LeaderboardScreenProps {
  onBackToDuel: () => void;
}

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ onBackToDuel }) => {
  const { getLeaderboard, totalVotes, loadPlayersFromDB, loadVotesFromDB } = useGameStore();

  // Load fresh data when component mounts
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([loadPlayersFromDB(), loadVotesFromDB()]);
    };
    loadData();
  }, [loadPlayersFromDB, loadVotesFromDB]);

  const players = getLeaderboard();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/80">
      {/* Header */}
      <header className="p-4 border-b border-border/50 backdrop-blur-sm bg-background/80">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Button 
            variant="ghost" 
            onClick={onBackToDuel}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Voting
          </Button>
          
          <div className="text-center">
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Ranking UFTC
            </h1>
            <p className="text-sm text-muted-foreground">
              {totalVotes} total votes • Live Elo ratings
            </p>
          </div>
          
          <div className="w-24" /> {/* Spacer for alignment */}
        </div>
      </header>

      {/* Leaderboard */}
      <main className="p-4">
        <div className="max-w-4xl mx-auto">
          {/* Top 3 Podium */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {players.slice(0, 3).map((player, index) => (
              <div 
                key={player.id}
                className={cn(
                  "text-center p-6 rounded-2xl border shadow-card",
                  "bg-card/50 backdrop-blur-sm",
                  index === 0 && "bg-gradient-gold/10 border-gold/30",
                  index === 1 && "bg-orange/10 border-orange/30", 
                  index === 2 && "bg-orange/10 border-orange/30"
                )}
                style={{ order: index === 0 ? 2 : index === 1 ? 1 : 3 }}
              >
                <div className="text-4xl mb-2">{player.emoji}</div>
                <div className="text-2xl mb-1">{getRankEmoji(index + 1)}</div>
                <h3 className="font-bold text-sm mb-2">{player.name}</h3>
                <div className={cn("text-xl font-bold", getRatingColor(player.rating))}>
                  {Math.round(player.rating)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {player.winCount}W-{player.lossCount}L
                </div>
              </div>
            ))}
          </div>

          {/* Full Rankings */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-gold" />
              <h2 className="text-xl font-bold">Complete Rankings</h2>
            </div>

            {players.map((player, index) => (
              <div 
                key={player.id}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl",
                  "bg-card/30 border border-border/50 backdrop-blur-sm",
                  "hover:bg-card/50 transition-all duration-200",
                  index < 3 && "bg-gradient-to-r from-electric-blue/5 to-purple/5"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 text-center font-bold text-muted-foreground">
                    {getRankEmoji(index + 1)}
                  </div>
                  
                  <div className="text-2xl">{player.emoji}</div>
                  
                  <div>
                    <h3 className="font-semibold">{player.name}</h3>
                    <div className="text-sm text-muted-foreground">
                      {player.exposureCount} matches • {player.winCount}W-{player.lossCount}L
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={cn("text-xl font-bold", getRatingColor(player.rating))}>
                    {Math.round(player.rating)}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {player.exposureCount > 0 ? Math.round((player.winCount / player.exposureCount) * 100) : 0}% win rate
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Stats Footer */}
          <div className="mt-8 p-6 rounded-2xl bg-card/30 border border-border/50 backdrop-blur-sm">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Quick Stats
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-electric-blue">{totalVotes}</div>
                <div className="text-xs text-muted-foreground">Total Votes</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gold">{players[0]?.rating ? Math.round(players[0].rating) : 0}</div>
                <div className="text-xs text-muted-foreground">Top Rating</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green">{Math.round(players.reduce((acc, p) => acc + p.rating, 0) / players.length) || 0}</div>
                <div className="text-xs text-muted-foreground">Avg Rating</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple">{players.length}</div>
                <div className="text-xs text-muted-foreground">Players</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};