import { expect, test } from "@playwright/test";

const owner = { id: "course-qa-owner", uid: "course-qa-owner", email: "course-owner@example.test", emailVerified: true, role: "owner", paid: true };
const course = { id: "course-qa-1", title: "Considered Design", slug: "considered-design", description: "A short practice course.", status: "published", lessonCount: 1 };
const detail = { ...course, lessons: [{ id: "lesson-qa-1", courseId: course.id, title: "First principles", body: "Begin with the learner.", order: 0, quiz: [{ prompt: "Who comes first?", options: ["The learner", "The tool"] }] }], enrollments: [] };

async function mockCourseApi(page) {
  let progress = [];
  await page.addInitScript(() => localStorage.setItem("cyb_active_business_id", "business-course-qa"));
  await page.route("**/api/v1/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    let status = 200, body;
    if (path === "/auth/me") body = owner;
    else if (path === "/businesses/mine/stores") body = [{ id: "business-course-qa", name: "Course Studio", slug: "course-studio", storeUrl: "course-studio" }];
    else if (path === "/courses" && method === "GET") body = [course];
    else if (path === `/courses/${course.id}` && method === "GET") body = { ...detail, progress };
    else if (path === "/public/courses/access" && method === "POST") body = { course: { ...course, lessons: detail.lessons }, progress, certificate: null };
    else if (path === "/public/courses/progress" && method === "POST") { progress = [{ lessonId: "lesson-qa-1", completed: true, score: 100 }]; body = { lessonId: "lesson-qa-1", completed: true, passed: true, score: 100 }; }
    else if (path.startsWith("/auth/")) body = owner;
    else if (path.startsWith("/public/")) body = {};
    else { status = 200; body = {}; }
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("course authoring is responsive and shows publish and learner controls", async ({ page }) => {
  await mockCourseApi(page);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: "Courses", exact: true })).toBeVisible();
    await expect(page.getByText("Considered Design", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Lessons & quizzes" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow at ${viewport.width}`).toBe(false);
  }
});

test("learners can complete lessons and see issued completion", async ({ page }) => {
  await mockCourseApi(page);
  await page.goto(`/learn/${course.id}`);
  await page.getByLabel("Private access key").fill("synthetic-private-course-token-123456789012345");
  await page.getByRole("button", { name: "Open course" }).click();
  await expect(page.getByRole("heading", { name: "Considered Design" })).toBeVisible();
  await page.getByLabel("The learner").check();
  await page.getByRole("button", { name: "Submit lesson & quiz" }).click();
  await expect(page.getByRole("heading", { name: "Considered Design" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lesson completed" })).toBeDisabled();
});
