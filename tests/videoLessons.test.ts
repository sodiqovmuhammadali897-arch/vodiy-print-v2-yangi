import { describe, expect, it } from "vitest";
import { sortVideos, teamProgress, videoProblem, youtubeId } from "../src/lib/videoLessons";

describe("video lessons", () => {
  it("reads the id from every kind of YouTube link", () => {
    for (const u of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?si=abc",
      "youtube.com/shorts/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
      "https://www.youtube.com/live/dQw4w9WgXcQ",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      "dQw4w9WgXcQ",
    ])
      expect(youtubeId(u)).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://vimeo.com/123")).toBe("");
    expect(youtubeId("salom")).toBe("");
  });
  it("checks the form", () => {
    expect(videoProblem({ title: "", url: "https://youtu.be/dQw4w9WgXcQ" })).toMatch(/nomini/);
    expect(videoProblem({ title: "1-dars", url: "https://example.com" })).toMatch(/YouTube/);
    expect(videoProblem({ title: "1-dars", url: "https://youtu.be/dQw4w9WgXcQ" })).toBeNull();
  });
  it("orders and counts who watched", () => {
    const v = (id: string, order: number, section = "Mahsulot") => ({ id, title: id, description: "", section, youtube_id: "x", url: "", order });
    expect(sortVideos([v("b", 2), v("a", 1), v("c", 1, "Qo'ng'iroq tartibi")]).map((x) => x.id)).toEqual(["c", "a", "b"]);
    const t = teamProgress([v("a", 1), v("b", 2)], [{ email: "N@vp.uz", name: "Nuriddin" }, { email: "m@vp.uz", name: "Muhammaddiyor" }], { "n@vp.uz": { a: "t", b: "t", gone: "t" }, "m@vp.uz": { a: "t" } });
    expect(t.map((x) => [x.name, x.n, x.of])).toEqual([["Nuriddin", 2, 2], ["Muhammaddiyor", 1, 2]]);
  });
});
