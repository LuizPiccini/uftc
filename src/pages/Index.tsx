import React, { useState, useEffect } from 'react';
import { DuelScreen } from '@/components/DuelScreen';
import { LeaderboardScreen } from '@/components/LeaderboardScreen';
import { useGameStore } from '@/stores/gameStore';

type Screen = 'duel' | 'leaderboard';

const Index = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('duel');
  const { initializePlayers } = useGameStore();

  // Initialize players on first load
  useEffect(() => {
    initializePlayers();
  }, [initializePlayers]);

  return (
    <div className="min-h-screen">
      {currentScreen === 'duel' ? (
        <DuelScreen onViewLeaderboard={() => setCurrentScreen('leaderboard')} />
      ) : (
        <LeaderboardScreen onBackToDuel={() => setCurrentScreen('duel')} />
      )}
    </div>
  );
};

export default Index;
