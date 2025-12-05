-- Fix RLS policies on profiles table to allow admins to read all profiles
-- This is needed for admin dashboards to show user names and details

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;

-- Allow users to read their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Allow admins to read all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Allow admins to update all profiles
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Allow managers to view profiles in their region
CREATE POLICY "Managers can view profiles in their region"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.managers m ON m.user_id = ur.user_id
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'manager'
    AND (m.region_id = profiles.region_id OR profiles.region_id IS NULL)
  )
);

-- Allow TLs to view profiles in their teams
CREATE POLICY "TLs can view team profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'tl'
  )
);
