-- Create function to recalculate all Elo ratings from scratch
CREATE OR REPLACE FUNCTION public.recalculate_all_elo_ratings()
 RETURNS TABLE(player_id uuid, old_rating integer, new_rating integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  vote_record RECORD;
  winner_player RECORD;
  loser_player RECORD;
  winner_k INTEGER;
  loser_k INTEGER;
  expected_winner FLOAT;
  expected_loser FLOAT;
  winner_rating_change FLOAT;
  loser_rating_change FLOAT;
  winner_new_rating INTEGER;
  loser_new_rating INTEGER;
BEGIN
  -- Reset all players to initial state (1500 rating, 0 counts)
  UPDATE players SET 
    rating = 1500,
    win_count = 0,
    loss_count = 0,
    exposure_count = 0,
    updated_at = now();
  
  -- Process all votes in chronological order
  FOR vote_record IN 
    SELECT winner_id, loser_id, created_at 
    FROM votes 
    ORDER BY created_at ASC
  LOOP
    -- Get current player states
    SELECT * INTO winner_player FROM players WHERE id = vote_record.winner_id;
    SELECT * INTO loser_player FROM players WHERE id = vote_record.loser_id;
    
    -- Calculate K-factors with proper decay (using Math.min equivalent)
    winner_k := LEAST(24, GREATEST(16, 24 - (winner_player.exposure_count / 50)));
    loser_k := LEAST(24, GREATEST(16, 24 - (loser_player.exposure_count / 50)));
    
    -- Calculate expected scores
    expected_winner := 1.0 / (1.0 + POWER(10, (loser_player.rating - winner_player.rating) / 400.0));
    expected_loser := 1.0 - expected_winner;
    
    -- Calculate rating changes
    winner_rating_change := winner_k * (1.0 - expected_winner);
    loser_rating_change := loser_k * (0.0 - expected_loser);
    
    -- Calculate new ratings
    winner_new_rating := ROUND(winner_player.rating + winner_rating_change);
    loser_new_rating := ROUND(loser_player.rating + loser_rating_change);
    
    -- Update winner
    UPDATE players 
    SET 
      rating = winner_new_rating,
      win_count = win_count + 1,
      exposure_count = exposure_count + 1,
      updated_at = now()
    WHERE id = vote_record.winner_id;
    
    -- Update loser
    UPDATE players 
    SET 
      rating = loser_new_rating,
      loss_count = loss_count + 1,
      exposure_count = exposure_count + 1,
      updated_at = now()
    WHERE id = vote_record.loser_id;
  END LOOP;
  
  -- Return the results showing old vs new ratings
  RETURN QUERY 
  SELECT id, 1500 as old_rating, rating as new_rating 
  FROM players 
  ORDER BY rating DESC;
END;
$function$;