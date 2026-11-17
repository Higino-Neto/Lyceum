-- Device sync: books sent between a user's devices and the vocabulary snapshot
-- shared by desktop and mobile. Everything lives in one private Storage bucket,
-- under a top-level folder named after the owner's auth uid:
--
--   <uid>/books/<sentAt>_<platform>_<nonce>__<file name>   books waiting on other devices
--   <uid>/learning/vocabulary.json                          merged vocabulary snapshot
--
-- Only the owner can list, read, write or delete objects in their folder.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('device-sync', 'device-sync', false, 524288000)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "device_sync_select_own" ON storage.objects;
DROP POLICY IF EXISTS "device_sync_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "device_sync_update_own" ON storage.objects;
DROP POLICY IF EXISTS "device_sync_delete_own" ON storage.objects;

CREATE POLICY "device_sync_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'device-sync' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "device_sync_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'device-sync' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "device_sync_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'device-sync' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'device-sync' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "device_sync_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'device-sync' AND (storage.foldername(name))[1] = auth.uid()::text);
