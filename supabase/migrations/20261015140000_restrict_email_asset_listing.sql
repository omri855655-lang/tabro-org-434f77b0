-- The public logo URL remains public; storage catalog enumeration is admin-only.
DROP POLICY IF EXISTS "Email assets are publicly accessible" ON storage.objects;
CREATE POLICY "Admins can list email assets"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));
