import React, { useState, useEffect } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface PlayerAvatarProps {
  name: string;
  emoji: string;
  profileImageUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-12 w-12 text-lg',
  lg: 'h-16 w-16 text-2xl',
  xl: 'h-20 w-20 text-4xl'
};

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  name,
  emoji,
  profileImageUrl,
  size = 'md',
  className
}) => {
  const [imageError, setImageError] = useState(false);

  // Reset error state when the image URL changes
  useEffect(() => {
    setImageError(false);
  }, [profileImageUrl]);

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {profileImageUrl && !imageError && (
        <AvatarImage
          src={profileImageUrl}
          alt={`${name} profile picture`}
          onError={() => setImageError(true)}
        />
      )}
      <AvatarFallback className="bg-gradient-to-br from-electric-blue/20 to-purple/20 text-electric-blue border border-electric-blue/30">
        {emoji}
      </AvatarFallback>
    </Avatar>
  );
};