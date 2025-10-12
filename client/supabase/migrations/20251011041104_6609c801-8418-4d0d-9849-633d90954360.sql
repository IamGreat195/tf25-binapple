-- Create user roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Only admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create fields table
CREATE TABLE public.fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  polygon JSONB NOT NULL,
  area_hectares DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own fields"
ON public.fields FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all fields"
ON public.fields FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own fields"
ON public.fields FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fields"
ON public.fields FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fields"
ON public.fields FOR DELETE
USING (auth.uid() = user_id);

-- Create mission status enum
CREATE TYPE public.mission_status AS ENUM ('planned', 'running', 'paused', 'completed', 'aborted');

-- Create mission type enum
CREATE TYPE public.mission_type AS ENUM ('spraying', 'scouting', 'mapping', 'custom');

-- Create missions table
CREATE TABLE public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  field_id UUID REFERENCES public.fields(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  mission_type mission_type NOT NULL DEFAULT 'scouting',
  status mission_status NOT NULL DEFAULT 'planned',
  pathline JSONB NOT NULL,
  altitude_meters DECIMAL(6, 2) NOT NULL,
  speed_ms DECIMAL(6, 2) NOT NULL,
  area_covered_hectares DECIMAL(10, 2),
  duration_seconds INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own missions"
ON public.missions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all missions"
ON public.missions FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own missions"
ON public.missions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own missions"
ON public.missions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own missions"
ON public.missions FOR DELETE
USING (auth.uid() = user_id);

-- Create telemetry table
CREATE TABLE public.telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  altitude_meters DECIMAL(6, 2) NOT NULL,
  speed_ms DECIMAL(6, 2) NOT NULL,
  battery_percent INTEGER NOT NULL CHECK (battery_percent >= 0 AND battery_percent <= 100),
  timestamp TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view telemetry for their missions"
ON public.telemetry FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.missions
    WHERE missions.id = telemetry.mission_id
    AND missions.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all telemetry"
ON public.telemetry FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Create alerts table
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
  alert_type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alerts for their missions"
ON public.alerts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.missions
    WHERE missions.id = alerts.mission_id
    AND missions.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all alerts"
ON public.alerts FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for critical tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.missions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.telemetry;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;

-- Set replica identity for realtime
ALTER TABLE public.missions REPLICA IDENTITY FULL;
ALTER TABLE public.telemetry REPLICA IDENTITY FULL;
ALTER TABLE public.alerts REPLICA IDENTITY FULL;

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_fields_updated_at
  BEFORE UPDATE ON public.fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_missions_updated_at
  BEFORE UPDATE ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();