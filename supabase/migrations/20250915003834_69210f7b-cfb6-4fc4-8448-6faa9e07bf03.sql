-- Remove the overly permissive update policy for players
DROP POLICY IF EXISTS "Players can be updated by anyone" ON public.players;

-- Create a secure function to handle vote casting and player updates
CREATE OR REPLACE FUNCTION public.cast_vote_and_update_players(
  p_winner_id UUID,
  p_loser_id UUID,
  p_pair_id TEXT,
  p_winner_new_rating INTEGER,
  p_loser_new_rating INTEGER
)
RETURNS TABLE(
  winner_old_rating INTEGER,
  loser_old_rating INTEGER,
  vote_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner_old_rating INTEGER;
  v_loser_old_rating INTEGER;
  v_vote_id UUID;
BEGIN
  -- Get current ratings before update
  SELECT rating INTO v_winner_old_rating FROM players WHERE id = p_winner_id;
  SELECT rating INTO v_loser_old_rating FROM players WHERE id = p_loser_id;
  
  -- Validate that both players exist
  IF v_winner_old_rating IS NULL OR v_loser_old_rating IS NULL THEN
    RAISE EXCEPTION 'Invalid player IDs provided';
  END IF;
  
  -- Insert the vote record
  INSERT INTO votes (winner_id, loser_id, pair_id, timestamp)
  VALUES (p_winner_id, p_loser_id, p_pair_id, EXTRACT(epoch FROM now()) * 1000)
  RETURNING id INTO v_vote_id;
  
  -- Update winner stats
  UPDATE players 
  SET 
    rating = p_winner_new_rating,
    win_count = win_count + 1,
    exposure_count = exposure_count + 1,
    updated_at = now()
  WHERE id = p_winner_id;
  
  -- Update loser stats  
  UPDATE players
  SET 
    rating = p_loser_new_rating,
    loss_count = loss_count + 1,
    exposure_count = exposure_count + 1,
    updated_at = now()
  WHERE id = p_loser_id;
  
  -- Return the old ratings and vote ID
  RETURN QUERY SELECT v_winner_old_rating, v_loser_old_rating, v_vote_id;
END;
$$;

-- Grant execute permission to anonymous users (since this is a public voting app)
GRANT EXECUTE ON FUNCTION public.cast_vote_and_update_players TO anon;
GRANT EXECUTE ON FUNCTION public.cast_vote_and_update_players TO authenticated;