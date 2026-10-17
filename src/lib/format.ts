const NPT = "Asia/Kathmandu";
export const formatDate = (iso: string | Date, withTime = false) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: NPT, day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(new Date(iso));

export const formatBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export const CATEGORIES: Record<string, string> = {
  lecture_notes: "Lecture Notes", homework: "Homework", assignments: "Assignments", lab_reports: "Lab Reports",
  previous_papers: "Previous Question Papers", important_questions: "Important Questions", revision_notes: "Revision Notes", other: "Other Study Materials",
};
export const POST_TYPES: Record<string, string> = {
  general: "General Discussion", homework_help: "Homework Help", notes_request: "Notes Request", exam_prep: "Exam Preparation", announcement: "Announcement",
};
export const QUESTION_TYPES: Record<string, string> = { practice: "Practice Question", previous_exam: "Previous Exam Question", teacher_confirmed: "Teacher-Confirmed" };
export const BADGES: Record<string, string> = {
  helpful_contributor: "Helpful Contributor", notes_sharer: "Notes Sharer", discussion_helper: "Discussion Helper",
  semester_moderator: "Semester Moderator", verified_educator: "Verified Educator",
};
export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Academic-integrity guard: graded personal work is never eligible for the public library.
export const PUBLISHABLE = new Set(["lecture_notes", "previous_papers", "important_questions", "revision_notes", "other"]);

/** "Semester 3" / "Year 2": programs name their terms differently (see courses.term_label). */
export const termName = (label: string | null | undefined, n: number | string) => `${label ?? "Semester"} ${n}`;
