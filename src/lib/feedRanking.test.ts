import { describe, expect, it } from "vitest";
import { explainPost, isActiveVibe, rankFeedPosts, type RankedPost } from "./feedRanking";
const now = Date.parse("2026-10-04T12:00:00Z");
const context = { universityId: "ufal", courseId: "economia", communityIds: new Set<string>(), followingIds: new Set<string>() };
const post = (id: string, university_id: string, course_id: string, age: number): RankedPost => ({ id, user_id: id, created_at: new Date(now - age * 36e5).toISOString(), likes_count: 0, comments_count: 0, profiles: { university_id, course_id } });
describe("academic feed discovery", () => {
  it("expires Vibes after 24 hours", () => { expect(isActiveVibe(new Date(now - 23 * 36e5).toISOString(), now)).toBe(true); expect(isActiveVibe(new Date(now - 24 * 36e5).toISOString(), now)).toBe(false); });
  it("filters university and course views to their own context", () => { const posts = [post("a", "ufal", "economia", 1), post("b", "outra", "economia", 1), post("c", "ufal", "medicina", 1)]; expect(rankFeedPosts(posts, context, "university", now).map(p => p.id)).toEqual(["a", "c"]); expect(rankFeedPosts(posts, context, "course", now).map(p => p.id)).toEqual(["a", "b"]); });
  it("explains a course recommendation", () => { expect(explainPost(post("a", "ufal", "economia", 1), context)).toBe("Relacionado ao seu curso"); });
});
