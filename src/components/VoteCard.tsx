import React, { useState } from 'react';
import { Player } from '@/types/goat';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoteCardProps {
  player: Player;
  position: 'left' | 'right';
  onVote: () => void;
  isWinner?: boolean;
  disabled?: boolean;
}

export const VoteCard: React.FC<VoteCardProps> = ({
  player,
  position,
  onVote,
  isWinner = false,
  disabled = false,
}) => {
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    setIsClicked(true);
    onVote();
    setTimeout(() => setIsClicked(false), 600);
  };

  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-6 h-[400px] w-full max-w-[300px] mx-auto",
      "bg-card border border-border rounded-2xl shadow-card",
      "transition-all duration-300 hover:scale-105 hover:shadow-glow",
      "cursor-pointer group",
      disabled && "opacity-50 cursor-not-allowed",
      isWinner && "animate-vote-winner",
      isClicked && "scale-95"
    )}
    onClick={handleClick}
    >
      <div className="text-6xl mb-4 group-hover:animate-float">
        {player.emoji}
      </div>
      
      <h3 className="text-xl font-bold text-center mb-2 group-hover:text-electric-blue transition-colors">
        {player.name}
      </h3>
      
      <div className="text-center space-y-1">
        <div className="text-sm text-muted-foreground">
          Rating: <span className="text-electric-blue font-semibold">{Math.round(player.rating)}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {player.winCount}W - {player.lossCount}L
        </div>
      </div>

      <div className={cn(
        "mt-4 text-xs text-center px-3 py-1 rounded-full",
        "bg-electric-blue/10 text-electric-blue border border-electric-blue/20"
      )}>
        {position === 'left' ? 'Press ← or tap' : 'Press → or tap'}
      </div>
    </div>
  );
};