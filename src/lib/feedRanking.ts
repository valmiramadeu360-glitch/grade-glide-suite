/** Deterministic, tunable first-pass discovery scoring. Database RLS decides eligibility first. */
export type FeedMode = "for-you" | "trending" | "university" | "course";
export const VIBE_HOURS = 24;
export const isActiveVibe = (createdAt: string, now = Date.now()) => {
  const age = now - new Date(createdAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < VIBE_HOURS * 60 * 60 * 1000;
};

export interface RankedPost {
  id: string;
  created_at: string;
  user_id: string;
  tag?: string | null;
  event_at?: string | null;
  community_id?: string | null;
  likes_count: number;
  comments_count: number;
  profiles?: { university_id?: string | null; course_id?: string | null } | null;
}
export interface FeedContext {
  universityId?: string | null;
  courseId?: string | null;
  communityIds: Set<string>;
  followingIds: Set<string>;
}
export function explainPost(post: RankedPost, context: FeedContext): string {
  if (post.event_at && new Date(post.event_at).getTime() > Date.now() && new Date(post.event_at).getTime() - Date.now() < 48 * 36e5) return "Evento próximo";
  if (context.followingIds.has(post.user_id)) return "Você segue esta pessoa";
  if (context.communityIds.has(post.community_id ?? "")) return "Da sua comunidade";
  if (context.courseId && post.profiles?.course_id === context.courseId) return "Relacionado ao seu curso";
  if (context.universityId && post.profiles?.university_id === context.universityId) return "Da sua universidade";
  return "Descoberta no campus";
}
export function rankFeedPosts<T extends RankedPost>(posts: T[], context: FeedContext, mode: FeedMode = "for-you", now = Date.now()): T[] {
  const filtered = posts.filter(p => {
    if (mode === "university") return !!context.universityId && p.profiles?.university_id === context.universityId;
    if (mode === "course") return !!context.courseId && p.profiles?.course_id === context.courseId;
    return true;
  });
  const score = (p: T) => {
    const age = Math.max(0, (now - new Date(p.created_at).getTime()) / 36e5);
    const recency = Math.exp(-age / 36);
    const engagement = Math.min(Math.log1p(p.likes_count + p.comments_count * 2.5) / 5, 1);
    const social = context.followingIds.has(p.user_id) ? 0.18 : 0;
    const course = context.courseId && p.profiles?.course_id === context.courseId ? 0.2 : 0;
    const university = context.universityId && p.profiles?.university_id === context.universityId ? 0.08 : 0;
    const community = context.communityIds.has(p.community_id ?? "") ? 0.16 : 0;
    const eventTime = p.event_at ? new Date(p.event_at).getTime() - now : -1;
    const urgency = eventTime > 0 && eventTime < 48 * 36e5 ? 0.16 : 0;
    if (mode === "trending") return engagement * 0.58 + recency * 0.32 + social * 0.3 + urgency;
    return recency * 0.43 + engagement * 0.19 + social + course + university + community + urgency;
  };
  return [...filtered].sort((a, b) => score(b) - score(a) || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}
