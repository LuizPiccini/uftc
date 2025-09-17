import { supabase } from '@/integrations/supabase/client';

export interface RecalculationResult {
  playerId: string;
  oldRating: number;
  newRating: number;
  newRatingDeviation: number;
  newVolatility: number;
}

export async function recalculateAllGlickoRatings(): Promise<RecalculationResult[]> {
  try {
    const { data, error } = await supabase.rpc('recalculate_all_glicko2_ratings');

    if (error) {
      console.error('Error recalculating Glicko-2 ratings:', error);
      throw error;
    }

    if (!data) {
      return [];
    }

    return data.map((row) => ({
      playerId: row.player_id,
      oldRating: row.old_rating,
      newRating: row.new_rating,
      newRatingDeviation: row.new_rating_deviation,
      newVolatility: row.new_volatility,
    }));
  } catch (error) {
    console.error('Failed to recalculate Glicko-2 ratings:', error);
    throw error;
  }
}