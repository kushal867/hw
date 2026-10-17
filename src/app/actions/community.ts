"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/server-db";
import { createAdminClient } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { allow, audit } from "@/lib/security";
import { authorize, isUuid, notify } from "@/lib/semester";
import { POST_TYPES } from "@/lib/format";
import type { ActionResult } from "@/components/ui/action-form";

const optId = z.string().refine((s) => s === "" || isUuid(s), "Invalid subject.");

export async function createPost(semesterId: string, fd: FormData): Promise<ActionResult> {
  const auth = await authorize(semesterId, "member");
  if (!auth.ok) return auth.result;
  const p = z.object({ title: z.string().trim().min(3, "Add a short title.").max(140), body: z.string().trim().min(1, "Write something.").max(5000),
    post_type: z.string().refine((t) => t in POST_TYPES, "Choose a category."), subject: optId }).safeParse({ title: fd.get("title"), body: fd.get("body"), post_type: fd.get("post_type"), subject: fd.get("subject") ?? "" });
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  if (p.data.post_type === "announcement" && auth.role === "member" && !auth.isAdmin) return { ok: false, message: "Only moderators can post announcements." };
  if (!(await allow(auth.userId, "post", 15, 3600))) return { ok: false, message: "You're posting too fast. Try again later." };
  const { data, error } = await (await createClient()).from("discussion_posts").insert({
    semester_id: semesterId, subject_id: p.data.subject || null, author_id: auth.userId, title: p.data.title, body: p.data.body, post_type: p.data.post_type }).select("id").single();
  if (error) return { ok: false, message: "Could not create the post." };
  revalidatePath(`/semesters/${semesterId}/discussions`);
  return { ok: true, message: "Posted.", redirect: `/semesters/${semesterId}/discussions/${data.id}` };
}

export async function createComment(semesterId: string, postId: string, fd: FormData): Promise<ActionResult> {
  const auth = await authorize(semesterId, "member");
  if (!auth.ok || !isUuid(postId)) return auth.ok ? { ok: false, message: "Invalid post." } : auth.result;
  const body = z.string().trim().min(1, "Write a reply.").max(2000, "Replies are limited to 2000 characters.").safeParse(fd.get("body"));
  if (!body.success) return { ok: false, message: body.error.issues[0].message };
  if (!(await allow(auth.userId, "comment", 40, 3600))) return { ok: false, message: "You're replying too fast. Try again later." };
  const supabase = await createClient();
  const { data: post } = await supabase.from("discussion_posts").select("author_id,title,semester_id,status").eq("id", postId).maybeSingle();
  if (!post || post.semester_id !== semesterId || post.status !== "visible") return { ok: false, message: "This post is unavailable." };
  const { error } = await supabase.from("discussion_comments").insert({ post_id: postId, author_id: auth.userId, body: body.data });
  if (error) return { ok: false, message: "Could not post your reply." };
  if (post.author_id !== auth.userId) await notify(post.author_id, "reply", "New reply to your post", `/semesters/${semesterId}/discussions/${postId}`, post.title);
  revalidatePath(`/semesters/${semesterId}/discussions/${postId}`);
  return { ok: true, message: "Reply posted." };
}

/** Authors delete their own via RLS; moderators/admins via the same delete policy. */
export async function deletePost(semesterId: string, postId: string): Promise<ActionResult> {
  await requireUser();
  const { data } = await (await createClient()).from("discussion_posts").delete().eq("id", postId).eq("semester_id", semesterId).select("id");
  if (!data?.length) return { ok: false, message: "You can't delete this post." };
  return { ok: true, message: "Post deleted.", redirect: `/semesters/${semesterId}/discussions` };
}
export async function deleteComment(semesterId: string, commentId: string): Promise<ActionResult> {
  await requireUser();
  const { data } = await (await createClient()).from("discussion_comments").delete().eq("id", commentId).select("id");
  if (!data?.length) return { ok: false, message: "You can't delete this reply." };
  revalidatePath(`/semesters/${semesterId}/discussions`);
  return { ok: true, message: "Reply deleted." };
}

/** Moderator hide/restore. Scoped to the moderator's own semester and logged. */
export async function moderate(semesterId: string, kind: "post" | "comment", id: string, status: "visible" | "hidden"): Promise<ActionResult> {
  const auth = await authorize(semesterId, "moderator");
  if (!auth.ok || !isUuid(id)) return auth.ok ? { ok: false, message: "Invalid item." } : auth.result;
  const admin = createAdminClient();
  if (kind === "post") await admin.from("discussion_posts").update({ status }).eq("id", id).eq("semester_id", semesterId);
  else {
    const { data: c } = await admin.from("discussion_comments").select("post_id, discussion_posts!inner(semester_id)").eq("id", id).maybeSingle() as any;
    if (!c || c.discussion_posts.semester_id !== semesterId) return { ok: false, message: "Not found." };   // prevent cross-semester moderation
    await admin.from("discussion_comments").update({ status }).eq("id", id);
  }
  await audit(auth.userId, `${kind}.${status}`, kind, id, { semester: semesterId });
  revalidatePath(`/semesters/${semesterId}/discussions`);
  return { ok: true, message: status === "hidden" ? "Hidden from members." : "Restored." };
}

// ───────── Exam questions ─────────
export async function addQuestion(semesterId: string, fd: FormData): Promise<ActionResult> {
  const auth = await authorize(semesterId, "member");
  if (!auth.ok) return auth.result;
  const p = z.object({ subject: z.string().refine(isUuid, "Choose a subject."), question: z.string().trim().min(5, "Question is too short.").max(2000),
    answer: z.string().trim().max(4000), topic: z.string().trim().max(100), source: z.string().trim().max(300),
    type: z.enum(["practice", "previous_exam"], { message: "Choose a question type." }) })
    .safeParse({ subject: fd.get("subject"), question: fd.get("question"), answer: fd.get("answer") ?? "", topic: fd.get("topic") ?? "", source: fd.get("source") ?? "", type: fd.get("type") });
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  if (!(await allow(auth.userId, "question", 30, 3600))) return { ok: false, message: "Slow down a little and try again later." };
  const { error } = await (await createClient()).from("exam_questions").insert({
    semester_id: semesterId, subject_id: p.data.subject, created_by: auth.userId, question_text: p.data.question, answer_text: p.data.answer || null,
    topic: p.data.topic || null, source_note: p.data.source || null, question_type: p.data.type });
  if (error) return { ok: false, message: "Could not save the question." };
  revalidatePath(`/semesters/${semesterId}/questions`);
  return { ok: true, message: "Question added." };
}

export async function toggleSaved(semesterId: string, questionId: string, saved: boolean): Promise<ActionResult> {
  const { user } = await requireUser();
  const supabase = await createClient();
  const r = saved ? await supabase.from("saved_questions").delete().eq("user_id", user.id).eq("question_id", questionId)
                  : await supabase.from("saved_questions").insert({ user_id: user.id, question_id: questionId });
  if (r.error) return { ok: false, message: "Could not update your revision list." };
  revalidatePath(`/semesters/${semesterId}/questions`);
  return { ok: true, message: saved ? "Removed from revision list." : "Saved to revision list." };
}

export async function deleteQuestion(semesterId: string, id: string): Promise<ActionResult> {
  await requireUser();
  const { data } = await (await createClient()).from("exam_questions").delete().eq("id", id).select("id");
  if (!data?.length) return { ok: false, message: "You can't delete this question." };
  revalidatePath(`/semesters/${semesterId}/questions`);
  return { ok: true, message: "Question deleted." };
}

/** Only platform admins can mark a question teacher-confirmed (after the offline verification step). */
export async function confirmQuestion(semesterId: string, id: string): Promise<ActionResult> {
  const { user, profile } = await requireUser();
  if (profile.platform_role !== "admin") return { ok: false, message: "Only verified reviewers can confirm questions." };
  await createAdminClient().from("exam_questions").update({ question_type: "teacher_confirmed" }).eq("id", id).eq("semester_id", semesterId);
  await audit(user.id, "question.teacher_confirm", "question", id);
  revalidatePath(`/semesters/${semesterId}/questions`);
  return { ok: true, message: "Marked teacher-confirmed." };
}
