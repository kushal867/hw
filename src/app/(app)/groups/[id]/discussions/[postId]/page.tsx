import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, EyeOff, Flag, MoreHorizontal, Trash2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { LiveRefresh } from "@/components/live-refresh";
import { isUuid, groupAccess } from "@/lib/group";
import { createClient } from "@/lib/server-db";
import { POST_TONE, POST_TYPES, formatDate, plural, timeAgo } from "@/lib/format";
import { createComment, deleteComment, deletePost, moderate } from "@/app/actions/community";

export default async function PostPage({ params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params;
  if (!isUuid(postId)) notFound();
  const a = await groupAccess(id);
  const supabase = await createClient();
  const { data: post } = await supabase.from("discussion_posts").select("*, profiles(display_name, avatar_path), subjects(name)").eq("id", postId).eq("group_id", id).maybeSingle();
  if (!post) notFound();
  const { data: comments } = await supabase.from("discussion_comments").select("id,body,status,author_id,created_at,profiles(display_name, avatar_path)").eq("post_id", postId).order("created_at").limit(200);
  const menuItem = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100";
  const canDeletePost = post.author_id === a.user.id || a.canModerate;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <LiveRefresh table="discussion_comments" filter={`post_id=eq.${postId}`} />
      <Link href={`/groups/${id}/discussions`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden />All discussions</Link>

      <article className="card p-5 sm:p-7">
        <header className="flex items-start gap-3.5">
          <Avatar name={post.profiles?.display_name ?? "?"} path={post.profiles?.avatar_path} size={46} />
          <div className="min-w-0 flex-1"><p className="font-bold">{post.profiles?.display_name}</p><p className="text-xs text-muted" title={formatDate(post.created_at, true)}>{timeAgo(post.created_at)}</p></div>
          <details className="relative"><summary className="btn-ghost !min-h-[38px] !px-2.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden" aria-label="Post actions"><MoreHorizontal className="h-[18px] w-[18px]" aria-hidden /></summary>
            <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
              <Link className={menuItem} href={`/report-content?type=post&id=${post.id}`}><Flag className="h-4 w-4" aria-hidden />Report</Link>
              {a.canModerate && <ActionForm action={async () => { "use server"; return moderate(id, "post", post.id, post.status === "visible" ? "hidden" : "visible"); }}><button className={menuItem}><EyeOff className="h-4 w-4" aria-hidden />{post.status === "visible" ? "Hide from members" : "Restore"}</button></ActionForm>}
              {canDeletePost && <ActionForm action={async () => { "use server"; return deletePost(id, post.id); }} confirm="Delete this post and its replies?"><button className={`${menuItem} text-red-600 hover:!bg-red-50`}><Trash2 className="h-4 w-4" aria-hidden />Delete post</button></ActionForm>}
            </div></details>
        </header>
        <div className="mt-4 flex flex-wrap gap-2"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${POST_TONE[post.post_type]}`}>{POST_TYPES[post.post_type]}</span>{post.subjects?.name && <span className="badge-muted">{post.subjects.name}</span>}{post.status !== "visible" && <span className="badge-warn">Hidden</span>}</div>
        <h1 className="mt-3 text-2xl font-extrabold leading-snug">{post.title}</h1>
        <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-relaxed text-slate-700">{post.body}</p>
      </article>

      <section aria-labelledby="rep">
        <h2 id="rep" className="mb-4 font-bold">{plural(comments?.length ?? 0, "reply", "replies")}</h2>
        {!comments?.length ? <div className="card px-6 py-9 text-center text-sm text-muted">No replies yet. Be the first to help.</div> : (
          <ul className="space-y-4">{comments.map((c: any) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.profiles?.display_name ?? "?"} path={c.profiles?.avatar_path} size={38} />
              <div className="min-w-0 flex-1">
                <div className={`rounded-2xl rounded-tl-md px-4 py-3 ${c.status === "visible" ? "bg-white shadow-card ring-1 ring-line" : "bg-amber-50 ring-1 ring-amber-200"}`}>
                  <p className="text-sm font-bold">{c.profiles?.display_name}{c.status !== "visible" && <span className="badge-warn ml-2">Hidden</span>}</p>
                  <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-slate-700">{c.body}</p></div>
                <div className="mt-1 flex flex-wrap items-center gap-1 px-2 text-xs text-muted">
                  <span title={formatDate(c.created_at, true)}>{timeAgo(c.created_at)}</span>
                  <Link className="rounded-md px-1.5 py-0.5 font-semibold hover:bg-slate-100" href={`/report-content?type=comment&id=${c.id}`}>Report</Link>
                  {a.canModerate && <ActionForm action={async () => { "use server"; return moderate(id, "comment", c.id, c.status === "visible" ? "hidden" : "visible"); }}><button className="rounded-md px-1.5 py-0.5 font-semibold hover:bg-slate-100">{c.status === "visible" ? "Hide" : "Restore"}</button></ActionForm>}
                  {(c.author_id === a.user.id || a.canModerate) && <ActionForm action={async () => { "use server"; return deleteComment(id, c.id); }} confirm="Delete this reply?"><button className="rounded-md px-1.5 py-0.5 font-semibold hover:bg-red-50 hover:text-red-600">Delete</button></ActionForm>}
                </div></div></li>))}</ul>)}
      </section>

      {a.role && post.status === "visible" && (
        <div className="card flex gap-3 p-4">
          <Avatar name={a.profile.display_name} path={a.profile.avatar_path} size={38} />
          <ActionForm action={createComment.bind(null, id, postId)} resetOnSuccess className="min-w-0 flex-1 space-y-3">
            <label htmlFor="body" className="sr-only">Your reply</label><textarea id="body" name="body" required maxLength={2000} rows={3} className="input" placeholder="Write a helpful reply…" />
            <div className="flex justify-end"><SubmitButton>Reply</SubmitButton></div></ActionForm></div>)}
    </div>);
}
