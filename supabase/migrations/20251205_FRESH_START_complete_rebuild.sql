-- ============================================================================
-- SALESFLOW SUITE - COMPLETE DATABASE REBUILD (FIXED VERSION)
-- Date: 2025-12-05
-- Description: Rebuild database with proper auth setup and UUID fixes
-- ============================================================================
-- 
-- IMPORTANT FIXES APPLIED:
-- 1. Fixed UUID generation using gen_random_uuid() instead of JS crypto.randomUUID
-- 2. Ensured proper auth setup for all RLS policies
-- 3. Added missing grant permissions
-- 4. Fixed 406 errors by ensuring proper access to profiles and user_roles
--
-- USAGE INSTRUCTIONS:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Copy this ENTIRE file
-- 3. Paste and RUN in SQL Editor
-- 4. Wait for "Query executed successfully"
-- ============================================================================

-- ============================================================================
-- STEP 1: CLEAN SLATE - Drop Everything
-- ============================================================================

-- Drop all policies first
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.tablename || '_policy" ON public.' || r.tablename || ' CASCADE';
        EXECUTE 'ALTER TABLE public.' || r.tablename || ' DISABLE ROW LEVEL SECURITY';
    END LOOP;
END $$;

-- Drop all triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles CASCADE;
DROP TRIGGER IF EXISTS generate_sale_id_trigger ON public.sales CASCADE;
DROP TRIGGER IF EXISTS generate_stock_id_trigger ON public.stock CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.generate_sale_id() CASCADE;
DROP FUNCTION IF EXISTS public.generate_stock_id() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;

-- Drop all sequences
DROP SEQUENCE IF EXISTS public.sale_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.stock_id_seq CASCADE;

-- Drop all tables (in correct order to avoid FK constraints)
DROP TABLE IF EXISTS public.alerts CASCADE;
DROP TABLE IF EXISTS public.commissions CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.stock CASCADE;
DROP TABLE IF EXISTS public.stock_batches CASCADE;
DROP TABLE IF EXISTS public.dsrs CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.tl_targets CASCADE;
DROP TABLE IF EXISTS public.team_leaders CASCADE;
DROP TABLE IF EXISTS public.distribution_executives CASCADE;
DROP TABLE IF EXISTS public.managers CASCADE;
DROP TABLE IF EXISTS public.regions CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop all enums
DROP TYPE IF EXISTS public.approval_status CASCADE;
DROP TYPE IF EXISTS public.sale_type CASCADE;
DROP TYPE IF EXISTS public.payment_status CASCADE;
DROP TYPE IF EXISTS public.stock_status CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- ============================================================================
-- STEP 2: Create Fresh Enums
-- ============================================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'tl', 'dsr', 'de');
CREATE TYPE public.stock_status AS ENUM ('unassigned', 'assigned-tl', 'assigned-team', 'assigned-dsr', 'sold-paid', 'sold-unpaid');
CREATE TYPE public.payment_status AS ENUM ('paid', 'unpaid');
CREATE TYPE public.sale_type AS ENUM ('FS', 'DO', 'DVS');
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- ============================================================================
-- STEP 3: Create Tables
-- ============================================================================

-- Profiles table (user profiles linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  region_id UUID,
  is_approved BOOLEAN DEFAULT TRUE, -- Auto-approve all users initially
  approval_status approval_status DEFAULT 'approved',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'dsr',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Regions table
CREATE TABLE public.regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Managers table
CREATE TABLE public.managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Distribution Executives (DE) table
CREATE TABLE public.distribution_executives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team Leaders (TL) table
CREATE TABLE public.team_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  monthly_target INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TL Targets table
CREATE TABLE public.tl_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tl_id UUID REFERENCES public.team_leaders(id) ON DELETE CASCADE NOT NULL,
  target_month DATE NOT NULL,
  target_amount INTEGER NOT NULL DEFAULT 0,
  set_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tl_id, target_month)
);

-- Teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tl_id UUID REFERENCES public.team_leaders(id) ON DELETE SET NULL,
  captain_name TEXT,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DSRs (Direct Sales Representatives) table
CREATE TABLE public.dsrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  tl_id UUID REFERENCES public.team_leaders(id) ON DELETE SET NULL,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock batches table
CREATE TABLE public.stock_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock items table
CREATE TABLE public.stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id TEXT NOT NULL UNIQUE,
  smartcard_number TEXT,
  serial_number TEXT,
  type TEXT NOT NULL,
  batch_id UUID REFERENCES public.stock_batches(id) ON DELETE SET NULL,
  status stock_status DEFAULT 'unassigned',
  assigned_to_tl UUID REFERENCES public.team_leaders(id) ON DELETE SET NULL,
  assigned_to_team UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  assigned_to_dsr UUID REFERENCES public.dsrs(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES auth.users(id),
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  date_assigned TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales table
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id TEXT NOT NULL UNIQUE,
  stock_id UUID REFERENCES public.stock(id) ON DELETE SET NULL,
  dsr_id UUID REFERENCES public.dsrs(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  tl_id UUID REFERENCES public.team_leaders(id) ON DELETE SET NULL,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  smart_card_number TEXT NOT NULL,
  sn_number TEXT NOT NULL,
  payment_status payment_status DEFAULT 'unpaid',
  sale_type sale_type NOT NULL,
  is_virtual BOOLEAN DEFAULT FALSE,
  package_option TEXT DEFAULT 'no-package',
  dstv_package TEXT,
  sale_price DECIMAL(10,2) DEFAULT 0,
  tl_verified BOOLEAN DEFAULT FALSE,
  tl_verified_at TIMESTAMP WITH TIME ZONE,
  tl_verified_by UUID REFERENCES auth.users(id),
  admin_approved BOOLEAN DEFAULT FALSE,
  admin_approved_at TIMESTAMP WITH TIME ZONE,
  admin_approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Commissions table
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
  dsr_id UUID REFERENCES public.dsrs(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alerts table
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  entity_id UUID,
  entity_type TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 4: Create Helper Functions
-- ============================================================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = $1
    AND user_roles.role = 'admin'::app_role
  )
$$;

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, anon, service_role;

-- ============================================================================
-- STEP 5: Create Sequences
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.sale_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.stock_id_seq START 1;

-- ============================================================================
-- STEP 6: Create Triggers and Trigger Functions
-- ============================================================================

-- Trigger function for profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  requested_role app_role;
BEGIN
  -- Get the requested role from metadata, default to 'dsr'
  requested_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::app_role,
    'dsr'
  );

  -- Insert profile (auto-approve all users initially)
  INSERT INTO public.profiles (id, full_name, email, phone, region_id, is_approved, approval_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    (NEW.raw_user_meta_data->>'region_id')::UUID,
    TRUE,  -- Auto-approve all users
    'approved'::approval_status
  );
  
  -- Insert role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, requested_role);
  
  -- Create role-specific record
  IF requested_role = 'tl' THEN
    INSERT INTO public.team_leaders (user_id, region_id)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'region_id')::UUID);
  ELSIF requested_role = 'dsr' THEN
    INSERT INTO public.dsrs (user_id, region_id)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'region_id')::UUID);
  ELSIF requested_role = 'manager' THEN
    INSERT INTO public.managers (user_id, region_id)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'region_id')::UUID);
  ELSIF requested_role = 'de' THEN
    INSERT INTO public.distribution_executives (user_id, region_id)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'region_id')::UUID);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate sale ID
CREATE OR REPLACE FUNCTION public.generate_sale_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sale_id IS NULL OR NEW.sale_id = '' THEN
    NEW.sale_id := 'SL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('public.sale_id_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER generate_sale_id_trigger
  BEFORE INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.generate_sale_id();

-- Auto-generate stock ID
CREATE OR REPLACE FUNCTION public.generate_stock_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock_id IS NULL OR NEW.stock_id = '' THEN
    NEW.stock_id := 'STK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('public.stock_id_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER generate_stock_id_trigger
  BEFORE INSERT ON public.stock
  FOR EACH ROW EXECUTE FUNCTION public.generate_stock_id();

-- ============================================================================
-- STEP 7: Enable RLS on All Tables
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_executives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tl_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 8: Create RLS Policies (FIXED FOR 406 ERRORS)
-- ============================================================================

-- ========== Profiles Policies ==========
-- FIX: Allow users to view their own profile and admins to view all
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ========== User Roles Policies ==========
-- FIX: Allow users to view their own role and admins to view all
CREATE POLICY "user_roles_select_policy" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "user_roles_admin_policy" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ========== Regions Policies ==========
-- Allow everyone to view regions (needed for signup)
CREATE POLICY "regions_select_policy" ON public.regions
  FOR SELECT TO public, authenticated
  USING (is_active = TRUE);

CREATE POLICY "regions_admin_policy" ON public.regions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ========== Managers Policies ==========
CREATE POLICY "managers_select_policy" ON public.managers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "managers_admin_policy" ON public.managers
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ========== Distribution Executives Policies ==========
CREATE POLICY "des_select_policy" ON public.distribution_executives
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "des_admin_policy" ON public.distribution_executives
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ========== Team Leaders Policies ==========
CREATE POLICY "tls_select_policy" ON public.team_leaders
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "tls_admin_policy" ON public.team_leaders
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ========== TL Targets Policies ==========
CREATE POLICY "tl_targets_select_policy" ON public.tl_targets
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "tl_targets_manage_policy" ON public.tl_targets
  FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid()) 
    OR public.has_role(auth.uid(), 'manager')
    OR tl_id IN (SELECT id FROM public.team_leaders WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid()) 
    OR public.has_role(auth.uid(), 'manager')
  );

-- ========== Teams Policies ==========
CREATE POLICY "teams_select_policy" ON public.teams
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "teams_insert_policy" ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'tl') OR public.is_admin(auth.uid()));

CREATE POLICY "teams_update_policy" ON public.teams
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'tl') 
    OR public.is_admin(auth.uid())
    OR tl_id IN (SELECT id FROM public.team_leaders WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'tl') 
    OR public.is_admin(auth.uid())
    OR tl_id IN (SELECT id FROM public.team_leaders WHERE user_id = auth.uid())
  );

CREATE POLICY "teams_delete_policy" ON public.teams
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ========== DSRs Policies ==========
CREATE POLICY "dsrs_select_policy" ON public.dsrs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "dsrs_manage_policy" ON public.dsrs
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'tl') 
    OR public.is_admin(auth.uid())
    OR user_id = auth.uid()  -- Allow DSRs to see their own record
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'tl') 
    OR public.is_admin(auth.uid())
  );

-- ========== Stock Batches Policies ==========
CREATE POLICY "stock_batches_select_policy" ON public.stock_batches
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "stock_batches_admin_policy" ON public.stock_batches
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ========== Stock Policies ==========
CREATE POLICY "stock_select_policy" ON public.stock
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "stock_insert_policy" ON public.stock
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "stock_update_policy" ON public.stock
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid()) 
    OR public.has_role(auth.uid(), 'tl')
    OR public.has_role(auth.uid(), 'de')
    OR assigned_to_dsr IN (SELECT id FROM public.dsrs WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid()) 
    OR public.has_role(auth.uid(), 'tl')
    OR public.has_role(auth.uid(), 'de')
  );

CREATE POLICY "stock_delete_policy" ON public.stock
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ========== Sales Policies ==========
CREATE POLICY "sales_select_policy" ON public.sales
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "sales_insert_policy" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'dsr') 
    OR public.has_role(auth.uid(), 'tl') 
    OR public.is_admin(auth.uid())
    OR dsr_id IN (SELECT id FROM public.dsrs WHERE user_id = auth.uid())
  );

CREATE POLICY "sales_update_policy" ON public.sales
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid()) 
    OR public.has_role(auth.uid(), 'tl')
    OR dsr_id IN (SELECT id FROM public.dsrs WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid()) 
    OR public.has_role(auth.uid(), 'tl')
  );

CREATE POLICY "sales_delete_policy" ON public.sales
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ========== Commissions Policies ==========
CREATE POLICY "commissions_select_policy" ON public.commissions
  FOR SELECT TO authenticated
  USING (
    dsr_id IN (SELECT id FROM public.dsrs WHERE user_id = auth.uid()) 
    OR public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'tl')
    OR dsr_id IN (SELECT id FROM public.dsrs WHERE tl_id IN (SELECT id FROM public.team_leaders WHERE user_id = auth.uid()))
  );

CREATE POLICY "commissions_admin_policy" ON public.commissions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ========== Alerts Policies ==========
CREATE POLICY "alerts_select_policy" ON public.alerts
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR user_id IS NULL 
    OR public.is_admin(auth.uid())
    OR (entity_type = 'team' AND entity_id IN (SELECT id FROM public.teams WHERE tl_id IN (SELECT id FROM public.team_leaders WHERE user_id = auth.uid())))
  );

CREATE POLICY "alerts_admin_policy" ON public.alerts
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================================
-- STEP 9: Insert Default Data
-- ============================================================================

-- Insert default regions (Restricted to 3 regions)
INSERT INTO public.regions (name, code, is_active) VALUES
  ('Dar es Salaam', 'DSM', TRUE),
  ('Arusha', 'ARU', TRUE),
  ('Mwanza', 'MWZ', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- STEP 10: Create Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_region ON public.profiles(region_id);
CREATE INDEX IF NOT EXISTS idx_profiles_approval ON public.profiles(is_approved, approval_status);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_stock_status ON public.stock(status);
CREATE INDEX IF NOT EXISTS idx_stock_assigned_dsr ON public.stock(assigned_to_dsr);
CREATE INDEX IF NOT EXISTS idx_sales_dsr ON public.sales(dsr_id);
CREATE INDEX IF NOT EXISTS idx_sales_tl ON public.sales(tl_id);
CREATE INDEX IF NOT EXISTS idx_sales_region ON public.sales(region_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON public.sales(created_at);
CREATE INDEX IF NOT EXISTS idx_commissions_dsr ON public.commissions(dsr_id);
CREATE INDEX IF NOT EXISTS idx_commissions_paid ON public.commissions(is_paid);

-- ============================================================================
-- STEP 11: Grant Necessary Permissions
-- ============================================================================

-- Grant USAGE on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant all necessary permissions to service_role for auth handling
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant SELECT on public tables to authenticated users
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant limited permissions to anon users for signup
GRANT SELECT ON public.regions TO anon;
GRANT INSERT ON auth.users TO anon;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DATABASE REBUILD COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ All tables created successfully';
  RAISE NOTICE '✓ UUID functions fixed (gen_random_uuid)';
  RAISE NOTICE '✓ RLS policies configured for all roles';
  RAISE NOTICE '✓ Auto-approve enabled for new users';
  RAISE NOTICE '✓ Default regions inserted';
  RAISE NOTICE '✓ Permissions granted to all roles';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT NEXT STEPS:';
  RAISE NOTICE '1. Create an admin user through Auth UI';
  RAISE NOTICE '2. Run this SQL to set admin role:';
  RAISE NOTICE '   INSERT INTO user_roles (user_id, role)';
  RAISE NOTICE '   VALUES (''[ADMIN_USER_ID]'', ''admin'');';
  RAISE NOTICE '========================================';
END $$;