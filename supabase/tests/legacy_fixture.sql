-- Data as it would exist under the old "one workspace per semester" model (schema 0001-0004).
insert into auth.users (id,email) values ('00000000-0000-0000-0000-00000000000a','a@x'),('00000000-0000-0000-0000-00000000000b','b@x');
insert into colleges (id,name,city,slug) values ('10000000-0000-0000-0000-000000000001','Col','KTM','col');
insert into courses (id,college_id,name,slug) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','BIT','bit');
insert into semesters (id,course_id,semester_number) values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1),('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',2);
insert into subjects (id,semester_id,name) values ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Programming');
insert into semester_members values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','owner','active',now()),('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','member','active',now());
insert into documents (uploaded_by,semester_id,subject_id,title,category,storage_path,size_bytes,mime_type,sha256) values ('00000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Legacy notes','lecture_notes','p1',100,'application/pdf','h1');
insert into discussion_posts (semester_id,author_id,title,body) values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','Legacy post','b');
insert into exam_questions (semester_id,subject_id,created_by,question_text) values ('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','Legacy question?');
