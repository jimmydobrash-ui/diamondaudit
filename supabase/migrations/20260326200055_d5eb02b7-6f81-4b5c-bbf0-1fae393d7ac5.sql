
CREATE TYPE public.player_grade AS ENUM ('offer', 'bubble', 'pass');

CREATE TABLE public.player_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  grade player_grade NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id, coach_id)
);

ALTER TABLE public.player_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org grades" ON public.player_grades
  FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Coaches can insert own grades" ON public.player_grades
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = coach_id AND is_org_member(auth.uid(), organization_id));

CREATE POLICY "Coaches can update own grades" ON public.player_grades
  FOR UPDATE TO authenticated
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches can delete own grades" ON public.player_grades
  FOR DELETE TO authenticated
  USING (auth.uid() = coach_id);

CREATE TRIGGER update_player_grades_updated_at
  BEFORE UPDATE ON public.player_grades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
