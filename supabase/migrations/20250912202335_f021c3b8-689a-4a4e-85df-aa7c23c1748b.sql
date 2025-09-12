-- Add profile_image_url column to players table
ALTER TABLE public.players 
ADD COLUMN profile_image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.players.profile_image_url IS 'URL to the player profile image, fallback to emoji if null';