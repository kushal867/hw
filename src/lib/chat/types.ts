/** Types and constants shared by the chat server code and the browser. */
export const REACTIONS = { like: "👍", love: "❤️", laugh: "😂", wow: "😮", thanks: "🙏", party: "🎉" } as const;
export type ReactionKey = keyof typeof REACTIONS;
export const REACTION_KEYS = Object.keys(REACTIONS) as ReactionKey[];

export const MAX_MESSAGE_LENGTH = 2000;
export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ChatSender = { id: string; name: string; avatar: string | null };
export type ChatMessage = {
  id: string; seq: number; roomId: string; clientId: string | null; sender: ChatSender | null;
  body: string | null;                                   // null when deleted: the text is erased on the server
  replyTo: { id: string; senderName: string | null; preview: string | null; deleted: boolean } | null;
  createdAt: string; editedAt: string | null; deletedAt: string | null;
  reactions: { emoji: ReactionKey; count: number; mine: boolean }[];
  pending?: boolean; failed?: boolean;                   // client-only delivery state for optimistic sends
};

export type RoomInfo = {
  id: string; kind: "group" | "direct"; title: string; subtitle: string | null;
  avatarSeed: string; avatarPath: string | null; groupId: string | null; otherUserId: string | null;
  canSend: boolean; sendBlockedReason: string | null; blockedByMe: boolean; muted: boolean; isMod: boolean; lastReadSeq: number;
};

export type InboxRoom = {
  id: string; kind: "group" | "direct"; title: string; avatarSeed: string; avatarPath: string | null; groupId: string | null;
  lastBody: string | null; lastSender: string | null; lastAt: string | null; lastDeleted: boolean; unread: number; muted: boolean;
};

/** Events pushed over the SSE stream. They carry ids only — message text is always fetched through the authorised API. */
export type StreamEvent =
  | { t: "msg"; room: string; id: string; seq: number; sender: string }
  | { t: "upd"; room: string; id: string; seq?: number }
  | { t: "typing"; room: string; user: string; name: string };
