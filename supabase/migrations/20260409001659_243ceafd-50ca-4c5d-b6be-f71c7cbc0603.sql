
-- Admins can delete all grades in their org (for data reset)
CREATE POLICY "Admins can delete org grades"
  ON public.player_grades FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), organization_id, 'admin'::app_role));

-- Admins can delete org invites
CREATE POLICY "Admins can delete org invites"
  ON public.organization_invites FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), organization_id, 'admin'::app_role));
