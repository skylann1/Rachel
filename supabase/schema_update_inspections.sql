-- ==============================================================================
-- SIPERMIT K3 SUPABASE SCHEMA UPDATE: ADVANCED INSPECTIONS
-- ==============================================================================

-- 1. Modify the Inspections Table
ALTER TABLE public.inspections
ADD COLUMN IF NOT EXISTS is_project_activity BOOLEAN DEFAULT true;

-- For Disposisi feature (Delegation)
ALTER TABLE public.inspections
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.internal_profiles(id);

-- Make project_id nullable if it wasn't already (in Supabase usually REFERENCES doesn't imply NOT NULL, but just to be sure)
ALTER TABLE public.inspections ALTER COLUMN project_id DROP NOT NULL;

-- 2. Create Inspection Logs Table for History
CREATE TABLE IF NOT EXISTS public.inspection_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID REFERENCES public.inspections(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL, -- e.g., 'Reported', 'Status Changed to In Progress', 'Delegated to ...'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.inspection_logs ENABLE ROW LEVEL SECURITY;

-- Inspection Logs Policies
CREATE POLICY "Users can read all inspection logs" 
ON public.inspection_logs FOR SELECT 
USING (true); -- simplified for MVP

CREATE POLICY "Users can insert inspection logs" 
ON public.inspection_logs FOR INSERT 
WITH CHECK (true); -- simplified for MVP

-- ==============================================================================
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR
-- ==============================================================================

-- 3. Add assigned_inspector to Projects for Monitoring Task delegation
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS assigned_inspector UUID REFERENCES public.internal_profiles(id);

-- ==============================================================================
-- 4. NOTIFICATIONS TABLE (Real Inbox)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL DEFAULT 'system',  -- 'approval', 'action_required', 'warning', 'system', 'info'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,                             -- URL to navigate when clicked
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "Users can read own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- System can insert notifications for any user
CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);
