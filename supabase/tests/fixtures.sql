-- Shared fixtures (owner A, member B, outsider C; college→course→2 semesters, subjects, a document, a post).
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','a@x'),('00000000-0000-0000-0000-00000000000b','b@x'),('00000000-0000-0000-0000-00000000000c','c@x');
insert into colleges (id,name,city,slug) values ('10000000-0000-0000-0000-000000000001','Col','KTM','col');
insert into courses (id,college_id,name,slug) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','BIT','bit');
insert into semesters (id,course_id,semester_number) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',2);
insert into subjects (id,semester_id,name) values
 ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Programming'),
 ('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','Math');
insert into semester_members values
 ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','owner','active',now()),
 ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','member','active',now());
insert into documents (id,uploaded_by,semester_id,title,category,storage_path,size_bytes,mime_type,sha256) values
 ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-000000000001','Private notes','lecture_notes','p1',100,'application/pdf','h1');

insert into discussion_posts(id,semester_id,subject_id,author_id,title,body) values ('60000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','hello','body');
