\set ON_ERROR_STOP on
do $$ begin
  if (select count(*) from groups) <> 1 then raise exception 'FAIL: only the active semester becomes a group'; end if;
  if (select id from groups) <> '30000000-0000-0000-0000-000000000001' then raise exception 'FAIL: group keeps the semester id'; end if;
  if (select visibility || join_policy from groups) <> 'privateinvite_only' then raise exception 'FAIL: legacy groups stay private'; end if;
  if (select semester_id from groups) <> '30000000-0000-0000-0000-000000000001' then raise exception 'FAIL: group stays linked to its semester'; end if;
  if (select count(*) from group_members where group_id = '30000000-0000-0000-0000-000000000001') <> 2 then raise exception 'FAIL: members carried over'; end if;
  if (select count(*) from documents where group_id = '30000000-0000-0000-0000-000000000001' and subject_id is not null) <> 1 then raise exception 'FAIL: documents + subject tag carried over'; end if;
  if (select count(*) from discussion_posts) <> 1 or (select count(*) from exam_questions) <> 1 then raise exception 'FAIL: posts/questions carried over'; end if;
  if to_regclass('public.semester_requests') is not null or to_regclass('public.semester_members') is not null then raise exception 'FAIL: old tables removed'; end if;
end $$;
\warn UPGRADE PATH TESTS PASSED
