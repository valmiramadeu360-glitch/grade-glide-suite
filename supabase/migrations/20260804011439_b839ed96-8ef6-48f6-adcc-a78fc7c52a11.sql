CREATE POLICY "campus_maps_readable_by_authenticated"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'campus-media'
  AND (storage.foldername(name))[1] = 'campus-maps'
);