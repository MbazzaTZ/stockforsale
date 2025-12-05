-- Add target column to distribution_executives table
ALTER TABLE public.distribution_executives 
ADD COLUMN IF NOT EXISTS target INTEGER DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.distribution_executives.target IS 'Monthly sales target for the Distribution Executive';
