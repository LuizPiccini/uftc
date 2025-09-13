import React, { useState, useEffect } from 'react';
import { Player } from '@/types/goat';

interface RankingDisplayProps {
  player: Player;
  oldRank?: number;
  newRank?: number;
  isWinner?: boolean;
}

export const RankingDisplay: React.FC<RankingDisplayProps> = ({ 
  player, 
  oldRank, 
  newRank, 
  isWinner 
}) => {
  const [displayRank, setDisplayRank] = useState(oldRank || newRank);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (oldRank && newRank && oldRank !== newRank) {
      setIsAnimating(true);
      setTimeout(() => {
        setDisplayRank(newRank);
        setTimeout(() => setIsAnimating(false), 300);
      }, 500);
    } else if (newRank) {
      setDisplayRank(newRank);
    }
  }, [oldRank, newRank]);

  const getRankText = (rank: number) => {
    if (rank === 1) return "🥇 1st";
    if (rank === 2) return "🥈 2nd"; 
    if (rank === 3) return "🥉 3rd";
    return `#${rank}`;
  };

  const hasRankChange = oldRank && newRank && oldRank !== newRank;
  const rankImproved = hasRankChange && newRank < oldRank;

  return (
    <div className="text-center mt-2">
      <div className="text-sm font-medium text-muted-foreground">Ranking</div>
      <div className={`text-lg font-bold transition-all duration-300 ${
        isAnimating ? 'animate-scale-in' : ''
      } ${
        isWinner 
          ? rankImproved 
            ? 'text-green-500' 
            : 'text-electric-blue'
          : hasRankChange 
            ? 'text-orange-500' 
            : 'text-muted-foreground'
      }`}>
        {displayRank ? getRankText(displayRank) : '...'}
      </div>
      {hasRankChange && (
        <div className="text-xs text-muted-foreground">
          {rankImproved ? `↑ +${oldRank - newRank}` : `↓ -${newRank - oldRank}`}
        </div>
      )}
    </div>
  );
};