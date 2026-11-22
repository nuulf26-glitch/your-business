import { createHash } from 'node:crypto';

const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);

export function normalizeCourse(input: Record<string, unknown>) {
  const title = text(input.title, 140);
  const description = text(input.description, 4000);
  const slug = text(input.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), 100).toLowerCase();
  if (!title) throw new Error('Course title is required.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Use letters, numbers, and hyphens for the course URL.');
  const visibility = input.visibility === 'public' ? 'public' : 'private';
  return { title, description, slug, visibility, coverImageUrl: text(input.coverImageUrl, 2000) };
}

export function normalizeLesson(input: Record<string, unknown>, index = 0) {
  const title = text(input.title, 140);
  const body = text(input.body, 20000);
  const order = Number.isInteger(Number(input.order)) && Number(input.order) >= 0 ? Number(input.order) : index;
  const rawQuiz = Array.isArray(input.quiz) ? input.quiz.slice(0, 20) : [];
  const quiz = rawQuiz.map((raw: any) => {
    const prompt = text(raw?.prompt, 500);
    const options = Array.isArray(raw?.options) ? raw.options.slice(0, 8).map((option: unknown) => text(option, 250)) : [];
    const correctOption = Number(raw?.correctOption);
    if (!prompt || options.length < 2 || options.some((option: string) => !option) || !Number.isInteger(correctOption) || correctOption < 0 || correctOption >= options.length) {
      throw new Error('Each quiz question needs a prompt, at least two options, and one valid answer.');
    }
    return { prompt, options, correctOption };
  });
  if (!title) throw new Error('Lesson title is required.');
  if (!body && !quiz.length) throw new Error('Add lesson content or a quiz question.');
  const passPercent = Math.max(50, Math.min(100, Number(input.passPercent) || 80));
  return { title, body, order, quiz, passPercent };
}

export function publicLesson(lesson: any) {
  const data = lesson.data || {};
  return {
    id: lesson.id,
    title: data.title,
    body: data.body,
    order: data.order,
    quiz: (Array.isArray(data.quiz) ? data.quiz : []).map(({ prompt, options }: any) => ({ prompt, options })),
    passPercent: data.passPercent,
  };
}

export function gradeQuiz(lesson: any, answers: unknown) {
  const questions = Array.isArray(lesson?.quiz) ? lesson.quiz : [];
  if (!questions.length) return { score: 100, passed: true };
  if (!Array.isArray(answers) || answers.length !== questions.length) throw new Error('Answer every quiz question before submitting.');
  const right = questions.reduce((count: number, question: any, index: number) => count + (Number(answers[index]) === question.correctOption ? 1 : 0), 0);
  const score = Math.round((right / questions.length) * 100);
  return { score, passed: score >= (Number(lesson.passPercent) || 80) };
}

export function courseRecordId(kind: string, ...parts: string[]) {
  return `${kind}_${createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 48)}`;
}
