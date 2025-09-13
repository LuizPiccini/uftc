import React, { useState } from 'react';
import { Player } from '@/types/goat';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/PlayerAvatar';
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
      "flex flex-col items-center justify-center p-3 sm:p-4 h-[280px] sm:h-[320px] w-full",
      "bg-card border border-border rounded-xl sm:rounded-2xl shadow-card",
      "transition-all duration-300 hover:scale-105 hover:shadow-glow",
      "cursor-pointer group",
      disabled && "opacity-50 cursor-not-allowed",
      isWinner && "animate-vote-winner",
      isClicked && "scale-95"
    )}
    onClick={handleClick}
    >
      <div className="mb-3 sm:mb-4 group-hover:animate-float">
        <PlayerAvatar
          name={player.name}
          emoji={player.emoji}
          profileImageUrl={player.profileImageUrl}
          size="xl"
          className="h-16 w-16 sm:h-20 sm:w-20 text-3xl sm:text-4xl"
        />
      </div>
      
      <h3 className="text-sm sm:text-lg font-bold text-center mb-2 group-hover:text-electric-blue transition-colors leading-tight">
        {player.name}
      </h3>
      
      <div className="text-center">
        <div className="text-xs text-muted-foreground">
          {player.winCount}W - {player.lossCount}L
        </div>
      </div>

      <div className={cn(
        "mt-3 sm:mt-4 text-xs text-center px-2 sm:px-3 py-1 rounded-full",
        "bg-electric-blue/10 text-electric-blue border border-electric-blue/20"
      )}>
        {position === 'left' ? 'Press ← or tap' : 'Press → or tap'}
      </div>
    </div>
  );
};