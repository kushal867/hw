import Link from "next/link";
import { notFound } from "next/navigation";
import { EyeOff, Flag, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { LiveRefresh } from "@/components/live-refresh";
import { isUuid, groupAccess } from "@/lib/group";
import { createClient } from "@/lib/server-db";
import { POST_TYPES, formatDate } from "@/lib/format";
import { createComment, deleteComment, deletePost, moderate } from "@/app/actions/community";

export default async function PostPage({ params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params;
  if (!isUuid(postId)) notFound();
  const a = await groupAccess(id);
  const supabase = await createClient();
  const { data: post } = await supabase.from("discussion_posts").select("*, profiles(display_name), subjects(name)").eq("id", postId).eq("group_id", id).maybeSingle();
  if (!post) notFound();
  const { data: comments } = await supabase.from("discussion_comments").select("id,body,status,author_id,created_at,profiles(display_name)").eq("post_id", postId).order("created_at").limit(200);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <LiveRefresh table="discussion_comments" filter={`post_id=eq.${postId}`} />
      <Link href={`/groups/${id}/discussions`} className="text-sm text-brand-700 hover:underline">← All discussions</Link>
      <article className="card p-5">
        <div className="flex flex-wrap gap-2"><span className="badge">{POST_TYPES[post.post_type]}</span>{post.subjects?.name && <span className="badge !bg-line !text-muted">{post.subjects.name}</span>}{post.status !== "visible" && <span className="badge !bg-warn/10 !text-warn">Hidden</span>}</div>
        <h1 className="mt-2 text-xl font-bold">{post.title}</h1>
        <p className="text-xs text-muted">{post.profiles?.display_name} · {formatDate(post.created_at, true)}</p>
        <p className="mt-4 whitespace-pre-line break-words">{post.body}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="btn-ghost !min-h-[36px]" href={`/report-content?type=post&id=${post.id}`}><Flag className="h-4 w-4" aria-hidden />Report</Link>
          {a.canModerate && <ActionForm action={async () => { "use server"; return moderate(id, "post", post.id, post.status === "visible" ? "hidden" : "visible"); }}><SubmitButton variant="secondary"><EyeOff className="h-4 w-4" aria-hidden />{post.status === "visible" ? "Hide" : "Restore"}</SubmitButton></ActionForm>}
          {(post.author_id === a.user.id || a.canModerate) && <ActionForm action={async () => { "use server"; return deletePost(id, post.id); }} confirm="Delete this post and its replies?"><SubmitButton variant="ghost"><Trash2 className="h-4 w-4" aria-hidden />Delete</SubmitButton></ActionForm>}
        </div>
      </article>
      <section aria-labelledby="rep"><h2 id="rep" className="mb-3 font-semibold">Replies ({comments?.length ?? 0})</h2>
        {!comments?.length ? <p className="text-sm text-muted">No replies yet. Be the first to help.</p> : (
          <ul className="space-y-3">{comments.map((c: any) => (
            <li key={c.id} className="card p-4"><p className="text-xs text-muted">{c.profiles?.display_name} · {formatDate(c.created_at, true)}{c.status !== "visible" && " · hidden"}</p>
              <p className="mt-1 whitespace-pre-line break-words text-sm">{c.body}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link className="btn-ghost !min-h-[32px] !px-2 text-xs" href={`/report-content?type=comment&id=${c.id}`}>Report</Link>
                {a.canModerate && <ActionForm action={async () => { "use server"; return moderate(id, "comment", c.id, c.status === "visible" ? "hidden" : "visible"); }}><SubmitButton variant="ghost" className="!min-h-[32px] !px-2 text-xs">{c.status === "visible" ? "Hide" : "Restore"}</SubmitButton></ActionForm>}
                {(c.author_id === a.user.id || a.canModerate) && <ActionForm action={async () => { "use server"; return deleteComment(id, c.id); }} confirm="Delete this reply?"><SubmitButton variant="ghost" className="!min-h-[32px] !px-2 text-xs">Delete</SubmitButton></ActionForm>}
              </div></li>))}</ul>)}
      </section>
      {a.role && post.status === "visible" && (
        <ActionForm action={createComment.bind(null, id, postId)} resetOnSuccess className="card space-y-3 p-4">
          <label htmlFor="body" className="label">Your reply</label><textarea id="body" name="body" required maxLength={2000} rows={3} className="input" /><SubmitButton>Reply</SubmitButton></ActionForm>)}
    </div>);
}
