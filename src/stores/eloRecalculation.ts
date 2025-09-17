import { supabase } from '@/integrations/supabase/client';

export interface RecalculationResult {
  playerId: string;
  oldRating: number;
  newRating: number;
}

export async function recalculateAllEloRatings(): Promise<RecalculationResult[]> {
  try {
    const { data, error } = await supabase.rpc('recalculate_all_elo_ratings');
    
    if (error) {
      console.error('Error recalculating Elo ratings:', error);
      throw error;
    }
    
    return data?.map((row: any) => ({
      playerId: row.player_id,
      oldRating: row.old_rating,
      newRating: row.new_rating,
    })) || [];
  } catch (error) {
    console.error('Failed to recalculate Elo ratings:', error);
    throw error;
  }
}