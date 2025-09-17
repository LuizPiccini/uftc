-- Migrate players table to support Glicko-2 ratings
ALTER TABLE public.players
  ALTER COLUMN rating TYPE double precision USING rating::double precision,
  ALTER COLUMN rating SET DEFAULT 1500;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS rating_deviation double precision NOT NULL DEFAULT 350,
  ADD COLUMN IF NOT EXISTS volatility double precision NOT NULL DEFAULT 0.06;

-- Helper function to compute a single Glicko-2 update against one opponent
CREATE OR REPLACE FUNCTION public.glicko2_update(
  p_rating double precision,
  p_rating_deviation double precision,
  p_volatility double precision,
  p_opponent_rating double precision,
  p_opponent_rating_deviation double precision,
  p_score double precision
) RETURNS TABLE(
  new_rating double precision,
  new_rating_deviation double precision,
  new_volatility double precision
)
LANGUAGE plpgsql
AS $function$
DECLARE
  tau CONSTANT double precision := 0.5;
  epsilon CONSTANT double precision := 0.000001;
  rating_scale CONSTANT double precision := 173.7178;
  pi_square CONSTANT double precision := pi() * pi();
  mu double precision;
  phi double precision;
  phi_star double precision;
  phi_prime double precision;
  sigma double precision;
  mu_opponent double precision;
  phi_opponent double precision;
  g_phi double precision;
  expected double precision;
  v double precision;
  delta double precision;
  a double precision;
  A_val double precision;
  B_val double precision;
  C_val double precision;
  fA double precision;
  fB double precision;
  fC double precision;
  k integer;
BEGIN
  mu := (p_rating - 1500) / rating_scale;
  phi := p_rating_deviation / rating_scale;
  sigma := p_volatility;
  mu_opponent := (p_opponent_rating - 1500) / rating_scale;
  phi_opponent := p_opponent_rating_deviation / rating_scale;

  g_phi := 1 / sqrt(1 + 3 * phi_opponent * phi_opponent / pi_square);
  expected := 1 / (1 + exp(-g_phi * (mu - mu_opponent)));
  v := 1 / (g_phi * g_phi * expected * (1 - expected));
  delta := v * g_phi * (p_score - expected);

  a := ln(sigma * sigma);
  A_val := a;
  fA := (exp(A_val) * (delta * delta - phi * phi - v - exp(A_val))) /
        (2 * power(phi * phi + v + exp(A_val), 2)) - (A_val - a) / (tau * tau);

  IF delta * delta > phi * phi + v THEN
    B_val := ln(delta * delta - phi * phi - v);
    fB := (exp(B_val) * (delta * delta - phi * phi - v - exp(B_val))) /
          (2 * power(phi * phi + v + exp(B_val), 2)) - (B_val - a) / (tau * tau);
  ELSE
    k := 1;
    LOOP
      B_val := a - k * tau;
      fB := (exp(B_val) * (delta * delta - phi * phi - v - exp(B_val))) /
            (2 * power(phi * phi + v + exp(B_val), 2)) - (B_val - a) / (tau * tau);
      EXIT WHEN fB < 0;
      k := k + 1;
    END LOOP;
  END IF;

  WHILE abs(B_val - A_val) > epsilon LOOP
    C_val := A_val + (A_val - B_val) * fA / (fB - fA);
    fC := (exp(C_val) * (delta * delta - phi * phi - v - exp(C_val))) /
          (2 * power(phi * phi + v + exp(C_val), 2)) - (C_val - a) / (tau * tau);

    IF fC * fB < 0 THEN
      A_val := B_val;
      fA := fB;
    ELSE
      fA := fA / 2;
    END IF;

    B_val := C_val;
    fB := fC;
  END LOOP;

  sigma := exp(A_val / 2);
  phi_star := sqrt(phi * phi + sigma * sigma);
  phi_prime := 1 / sqrt(1 / (phi_star * phi_star) + 1 / v);
  mu := mu + phi_prime * phi_prime * g_phi * (p_score - expected);

  new_rating := mu * rating_scale + 1500;
  new_rating_deviation := phi_prime * rating_scale;
  new_volatility := sigma;

  RETURN NEXT;
END;
$function$;

-- Recreate the secure vote casting function to use Glicko-2 updates
DROP FUNCTION IF EXISTS public.cast_vote_and_update_players(uuid, uuid, text, integer, integer);

CREATE OR REPLACE FUNCTION public.cast_vote_and_update_players(
  p_winner_id uuid,
  p_loser_id uuid,
  p_pair_id text
) RETURNS TABLE(
  winner_old_rating double precision,
  winner_new_rating double precision,
  winner_new_rating_deviation double precision,
  winner_new_volatility double precision,
  loser_old_rating double precision,
  loser_new_rating double precision,
  loser_new_rating_deviation double precision,
  loser_new_volatility double precision,
  vote_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  winner_record players%ROWTYPE;
  loser_record players%ROWTYPE;
  winner_update RECORD;
  loser_update RECORD;
BEGIN
  SELECT * INTO winner_record FROM players WHERE id = p_winner_id FOR UPDATE;
  SELECT * INTO loser_record FROM players WHERE id = p_loser_id FOR UPDATE;

  IF winner_record.id IS NULL OR loser_record.id IS NULL THEN
    RAISE EXCEPTION 'Invalid player IDs provided';
  END IF;

  winner_old_rating := winner_record.rating;
  loser_old_rating := loser_record.rating;

  SELECT *
    INTO winner_update
    FROM public.glicko2_update(
      winner_record.rating,
      winner_record.rating_deviation,
      winner_record.volatility,
      loser_record.rating,
      loser_record.rating_deviation,
      1
    );

  SELECT *
    INTO loser_update
    FROM public.glicko2_update(
      loser_record.rating,
      loser_record.rating_deviation,
      loser_record.volatility,
      winner_record.rating,
      winner_record.rating_deviation,
      0
    );

  INSERT INTO votes (winner_id, loser_id, pair_id, timestamp)
  VALUES (p_winner_id, p_loser_id, p_pair_id, EXTRACT(epoch FROM now()) * 1000)
  RETURNING id INTO vote_id;

  UPDATE players
  SET
    rating = winner_update.new_rating,
    rating_deviation = winner_update.new_rating_deviation,
    volatility = winner_update.new_volatility,
    win_count = win_count + 1,
    exposure_count = exposure_count + 1,
    updated_at = now()
  WHERE id = p_winner_id;

  UPDATE players
  SET
    rating = loser_update.new_rating,
    rating_deviation = loser_update.new_rating_deviation,
    volatility = loser_update.new_volatility,
    loss_count = loss_count + 1,
    exposure_count = exposure_count + 1,
    updated_at = now()
  WHERE id = p_loser_id;

  winner_new_rating := winner_update.new_rating;
  winner_new_rating_deviation := winner_update.new_rating_deviation;
  winner_new_volatility := winner_update.new_volatility;
  loser_new_rating := loser_update.new_rating;
  loser_new_rating_deviation := loser_update.new_rating_deviation;
  loser_new_volatility := loser_update.new_volatility;

  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cast_vote_and_update_players TO anon;
GRANT EXECUTE ON FUNCTION public.cast_vote_and_update_players TO authenticated;

-- Rebuild the historical recalculation routine using Glicko-2
DROP FUNCTION IF EXISTS public.recalculate_all_elo_ratings();

CREATE OR REPLACE FUNCTION public.recalculate_all_glicko2_ratings()
RETURNS TABLE(
  player_id uuid,
  old_rating double precision,
  new_rating double precision,
  new_rating_deviation double precision,
  new_volatility double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  vote_record RECORD;
  winner_record players%ROWTYPE;
  loser_record players%ROWTYPE;
  winner_update RECORD;
  loser_update RECORD;
BEGIN
  CREATE TEMP TABLE temp_original_players AS
    SELECT id, rating, rating_deviation, volatility
    FROM players;

  UPDATE players SET
    rating = 1500,
    rating_deviation = 350,
    volatility = 0.06,
    win_count = 0,
    loss_count = 0,
    exposure_count = 0,
    updated_at = now();

  FOR vote_record IN
    SELECT winner_id, loser_id
    FROM votes
    ORDER BY created_at ASC
  LOOP
    SELECT * INTO winner_record FROM players WHERE id = vote_record.winner_id;
    SELECT * INTO loser_record FROM players WHERE id = vote_record.loser_id;

    SELECT *
      INTO winner_update
      FROM public.glicko2_update(
        winner_record.rating,
        winner_record.rating_deviation,
        winner_record.volatility,
        loser_record.rating,
        loser_record.rating_deviation,
        1
      );

    SELECT *
      INTO loser_update
      FROM public.glicko2_update(
        loser_record.rating,
        loser_record.rating_deviation,
        loser_record.volatility,
        winner_record.rating,
        winner_record.rating_deviation,
        0
      );

    UPDATE players
    SET
      rating = winner_update.new_rating,
      rating_deviation = winner_update.new_rating_deviation,
      volatility = winner_update.new_volatility,
      win_count = win_count + 1,
      exposure_count = exposure_count + 1,
      updated_at = now()
    WHERE id = vote_record.winner_id;

    UPDATE players
    SET
      rating = loser_update.new_rating,
      rating_deviation = loser_update.new_rating_deviation,
      volatility = loser_update.new_volatility,
      loss_count = loss_count + 1,
      exposure_count = exposure_count + 1,
      updated_at = now()
    WHERE id = vote_record.loser_id;
  END LOOP;

  RETURN QUERY
  SELECT
    p.id,
    COALESCE(o.rating, 1500) AS old_rating,
    p.rating AS new_rating,
    p.rating_deviation,
    p.volatility
  FROM players p
  LEFT JOIN temp_original_players o ON o.id = p.id
  ORDER BY p.rating DESC;
END;
$function$;

-- Maintain backwards compatibility for existing RPC consumers
CREATE OR REPLACE FUNCTION public.recalculate_all_elo_ratings()
RETURNS TABLE(
  player_id uuid,
  old_rating double precision,
  new_rating double precision,
  new_rating_deviation double precision,
  new_volatility double precision
)
LANGUAGE sql
AS $$
  SELECT * FROM public.recalculate_all_glicko2_ratings();
$$;
