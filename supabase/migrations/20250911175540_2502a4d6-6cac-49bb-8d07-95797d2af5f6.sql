-- Create players table for fighters
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 1500,
  exposure_count INTEGER NOT NULL DEFAULT 0,
  win_count INTEGER NOT NULL DEFAULT 0,
  loss_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create votes table to track all voting decisions
CREATE TABLE public.votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pair_id TEXT NOT NULL,
  winner_id UUID NOT NULL REFERENCES public.players(id),
  loser_id UUID NOT NULL REFERENCES public.players(id),
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Create policies for players table
CREATE POLICY "Players are viewable by everyone" 
ON public.players 
FOR SELECT 
USING (true);

CREATE POLICY "Players can be updated by anyone" 
ON public.players 
FOR UPDATE 
USING (true);

-- Create policies for votes table  
CREATE POLICY "Votes are viewable by everyone" 
ON public.votes 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert votes" 
ON public.votes 
FOR INSERT 
WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates on players
CREATE TRIGGER update_players_updated_at
BEFORE UPDATE ON public.players
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial fighter data
INSERT INTO public.players (name, emoji, rating, exposure_count, win_count, loss_count) VALUES
  ('Lionel Messi', '🇦🇷', 1500, 0, 0, 0),
  ('Cristiano Ronaldo', '🇵🇹', 1500, 0, 0, 0),
  ('Pelé', '🇧🇷', 1500, 0, 0, 0),
  ('Diego Maradona', '🇦🇷', 1500, 0, 0, 0),
  ('Johan Cruyff', '🇳🇱', 1500, 0, 0, 0),
  ('Zinedine Zidane', '🇫🇷', 1500, 0, 0, 0),
  ('Ronaldinho', '🇧🇷', 1500, 0, 0, 0),
  ('Kaká', '🇧🇷', 1500, 0, 0, 0),
  ('Thierry Henry', '🇫🇷', 1500, 0, 0, 0),
  ('Ronaldo Nazário', '🇧🇷', 1500, 0, 0, 0),
  ('Neymar Jr', '🇧🇷', 1500, 0, 0, 0),
  ('Kylian Mbappé', '🇫🇷', 1500, 0, 0, 0),
  ('Erling Haaland', '🇳🇴', 1500, 0, 0, 0),
  ('Kevin De Bruyne', '🇧🇪', 1500, 0, 0, 0),
  ('Robert Lewandowski', '🇵🇱', 1500, 0, 0, 0),
  ('Luka Modrić', '🇭🇷', 1500, 0, 0, 0),
  ('Virgil van Dijk', '🇳🇱', 1500, 0, 0, 0),
  ('Sadio Mané', '🇸🇳', 1500, 0, 0, 0);

-- Create indexes for better performance
CREATE INDEX idx_votes_winner_id ON public.votes(winner_id);
CREATE INDEX idx_votes_loser_id ON public.votes(loser_id);
CREATE INDEX idx_votes_timestamp ON public.votes(timestamp);
CREATE INDEX idx_players_rating ON public.players(rating DESC);