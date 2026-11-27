-- UI ParkSense V4.9.1 — realtime berita tanpa membocorkan draft.
-- Jalankan sesudah SQL 17. Aman untuk diulang.
-- TIDAK mengubah kapasitas, riwayat kendaraan, akun, atau izin petugas.
-- Hanya mengirim notifikasi revisi (angka), bukan isi berita pribadi.
BEGIN;

CREATE TABLE IF NOT EXISTS public.parking_news_signal (
  id smallint PRIMARY KEY CHECK (id=1),
  revision bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.parking_news_signal(id,revision)
VALUES (1,0)
ON CONFLICT(id) DO NOTHING;

ALTER TABLE public.parking_news_signal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parking_news_signal FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.parking_news_signal TO anon, authenticated;
DROP POLICY IF EXISTS parksense_news_signal_public_read ON public.parking_news_signal;
CREATE POLICY parksense_news_signal_public_read ON public.parking_news_signal
 FOR SELECT TO anon, authenticated USING (true);

-- Penting: sinyal dikirim juga ketika berita TERBIT diarsipkan,
-- karena pelanggan publik tidak boleh melihat isi baris arsip/draft.
CREATE OR REPLACE FUNCTION parksense_internal.notify_public_news_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE relevant boolean := false;
BEGIN
  IF TG_OP='INSERT' THEN
    relevant := NEW.status='published';
  ELSIF TG_OP='UPDATE' THEN
    relevant := (OLD.status='published' OR NEW.status='published');
  ELSIF TG_OP='DELETE' THEN
    relevant := OLD.status='published';
  END IF;
  IF relevant THEN
    INSERT INTO public.parking_news_signal(id,revision,updated_at)
      VALUES (1,1,now())
    ON CONFLICT(id) DO UPDATE
      SET revision=public.parking_news_signal.revision+1,
          updated_at=now();
  END IF;
  RETURN NULL; -- AFTER ROW trigger ignores return value.
END;
$$;
REVOKE ALL ON FUNCTION parksense_internal.notify_public_news_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_parksense_public_news_signal ON public.parking_announcements;
CREATE TRIGGER trg_parksense_public_news_signal
AFTER INSERT OR UPDATE OR DELETE ON public.parking_announcements
FOR EACH ROW EXECUTE FUNCTION parksense_internal.notify_public_news_change();

-- Supabase Realtime hanya menangkap tabel yang masuk publication.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    RAISE EXCEPTION 'Publication supabase_realtime tidak ditemukan. Periksa pengaturan project.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public' AND tablename='parking_news_signal'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.parking_news_signal;
  END IF;
END;
$$;

COMMIT;

-- PEMERIKSAAN READ-ONLY. Diharapkan semua bernilai true, revision awal 0.
SELECT
 EXISTS(SELECT 1 FROM pg_publication_tables
  WHERE pubname='supabase_realtime' AND schemaname='public'
  AND tablename='parking_news_signal') AS realtime_sinyal_aktif,
 has_table_privilege('anon','public.parking_news_signal','SELECT') AS tamu_boleh_terima_sinyal,
 NOT has_table_privilege('anon','public.parking_news_signal','INSERT') AS tamu_dilarang_kirim_sinyal,
 (SELECT revision FROM public.parking_news_signal WHERE id=1) AS revision_sekarang;
