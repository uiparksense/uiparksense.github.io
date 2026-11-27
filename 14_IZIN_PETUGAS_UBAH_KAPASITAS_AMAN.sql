-- UI ParkSense V4.4 | Fitur 1: kapasitas dapat diperbarui dari Dashboard Petugas.
-- JALANKAN SATU KALI melalui Supabase SQL Editor di project UI ParkSense.
-- Perintah ini tidak mengubah kapasitas/okupansi/aktivasi yang sudah ada.
-- Backup dan audit: setiap perubahan setelah ini disimpan pada parking_capacity_changes.
-- Pastikan schema dan tabelnya memang seperti V4.3 sebelum menjalankan.

BEGIN;

-- Fail-closed: jangan instal di struktur proyek yang berbeda.
DO $$
BEGIN
  IF to_regclass('public.parking_zones') IS NULL OR
     to_regclass('public.parking_assignments') IS NULL THEN
    RAISE EXCEPTION 'Tabel ParkSense tidak ditemukan. Batalkan migrasi.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='parking_zones'
      AND column_name='public_visible'
  ) THEN
    RAISE EXCEPTION 'Kolom public_visible tidak ditemukan. Batalkan migrasi.';
  END IF;
END;
$$;

-- Audit khusus; web Guest dan petugas tidak diberikan hak akses langsung.
CREATE TABLE IF NOT EXISTS public.parking_capacity_changes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  zone_id uuid NOT NULL REFERENCES public.parking_zones(id),
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  old_motor_capacity integer NOT NULL,
  new_motor_capacity integer NOT NULL,
  old_car_capacity integer NOT NULL,
  new_car_capacity integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parksense_capacity_reason_not_blank CHECK (char_length(btrim(reason)) BETWEEN 10 AND 500)
);
CREATE INDEX IF NOT EXISTS parking_capacity_changes_zone_date_idx
 ON public.parking_capacity_changes(zone_id, created_at DESC);
ALTER TABLE public.parking_capacity_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parking_capacity_changes FROM PUBLIC, anon, authenticated;

-- Tidak ada GRANT UPDATE umum pada parking_zones.
-- Semua update lewat RPC yang memeriksa auth.uid() dan parking_assignments.
CREATE OR REPLACE FUNCTION public.parksense_update_zone_capacity(
  p_zone_id uuid,
  p_motor_capacity integer,
  p_car_capacity integer,
  p_reason text
)
RETURNS public.parking_zones
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_zone public.parking_zones%rowtype;
  v_updated public.parking_zones%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Silakan login sebagai petugas.';
  END IF;
  IF p_zone_id IS NULL THEN
    RAISE EXCEPTION 'ID zona tidak boleh kosong.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.parking_assignments a
    WHERE a.user_id=v_user AND a.zone_id=p_zone_id
  ) THEN
    RAISE EXCEPTION 'Akun ini tidak ditugaskan ke zona tersebut.';
  END IF;

  -- Konsisten dengan apply_parking_event: kunci baris sebelum validasi + update.
  SELECT * INTO v_zone
  FROM public.parking_zones
  WHERE id=p_zone_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Zona parkir tidak ditemukan.';
  END IF;

  -- Jangan mengubah zona gabungan/arsip yang tersembunyi.
  IF v_zone.public_visible IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Zona tersembunyi/arsip tidak bisa diubah melalui Dashboard Petugas.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.parking_zones subzone
    WHERE subzone.code LIKE v_zone.code || '-%'
      AND subzone.id <> v_zone.id
  ) THEN
    RAISE EXCEPTION 'Zona gabungan lama memiliki zona rincian. Ubah kapasitas per zona rincian.';
  END IF;

  IF p_motor_capacity IS NULL OR p_car_capacity IS NULL
     OR p_motor_capacity < 0 OR p_car_capacity < 0
     OR p_motor_capacity > 100000 OR p_car_capacity > 100000 THEN
    RAISE EXCEPTION 'Kapasitas harus bilangan bulat antara 0 dan 100000.';
  END IF;
  IF char_length(v_reason) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Isi alasan perubahan (10 sampai 500 karakter).';
  END IF;

  -- Tidak dapat menambah jenis kendaraan baru tanpa verifikasi struktur zona.
  IF (v_zone.motor_capacity = 0 AND p_motor_capacity <> 0)
      OR (v_zone.car_capacity = 0 AND p_car_capacity <> 0)
      OR (v_zone.motor_capacity > 0 AND p_motor_capacity = 0)
      OR (v_zone.car_capacity > 0 AND p_car_capacity = 0) THEN
    RAISE EXCEPTION 'Perubahan jenis kendaraan aktif/tidak aktif perlu persetujuan pengelola.';
  END IF;

  -- Occupied mungkin berisi 0 teknis untuk zona yang belum diinisialisasi;
  -- status operasional dan counts_initialized TIDAK disentuh oleh fungsi ini.
  IF p_motor_capacity < coalesce(v_zone.motor_occupied,0)
     OR p_car_capacity < coalesce(v_zone.car_occupied,0) THEN
    RAISE EXCEPTION 'Kapasitas baru tidak boleh lebih kecil dari jumlah kendaraan terisi.';
  END IF;
  IF p_motor_capacity=v_zone.motor_capacity AND p_car_capacity=v_zone.car_capacity THEN
    RETURN v_zone;
  END IF;

  UPDATE public.parking_zones
  SET motor_capacity=p_motor_capacity,
      car_capacity=p_car_capacity,
      updated_at=now()
  WHERE id=p_zone_id
  RETURNING * INTO v_updated;

  INSERT INTO public.parking_capacity_changes(
    zone_id, changed_by,
    old_motor_capacity, new_motor_capacity,
    old_car_capacity, new_car_capacity,
    reason
  ) VALUES (
    p_zone_id, v_user,
    v_zone.motor_capacity, p_motor_capacity,
    v_zone.car_capacity, p_car_capacity,
    v_reason
  );
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.parksense_update_zone_capacity(uuid,integer,integer,text)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parksense_update_zone_capacity(uuid,integer,integer,text)
 TO authenticated;

COMMIT;

-- Verifikasi izin (diharapkan TRUE untuk authenticated, FALSE untuk anon).
SELECT
  has_function_privilege('authenticated',
    'public.parksense_update_zone_capacity(uuid,integer,integer,text)','EXECUTE') AS petugas_bisa_panggil,
  has_function_privilege('anon',
    'public.parksense_update_zone_capacity(uuid,integer,integer,text)','EXECUTE') AS guest_bisa_panggil;

-- Lihat catatan perubahan kapasitas setelah petugas mengedit:
-- SELECT z.code, a.old_motor_capacity, a.new_motor_capacity,
--        a.old_car_capacity, a.new_car_capacity, a.reason, a.created_at
-- FROM public.parking_capacity_changes a
-- JOIN public.parking_zones z ON z.id=a.zone_id
-- ORDER BY a.created_at DESC LIMIT 30;
