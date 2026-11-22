import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { customBackendRequest } from "../services/customBackendSession";
import "../styles/courses.css";

const readSessionToken = key => { try { return sessionStorage.getItem(key) || ""; } catch { return ""; } };
const saveSessionToken = (key, token) => { try { sessionStorage.setItem(key, token); } catch { return false; } return true; };

export default function LearnCourse() {
  const { courseId: routeCourseId } = useParams();
  const params = new URLSearchParams(window.location.search);
  const courseId = routeCourseId || params.get("course") || "";
  const key = `cyb_course_access_${courseId}`;
  const [accessToken, setAccessToken] = useState(() => readSessionToken(key));
  const [tokenInput, setTokenInput] = useState(accessToken);
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const openCourse = useCallback(async (token = accessToken) => {
    if (!courseId || !token.trim()) { setError("Enter the course ID in the link and your private access key."); return; }
    setBusy(true); setError("");
    try { const result = await customBackendRequest("/public/courses/access", { method: "POST", body: JSON.stringify({ data: { courseId, accessToken: token.trim() } }) }); setData(result); setAccessToken(token.trim()); saveSessionToken(key, token.trim()); }
    catch (loadError) { setData(null); setError(loadError.message || "This course access key is invalid or expired."); }
    finally { setBusy(false); }
  }, [accessToken, courseId, key]);

  // Validate any cached invitation with the server before showing course content.
  useEffect(() => { if (accessToken && courseId) openCourse(accessToken); // eslint-disable-line react-hooks/set-state-in-effect
  }, [accessToken, courseId, openCourse]);

  async function completeLesson(lesson) {
    setBusy(true); setError(""); setMessage("");
    try { const result = await customBackendRequest("/public/courses/progress", { method: "POST", body: JSON.stringify({ data: { courseId, lessonId: lesson.id, accessToken, ...(lesson.quiz?.length ? { answers: answers[lesson.id] || [] } : {}) } }) }); setMessage(result.passed ? `Lesson complete${lesson.quiz?.length ? ` · ${result.score}%` : ""}.` : `You scored ${result.score}%. Review the lesson and try again.`); await openCourse(accessToken); }
    catch (saveError) { setError(saveError.message || "Progress could not be saved."); }
    finally { setBusy(false); }
  }

  return <main className="course-learner-page"><header className="learner-brand">CYB <span>LEARNING STUDIO</span></header>{!data ? <section className="learner-access"><span className="courses-eyebrow">PRIVATE STUDENT ACCESS</span><h1>Continue learning</h1><p>Use the access key shared by your course owner.</p><form onSubmit={event => { event.preventDefault(); openCourse(tokenInput); }}><label>Course ID<input value={courseId} readOnly aria-readonly="true" placeholder="Course ID is included in your link" /></label><label>Private access key<input value={tokenInput} onChange={event => setTokenInput(event.target.value)} autoComplete="off" required /></label>{error && <p role="alert" className="courses-alert">{error}</p>}<button disabled={busy}>{busy ? "Checking access…" : "Open course"}</button></form></section> : <><header className="learner-course-heading"><span className="courses-eyebrow">YOUR COURSE</span><h1>{data.course.title}</h1><p>{data.course.description}</p></header>{error && <p role="alert" className="courses-alert">{error}</p>}{message && <p role="status" className="courses-message">{message}</p>}<section className="learner-lessons">{data.course.lessons.map((lesson, index) => { const done = data.progress.some(item => item.lessonId === lesson.id && item.completed); return <article className="learner-lesson" key={lesson.id}><header><span>LESSON {String(index + 1).padStart(2, "0")}</span>{done && <span className="lesson-complete">Completed</span>}</header><h2>{lesson.title}</h2>{lesson.body && <div className="learner-lesson-body">{lesson.body.split("\n").map((line, i) => <p key={i}>{line || " "}</p>)}</div>}{lesson.quiz?.length > 0 && <fieldset className="learner-quiz"><legend>Knowledge check</legend>{lesson.quiz.map((question, qi) => <div key={qi}><p>{question.prompt}</p>{question.options.map((option, oi) => <label key={oi}><input type="radio" name={`${lesson.id}-${qi}`} checked={answers[lesson.id]?.[qi] === oi} onChange={() => setAnswers(current => ({ ...current, [lesson.id]: [...(current[lesson.id] || Array(lesson.quiz.length).fill(null)).map((v, index) => index === qi ? oi : v)] }))} />{option}</label>)}</div>)}</fieldset>}<button type="button" disabled={busy || done} onClick={() => completeLesson(lesson)}>{done ? "Lesson completed" : lesson.quiz?.length ? "Submit lesson & quiz" : "Mark lesson complete"}</button></article>; })}</section>{data.certificate && <section className="course-certificate"><span>COMPLETION CERTIFICATE</span><h2>{data.certificate.courseTitle}</h2><p>Awarded to {data.certificate.learnerName}</p><small>Certificate code · {data.certificate.certificateCode}</small></section>}</>}</main>;
}
