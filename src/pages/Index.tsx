import React, { useState, useEffect } from 'react';
import { DuelScreen } from '@/components/DuelScreen';
import { LeaderboardScreen } from '@/components/LeaderboardScreen';
import { useGameStore } from '@/stores/gameStore';

type Screen = 'duel' | 'leaderboard';

const Index = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('duel');
  const { initializePlayers, recalculateAllRatings } = useGameStore();

  // Initialize players on first load
  useEffect(() => {
    initializePlayers();
    
    // Automatically recalculate all Elo ratings to fix historical data
    const runRecalculation = async () => {
      try {
        const results = await recalculateAllRatings();
        console.log('Elo ratings recalculated successfully:', results);
      } catch (error) {
        console.error('Failed to recalculate Elo ratings:', error);
      }
    };
    
    runRecalculation();
  }, [initializePlayers, recalculateAllRatings]);

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
