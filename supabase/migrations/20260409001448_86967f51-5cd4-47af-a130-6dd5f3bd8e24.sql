
-- Invitations table for coach invite system
CREATE TABLE public.organization_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'coach',
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, email)
);

ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- Admins can manage invites for their org
CREATE POLICY "Admins can manage org invites"
  ON public.organization_invites FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), organization_id, 'admin'::app_role));

-- Authenticated users can view invites sent to their email
CREATE POLICY "Users can view their invites"
  ON public.organization_invites FOR SELECT
  TO authenticated
  USING (lower(email) = lower(auth.jwt()->>'email'));

-- Authenticated users can accept invites sent to them
CREATE POLICY "Users can accept their invites"
  ON public.organization_invites FOR UPDATE
  TO authenticated
  USING (lower(email) = lower(auth.jwt()->>'email'));

-- Timestamp trigger
CREATE TRIGGER update_organization_invites_updated_at
  BEFORE UPDATE ON public.organization_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
