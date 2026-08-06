ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS audio_duration integer;

ALTER TABLE public.direct_messages ALTER COLUMN content SET DEFAULT '';

DROP POLICY IF EXISTS "chat_audio_insert_own_folder" ON storage.objects;
CREATE POLICY "chat_audio_insert_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-audio' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "chat_audio_delete_own_folder" ON storage.objects;
CREATE POLICY "chat_audio_delete_own_folder" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-audio' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "chat_audio_select_participants" ON storage.objects;
CREATE POLICY "chat_audio_select_participants" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-audio' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.direct_messages dm
        WHERE dm.audio_url = storage.objects.name
          AND (dm.sender_id = auth.uid() OR dm.receiver_id = auth.uid())
      )
    )
  );