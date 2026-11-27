-- UI ParkSense V4.9 | 17_INFO_PARKIR_BERITA_RLS_DAN_STORAGE.sql
-- Jalankan SEKALI di Supabase SQL Editor sebagai pemilik project.
-- Tidak mengubah parking_zones, parking_assignments, akun, kapasitas, atau hitungan kendaraan.
-- Jika ada tabel parking_announcements buatan sendiri, TINJAU dulu struktur dan kebijakannya.
BEGIN;

-- 1. Helper otorisasi TIDAK membaca tabel assignments memakai hak anon.
CREATE SCHEMA IF NOT EXISTS parksense_internal;
REVOKE ALL ON SCHEMA parksense_internal FROM PUBLIC;
GRANT USAGE ON SCHEMA parksense_internal TO authenticated;

CREATE OR REPLACE FUNCTION parksense_internal.news_can_manage(p_zone_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT auth.uid() IS NOT NULL
   AND EXISTS (
     SELECT 1
     FROM public.parking_assignments a
     JOIN public.parking_zones z ON z.id = a.zone_id
     WHERE a.user_id = auth.uid()
       AND a.zone_id = p_zone_id
       AND z.public_visible IS TRUE
       -- Cegah publikasi lewat zona gabungan lama bila sudah ada zona rinci.
       AND NOT EXISTS (
         SELECT 1 FROM public.parking_zones child
         WHERE child.code LIKE z.code || '-%'
           AND child.id <> z.id
       )
   );
$$;
REVOKE ALL ON FUNCTION parksense_internal.news_can_manage(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION parksense_internal.news_can_manage(uuid) TO authenticated;

-- 2. Tabel berita — kapasitas & occupancy tidak ikut diubah.
CREATE TABLE IF NOT EXISTS public.parking_announcements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 zone_id uuid NOT NULL REFERENCES public.parking_zones(id),
 zone_code text NOT NULL,
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 8 AND 100),
 summary text NOT NULL DEFAULT '' CHECK (char_length(summary) <= 200),
 body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 20 AND 3000),
 category text NOT NULL CHECK (category IN ('Penutupan','Renovasi','Jam operasional','Pengumuman')),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
 image_path text,
 expires_at timestamptz,
 published_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT news_image_path_format CHECK (
   image_path IS NULL OR image_path ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
 )
);
CREATE INDEX IF NOT EXISTS idx_parksense_news_public ON public.parking_announcements(status,published_at DESC);
CREATE INDEX IF NOT EXISTS idx_parksense_news_zone ON public.parking_announcements(zone_id,updated_at DESC);

-- 3. Trigger: zona, author, tanggal, dan status publikasi ditentukan server.
CREATE OR REPLACE FUNCTION parksense_internal.news_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_user uuid := auth.uid(); v_code text;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Login petugas diperlukan.'; END IF;
 IF TG_OP = 'UPDATE' THEN
   IF NEW.zone_id IS DISTINCT FROM OLD.zone_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Zona, identitas pembuat, dan ID berita tidak dapat diganti.';
   END IF;
 END IF;
 IF NOT parksense_internal.news_can_manage(NEW.zone_id) THEN
   RAISE EXCEPTION 'Anda tidak ditugaskan ke zona ini.';
 END IF;
 SELECT z.code INTO v_code FROM public.parking_zones z WHERE z.id=NEW.zone_id;
 IF v_code IS NULL THEN RAISE EXCEPTION 'Zona tidak ditemukan.'; END IF;
 NEW.zone_code := v_code;
 NEW.title := btrim(NEW.title);
 NEW.summary := btrim(coalesce(NEW.summary,''));
 NEW.body := btrim(NEW.body);
 IF NEW.image_path IS NOT NULL THEN
   IF NEW.image_path !~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$' THEN
      RAISE EXCEPTION 'Path gambar tidak valid.';
   END IF;
   -- Jangan izinkan mengganti gambar dengan unggahan akun lain.
   IF TG_OP = 'INSERT' THEN
     IF split_part(NEW.image_path,'/',1) <> v_user::text THEN
       RAISE EXCEPTION 'Gambar harus berasal dari folder akun petugas.';
     END IF;
   ELSIF NEW.image_path IS DISTINCT FROM OLD.image_path THEN
     IF split_part(NEW.image_path,'/',1) <> v_user::text THEN
       RAISE EXCEPTION 'Gambar harus berasal dari folder akun petugas.';
     END IF;
   END IF;
 END IF;
 IF NEW.status='published' THEN
   IF NEW.expires_at IS NOT NULL AND NEW.expires_at <= now() THEN
     RAISE EXCEPTION 'Waktu selesai pengumuman harus di masa depan.';
   END IF;
   IF TG_OP='INSERT' THEN
     NEW.published_at := now();
   ELSIF OLD.status IS DISTINCT FROM 'published' OR OLD.published_at IS NULL THEN
     NEW.published_at := now();
   ELSE
     NEW.published_at := OLD.published_at;
   END IF;
 ELSE
   IF TG_OP='INSERT' THEN NEW.published_at := NULL; END IF;
 END IF;
 IF TG_OP='INSERT' THEN
   NEW.created_by := v_user;
   NEW.created_at := now();
 END IF;
 NEW.updated_by := v_user;
 NEW.updated_at := now();
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION parksense_internal.news_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_parksense_news_guard ON public.parking_announcements;
CREATE TRIGGER trg_parksense_news_guard BEFORE INSERT OR UPDATE ON public.parking_announcements
FOR EACH ROW EXECUTE FUNCTION parksense_internal.news_guard();

-- 4. RLS: anon hanya dapat melihat berita yang benar-benar published & belum kedaluwarsa.
ALTER TABLE public.parking_announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.parking_announcements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.parking_announcements TO anon,authenticated;
-- Hanya kolom form yang boleh diisi/diedit petugas. Tidak ada GRANT DELETE.
GRANT INSERT(zone_id,title,summary,body,category,status,image_path,expires_at)
 ON public.parking_announcements TO authenticated;
GRANT UPDATE(title,summary,body,category,status,image_path,expires_at)
 ON public.parking_announcements TO authenticated;

DROP POLICY IF EXISTS parksense_news_public_read ON public.parking_announcements;
CREATE POLICY parksense_news_public_read ON public.parking_announcements
FOR SELECT TO anon,authenticated
USING (status='published' AND published_at <= now()
   AND (expires_at IS NULL OR expires_at > now()));

DROP POLICY IF EXISTS parksense_news_attendant_read ON public.parking_announcements;
CREATE POLICY parksense_news_attendant_read ON public.parking_announcements
FOR SELECT TO authenticated
USING (parksense_internal.news_can_manage(zone_id));

DROP POLICY IF EXISTS parksense_news_attendant_insert ON public.parking_announcements;
CREATE POLICY parksense_news_attendant_insert ON public.parking_announcements
FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND parksense_internal.news_can_manage(zone_id));

DROP POLICY IF EXISTS parksense_news_attendant_update ON public.parking_announcements;
CREATE POLICY parksense_news_attendant_update ON public.parking_announcements
FOR UPDATE TO authenticated
USING (parksense_internal.news_can_manage(zone_id))
WITH CHECK (parksense_internal.news_can_manage(zone_id));


CREATE OR REPLACE FUNCTION parksense_internal.news_has_any_zone()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.parking_assignments a
   JOIN public.parking_zones z ON z.id = a.zone_id
   WHERE a.user_id=auth.uid() AND z.public_visible IS TRUE
   AND NOT EXISTS (SELECT 1 FROM public.parking_zones sub
                   WHERE sub.code LIKE z.code || '-%' AND sub.id<>z.id)
 );
$$;
REVOKE ALL ON FUNCTION parksense_internal.news_has_any_zone() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION parksense_internal.news_has_any_zone() TO authenticated;

-- 5. Bucket GAMBAR PUBLIK. File gambar secara teknis bisa dibuka jika URL-nya diketahui;
-- jangan unggah informasi sensitif atau foto pribadi tanpa izin.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('parksense-announcements','parksense-announcements',true,5242880,
 ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Jangan memberi anon/authenticated izin untuk UPDATE/DELETE storage.objects.
-- Nama path: <auth.uid()>/<UUID>.<jpg|png|webp>
DROP POLICY IF EXISTS parksense_news_image_insert ON storage.objects;
CREATE POLICY parksense_news_image_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
 bucket_id='parksense-announcements'
 AND owner_id=(select auth.uid()::text)
 AND (storage.foldername(name))[1]=(select auth.uid()::text)
 AND (storage.extension(name)) IN ('jpg','jpeg','png','webp')
 AND parksense_internal.news_has_any_zone()
);

COMMIT;

-- HASIL PEMERIKSAAN (tidak mengubah data)
SELECT
  (SELECT count(*) FROM public.parking_announcements) AS total_berita,
  has_table_privilege('anon','public.parking_announcements','SELECT') AS guest_dapat_baca_berita,
  has_table_privilege('anon','public.parking_announcements','INSERT') AS guest_bisa_posting_harus_false,
  has_table_privilege('authenticated','public.parking_announcements','UPDATE') AS petugas_bisa_edit_terbatas;
