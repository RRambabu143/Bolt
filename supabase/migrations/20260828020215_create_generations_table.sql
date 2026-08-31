/*
# Create generations table and storage buckets

1. New Tables
- `generations`
  - `id` (uuid, primary key, auto-generated)
  - `user_id` (uuid, not null, defaults to authenticated user, references auth.users with cascade delete)
  - `type` (text, not null — 'text', 'image', or 'video')
  - `prompt` (text, not null)
  - `provider` (text — 'google', 'anthropic', 'demo')
  - `model` (text — model name used)
  - `status` (text, not null, default 'queued' — 'queued', 'processing', 'completed', 'failed')
  - `result_url` (text — URL to generated asset or text content)
  - `result_text` (text — for text generations, the generated text content)
  - `metadata` (jsonb, default '{}' — stores settings, aspect ratio, etc.)
  - `error_message` (text — error details if status is 'failed')
  - `favorite` (boolean, default false)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Storage Buckets
- `generated-images` (public bucket for image outputs)
- `generated-videos` (public bucket for video outputs)

3. Security
- Enable RLS on `generations`.
- Owner-scoped CRUD: each authenticated user can only access rows they own.
- Storage policies: authenticated users can upload to their own folder, public can read.
- `user_id` defaults to `auth.uid()` so inserts that omit it still satisfy the WITH CHECK.

4. Indexes
- Index on `user_id` for fast per-user queries.
- Index on `created_at` DESC for history listing.
- Index on `type` for filtering by generation type.
*/

CREATE TABLE IF NOT EXISTS generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('text', 'image', 'video')),
  prompt text NOT NULL,
  provider text,
  model text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  result_url text,
  result_text text,
  metadata jsonb DEFAULT '{}'::jsonb,
  error_message text,
  favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_generations" ON generations;
CREATE POLICY "select_own_generations" ON generations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_generations" ON generations;
CREATE POLICY "insert_own_generations" ON generations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_generations" ON generations;
CREATE POLICY "update_own_generations" ON generations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_generations" ON generations;
CREATE POLICY "delete_own_generations" ON generations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_type ON generations(type);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generations_updated_at ON generations;
CREATE TRIGGER trg_generations_updated_at
  BEFORE UPDATE ON generations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-images', 'generated-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-videos', 'generated-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload to their own folder
DROP POLICY IF EXISTS "auth_upload_images" ON storage.objects;
CREATE POLICY "auth_upload_images" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'generated-images' AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "auth_upload_videos" ON storage.objects;
CREATE POLICY "auth_upload_videos" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'generated-videos' AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public read for generated media
DROP POLICY IF EXISTS "public_read_images" ON storage.objects;
CREATE POLICY "public_read_images" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'generated-images');

DROP POLICY IF EXISTS "public_read_videos" ON storage.objects;
CREATE POLICY "public_read_videos" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'generated-videos');

-- Authenticated users can delete their own media
DROP POLICY IF EXISTS "auth_delete_images" ON storage.objects;
CREATE POLICY "auth_delete_images" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'generated-images' AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "auth_delete_videos" ON storage.objects;
CREATE POLICY "auth_delete_videos" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'generated-videos' AND auth.uid()::text = (storage.foldername(name))[1]
  );