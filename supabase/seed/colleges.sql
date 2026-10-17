-- Seed: Nepali colleges, programs, semesters and starter subjects. Idempotent: safe to re-run.
-- Run as the database owner (psql as postgres): RLS blocks other roles from writing these tables.
-- Subject lists were summarised from public campus pages and must be verified against the official TU syllabus.

-- 1) Colleges (slug = lowercase name + city, same rule the admin UI uses)
insert into colleges (name, city, slug, country) values
  ('Amrit Science Campus',                    'Kathmandu', 'amrit-science-campus-kathmandu', 'NP'),
  ('Patan Multiple Campus',                   'Lalitpur',  'patan-multiple-campus-lalitpur', 'NP'),
  ('Bhaktapur Multiple Campus',               'Bhaktapur', 'bhaktapur-multiple-campus-bhaktapur', 'NP'),
  ('St. Xavier''s College',                   'Kathmandu', 'st-xavier-s-college-kathmandu', 'NP'),
  ('Shanker Dev Campus',                      'Kathmandu', 'shanker-dev-campus-kathmandu', 'NP'),
  ('Orchid International College',            'Kathmandu', 'orchid-international-college-kathmandu', 'NP'),
  ('Kantipur College of Management & IT',     'Kathmandu', 'kantipur-college-of-management-it-kathmandu', 'NP'),
  ('Asian School of Management & Technology', 'Kathmandu', 'asian-school-of-management-technology-kathmandu', 'NP'),
  ('Thames International College',            'Kathmandu', 'thames-international-college-kathmandu', 'NP'),
  ('Public Youth Campus',                     'Kathmandu', 'public-youth-campus-kathmandu', 'NP'),
  ('K and K International College',           'Kathmandu', 'k-and-k-international-college-kathmandu', 'NP'),
  ('College of Applied Business and Technology', 'Kathmandu', 'college-of-applied-business-and-technology-kathmandu', 'NP')
on conflict do nothing;

-- 2) Courses offered per college
with offer(college_slug, course, slug) as (values
  ('amrit-science-campus-kathmandu', 'BIT', 'bit'),
  ('patan-multiple-campus-lalitpur', 'BIT', 'bit'),
  ('bhaktapur-multiple-campus-bhaktapur', 'BIT', 'bit'),
  ('st-xavier-s-college-kathmandu', 'BIM', 'bim'),
  ('shanker-dev-campus-kathmandu', 'BIM', 'bim'),
  ('orchid-international-college-kathmandu', 'BIM', 'bim'),
  ('orchid-international-college-kathmandu', 'BBS', 'bbs'),
  ('kantipur-college-of-management-it-kathmandu', 'BIM', 'bim'),
  ('kantipur-college-of-management-it-kathmandu', 'BBA', 'bba'),
  ('asian-school-of-management-technology-kathmandu', 'BCA', 'bca'),
  ('asian-school-of-management-technology-kathmandu', 'BIM', 'bim'),
  ('thames-international-college-kathmandu', 'BCA', 'bca'),
  ('thames-international-college-kathmandu', 'BIM', 'bim'),
  ('public-youth-campus-kathmandu', 'BBS', 'bbs'),
  ('k-and-k-international-college-kathmandu', 'BBS', 'bbs'),
  ('k-and-k-international-college-kathmandu', 'BBA', 'bba'),
  ('college-of-applied-business-and-technology-kathmandu', 'BIM', 'bim'))
insert into courses (college_id, name, slug, degree_level)
select c.id, o.course, o.slug, 'Bachelor' from offer o join colleges c on c.slug = o.college_slug
on conflict do nothing;

-- 3) Semesters 1-8 for the 8-semester programs (BIT, BCA, BIM, BBA). BBS (TU) runs in yearly terms: none created.
insert into semesters (course_id, semester_number)
select c.id, n from courses c cross join generate_series(1, 8) n
where c.slug in ('bit', 'bca', 'bim', 'bba')
  and not exists (select 1 from semesters s where s.course_id = c.id and s.semester_number = n);

-- 4) Starter subjects (same TU syllabus at every college offering the program)
with subj(course_slug, sem, name, code) as (values
  ('bit', 1, 'IT Fundamentals', null), ('bit', 1, 'C Programming', null), ('bit', 1, 'Digital Logic', null),
  ('bit', 1, 'Mathematics I', null), ('bit', 1, 'Technical English', null),
  ('bit', 2, 'Object Oriented Programming', null), ('bit', 2, 'Discrete Structures', null), ('bit', 2, 'Computer Organization', null),
  ('bit', 2, 'Mathematics II', null), ('bit', 2, 'Sociology', null),
  ('bit', 3, 'Data Structures and Algorithms', null), ('bit', 3, 'Database Management System', null), ('bit', 3, 'Operating Systems', null),
  ('bit', 3, 'Numerical Methods', null), ('bit', 3, 'Principles of Management', null),
  ('bit', 4, 'Web Technology', null), ('bit', 4, 'Microprocessors and Interfacing', null), ('bit', 4, 'Software Engineering', null),
  ('bit', 4, 'Computer Networks', null), ('bit', 4, 'Data Communication', null),
  ('bca', 1, 'Computer Fundamentals and Applications', 'CACS101'), ('bca', 1, 'Society and Technology', null),
  ('bca', 1, 'English I', null), ('bca', 1, 'Mathematics I', null), ('bca', 1, 'Digital Logic', 'CACS105'))
insert into subjects (semester_id, name, code)
select s.id, v.name, v.code
from subj v
join courses c on c.slug = v.course_slug
join semesters s on s.course_id = c.id and s.semester_number = v.sem
on conflict do nothing;

-- 5) Virinchi College (Lalitpur): not TU-affiliated; no semesters/subjects seeded (structure unconfirmed).
insert into colleges (name, city, slug, country) values ('Virinchi College', 'Lalitpur', 'virinchi-college-lalitpur', 'NP') on conflict do nothing;
insert into courses (college_id, name, slug, degree_level)
select id, v.name, v.slug, v.level from colleges, (values ('BICT (Software Engineering)', 'bict-software-engineering', 'Bachelor'), ('MBA (Entrepreneurship)', 'mba-entrepreneurship', 'Master')) v(name, slug, level)
where colleges.slug = 'virinchi-college-lalitpur' on conflict do nothing;
