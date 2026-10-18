-- Optional photo/logo per college (file lives in STORAGE_DIR/colleges/<college_id>/<timestamp>.<ext>, public-read).
alter table public.colleges add column if not exists logo_path text;
