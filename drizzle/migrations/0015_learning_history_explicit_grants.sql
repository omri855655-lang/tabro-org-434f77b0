-- Override inherited default grants as well as the table's explicit grants.
REVOKE ALL ON public.zoneflow_learning_history FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.zoneflow_learning_history TO authenticated;
