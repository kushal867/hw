-- Programs differ in how their terms are called: most use semesters, TU's BBS runs in yearly terms.
alter table public.courses add column if not exists term_label text not null default 'Semester' check (term_label in ('Semester', 'Year'));
update public.courses set term_label = 'Year' where slug = 'bbs';

-- Expose the label through the public view (new column appended at the end so create-or-replace is allowed).
create or replace view public.public_notes as
select d.id, d.title, d.description, d.tags, d.category, d.size_bytes, d.published_at,
       s.id as subject_id, s.name as subject_name,
       sem.id as semester_id, sem.semester_number,
       c.id as course_id, c.name as course_name, c.slug as course_slug,
       col.id as college_id, col.name as college_name, col.slug as college_slug,
       p.display_name as uploader_name,
       c.term_label as term_label
from documents d
join semesters sem on sem.id = d.semester_id
join courses c on c.id = sem.course_id
join colleges col on col.id = c.college_id
join profiles p on p.id = d.uploaded_by
left join subjects s on s.id = d.subject_id
where d.visibility = 'public' and d.moderation_status = 'approved';
