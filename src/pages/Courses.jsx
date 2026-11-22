import { useCallback, useEffect, useState } from "react";
import { customBackendRequest } from "../services/customBackendSession";
import DashboardLayout from "../layouts/DashboardLayout";
import "../styles/courses.css";

const request = (path, method = "GET", data) => customBackendRequest(path, { method, ...(data ? { body: JSON.stringify({ data }) } : {}) });

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [courseForm, setCourseForm] = useState({ title: "", description: "" });
  const [lessonForm, setLessonForm] = useState({ title: "", body: "", prompt: "", optionA: "", optionB: "", correctOption: 0 });
  const [learnerForm, setLearnerForm] = useState({ learnerName: "", email: "" });
  const [invite, setInvite] = useState(null);

  const loadCourses = useCallback(async () => {
    setError("");
    try {
      const items = await request("/courses");
      setCourses(items);
      if (selectedId && items.some(item => item.id === selectedId)) return;
      setSelectedId(items[0]?.id || "");
    } catch (loadError) { setError(loadError.message || "Courses could not be loaded."); }
  }, [selectedId]);

  const loadDetail = useCallback(async () => {
    if (!selectedId) { setDetail(null); return; }
    try { setDetail(await request(`/courses/${encodeURIComponent(selectedId)}`)); }
    catch (loadError) { setError(loadError.message || "Course details could not be loaded."); }
  }, [selectedId]);

  // Fetching is an external synchronization; these callbacks update state from the server response.
  useEffect(() => { loadCourses(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadCourses]);
  useEffect(() => { loadDetail(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadDetail]);

  async function createCourse(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const created = await request("/courses", "POST", courseForm);
      setCourseForm({ title: "", description: "" }); setSelectedId(created.id); setCourses(rows => [created, ...rows]); setMessage("Draft course created.");
    } catch (createError) { setError(createError.message); }
    finally { setBusy(false); }
  }

  async function addLesson(event) {
    event.preventDefault(); if (!selectedId) return;
    setBusy(true); setError(""); setMessage("");
    const quiz = lessonForm.prompt.trim() ? [{ prompt: lessonForm.prompt, options: [lessonForm.optionA, lessonForm.optionB], correctOption: Number(lessonForm.correctOption) }] : [];
    try {
      await request(`/courses/${encodeURIComponent(selectedId)}/lessons`, "POST", { title: lessonForm.title, body: lessonForm.body, quiz });
      setLessonForm({ title: "", body: "", prompt: "", optionA: "", optionB: "", correctOption: 0 }); await loadDetail(); await loadCourses(); setMessage("Lesson added to the course.");
    } catch (lessonError) { setError(lessonError.message); }
    finally { setBusy(false); }
  }

  async function setCourseStatus(status) {
    if (!detail) return;
    setBusy(true); setError("");
    try { await request(`/courses/${encodeURIComponent(detail.id)}`, "PATCH", { ...detail, status }); await loadCourses(); await loadDetail(); setMessage(status === "published" ? "Course published. Learner access is available by invitation." : "Course saved as a draft."); }
    catch (statusError) { setError(statusError.message); }
    finally { setBusy(false); }
  }

  async function inviteLearner(event) {
    event.preventDefault(); if (!detail) return;
    setBusy(true); setError("");
    try { const result = await request(`/courses/${encodeURIComponent(detail.id)}/enrollments`, "POST", learnerForm); setInvite(result); setLearnerForm({ learnerName: "", email: "" }); await loadDetail(); setMessage("Learner access issued. Copy the access key now; CYB does not email it."); }
    catch (inviteError) { setError(inviteError.message); }
    finally { setBusy(false); }
  }

  async function toggleEnrollment(enrollment) {
    try { await request(`/courses/${encodeURIComponent(detail.id)}/enrollments/${encodeURIComponent(enrollment.id)}`, "PATCH", { status: enrollment.status === "active" ? "revoked" : "active" }); await loadDetail(); }
    catch (toggleError) { setError(toggleError.message); }
  }

  return <DashboardLayout><main className="courses-page">
    <header className="courses-header"><div><span className="courses-eyebrow">LEARNING STUDIO</span><h1>Courses</h1><p>Create lessons, assess learners, and issue private course access.</p></div><span className="courses-count">{courses.length} {courses.length === 1 ? "course" : "courses"}</span></header>
    {error && <p className="courses-alert" role="alert">{error}</p>}{message && <p className="courses-message" role="status">{message}</p>}
    <section className="courses-create panel"><div><h2>Start a course</h2><p>Courses begin as drafts. Publishing and learner access are separate actions.</p></div><form onSubmit={createCourse}><label>Course title<input value={courseForm.title} onChange={e => setCourseForm(value => ({ ...value, title: e.target.value }))} maxLength={140} required /></label><label>Course overview<textarea rows="3" maxLength={4000} value={courseForm.description} onChange={e => setCourseForm(value => ({ ...value, description: e.target.value }))} /></label><button disabled={busy}>{busy ? "Saving…" : "Create draft"}</button></form></section>
    <div className="courses-workspace">
      <aside className="courses-list panel"><h2>Your courses</h2>{courses.length ? courses.map(course => <button className={course.id === selectedId ? "course-select selected" : "course-select"} type="button" key={course.id} onClick={() => setSelectedId(course.id)}><span>{course.title}</span><small>{course.status} · {course.lessonCount || 0} lessons</small></button>) : <p className="courses-empty">No courses yet. Create your first draft above.</p>}</aside>
      {detail && <section className="course-editor panel">
        <div className="course-editor-heading"><div><span className={`course-status ${detail.status}`}>{detail.status}</span><h2>{detail.title}</h2><p>{detail.description || "Add an overview that tells learners what they will study."}</p></div><button type="button" disabled={busy || !detail.lessons?.length} onClick={() => setCourseStatus(detail.status === "published" ? "draft" : "published")}>{detail.status === "published" ? "Unpublish" : "Publish course"}</button></div>
        <section><h3>Lessons & quizzes</h3>{detail.lessons?.length ? <ol className="course-lessons">{detail.lessons.map(lesson => <li key={lesson.id}><div><strong>{lesson.order + 1}. {lesson.title}</strong><small>{lesson.body ? `${lesson.body.slice(0, 100)}${lesson.body.length > 100 ? "…" : ""}` : "Quiz lesson"}</small></div><span>{lesson.quiz?.length ? `${lesson.quiz.length} quiz question${lesson.quiz.length === 1 ? "" : "s"}` : "Reading"}</span></li>)}</ol> : <p className="courses-empty">Add a lesson before you publish this course.</p>}</section>
        <form className="course-add-lesson" onSubmit={addLesson}><h3>Add a lesson</h3><label>Lesson title<input value={lessonForm.title} onChange={e => setLessonForm(value => ({ ...value, title: e.target.value }))} maxLength={140} required /></label><label>Lesson content<textarea rows="5" maxLength={20000} value={lessonForm.body} onChange={e => setLessonForm(value => ({ ...value, body: e.target.value }))} placeholder="Write the lesson. Add a quiz question below to assess understanding." /></label><fieldset><legend>Optional quiz</legend><label>Question<input value={lessonForm.prompt} onChange={e => setLessonForm(value => ({ ...value, prompt: e.target.value }))} maxLength={500} /></label><div className="course-option-grid"><label>Option A<input value={lessonForm.optionA} onChange={e => setLessonForm(value => ({ ...value, optionA: e.target.value }))} maxLength={250} /></label><label>Option B<input value={lessonForm.optionB} onChange={e => setLessonForm(value => ({ ...value, optionB: e.target.value }))} maxLength={250} /></label></div><label>Correct answer<select value={lessonForm.correctOption} onChange={e => setLessonForm(value => ({ ...value, correctOption: Number(e.target.value) }))}><option value={0}>Option A</option><option value={1}>Option B</option></select></label></fieldset><button disabled={busy}>{busy ? "Adding…" : "Add lesson"}</button></form>
        {detail.status === "published" && <section className="course-enrollments"><h3>Invite learners</h3><p>Issue a private access key. Share it directly with the learner; CYB will show it once and will not send an email.</p><form onSubmit={inviteLearner}><label>Learner name<input value={learnerForm.learnerName} onChange={e => setLearnerForm(value => ({ ...value, learnerName: e.target.value }))} maxLength={120} required /></label><label>Email for your roster<input type="email" value={learnerForm.email} onChange={e => setLearnerForm(value => ({ ...value, email: e.target.value }))} maxLength={254} required /></label><button disabled={busy}>Issue access key</button></form>{invite && <div className="course-invite-key"><strong>Copy this access key now</strong><code>{invite.accessToken}</code><button type="button" onClick={() => navigator.clipboard?.writeText(invite.accessToken)}>Copy key</button></div>}{detail.enrollments?.length > 0 && <div className="course-learners"><h4>Learners</h4>{detail.enrollments.map(enrollment => <article key={enrollment.id}><span><strong>{enrollment.learnerName}</strong><small>{enrollment.email} · {enrollment.status}{enrollment.expiresAt ? ` · expires ${new Date(enrollment.expiresAt).toLocaleDateString()}` : ""}</small></span><button type="button" onClick={() => toggleEnrollment(enrollment)}>{enrollment.status === "active" ? "Revoke access" : "Restore access"}</button></article>)}</div>}</section>}
      </section>}
    </div>
  </main></DashboardLayout>;
}
