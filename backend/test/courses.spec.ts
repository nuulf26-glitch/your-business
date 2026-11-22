import { CoursesController, PublicCoursesController } from '../src/courses';
import { gradeQuiz, normalizeCourse, normalizeLesson, publicLesson } from '../src/course-policy';

const ownerRequest = (businessId = 'biz_a', ownerId = 'owner_a') => ({ user: { id: ownerId }, get: () => businessId } as any);

describe('course policy', () => {
  it('normalizes course and lesson input and rejects empty titles', () => {
    expect(normalizeCourse({ title: '  Intro to Design ' })).toMatchObject({ title: 'Intro to Design', slug: 'intro-to-design', visibility: 'private' });
    expect(() => normalizeCourse({ title: ' ' })).toThrow('Course title is required');
    expect(() => normalizeLesson({ title: 'Quiz', quiz: [{ prompt: 'Pick', options: ['A'], correctOption: 0 }] })).toThrow('Each quiz question');
  });
  it('grades quizzes without exposing correct answers to learners', () => {
    const lesson = normalizeLesson({ title: 'Quiz', quiz: [{ prompt: 'Pick one', options: ['A', 'B'], correctOption: 1 }], passPercent: 70 });
    expect(gradeQuiz(lesson, [1])).toEqual({ score: 100, passed: true });
    expect(gradeQuiz(lesson, [0])).toEqual({ score: 0, passed: false });
    expect(publicLesson({ id: 'lesson', data: lesson }).quiz).toEqual([{ prompt: 'Pick one', options: ['A', 'B'] }]);
    expect(JSON.stringify(publicLesson({ id: 'lesson', data: lesson }))).not.toContain('correctOption');
  });
});

describe('course ownership and learner entitlements', () => {
  it('scopes instructor listing to an owned selected business', async () => {
    const db: any = {
      business: { findFirst: jest.fn(async ({ where }: any) => where.ownerId === 'owner_a' && where.id === 'biz_a' ? { id: 'biz_a' } : null) },
      businessRecord: { findMany: jest.fn(async ({ where }: any) => where.businessId === 'biz_a' ? [{ id: 'course_a', status: 'draft', data: { title: 'A' } }] : []), count: jest.fn(async () => 0) },
    };
    const controller = new CoursesController(db);
    await expect(controller.list(ownerRequest())).resolves.toHaveLength(1);
    await expect(controller.list(ownerRequest('biz_other'))).rejects.toThrow('Business not found');
    expect(db.businessRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ businessId: 'biz_a', type: 'course' }) }));
  });

  it('rejects access without an active per-course enrollment token', async () => {
    const db: any = { businessRecord: { findFirst: jest.fn(async ({ where }: any) => where.type === 'course' ? { id: 'course_a', businessId: 'biz_a', status: 'published', data: { title: 'A' } } : null) } };
    const controller = new PublicCoursesController(db);
    await expect(controller.access({ data: { courseId: 'course_a', accessToken: 'a'.repeat(43) } })).rejects.toThrow('Course access is invalid or expired');
    expect(db.businessRecord.findFirst).toHaveBeenCalledTimes(2);
    expect(db.businessRecord.findFirst.mock.calls[1][0].where.businessId).toBe('biz_a');
  });

  it('does not mark quiz progress complete when the learner misses the pass score', async () => {
    const id = (await import('../src/course-policy')).courseRecordId('course_enrollment', 'biz_a', 'course_a', await import('node:crypto').then(({ createHash }) => createHash('sha256').update('a'.repeat(43)).digest('hex')));
    const tokenHash = await import('node:crypto').then(({ createHash }) => createHash('sha256').update('a'.repeat(43)).digest('hex'));
    const db: any = {
      businessRecord: {
        findFirst: jest.fn(async ({ where }: any) => {
          if (where.type === 'course') return { id: 'course_a', businessId: 'biz_a', status: 'published', data: { title: 'A' } };
          if (where.type === 'courseEnrollment') return { id, businessId: 'biz_a', status: 'active', data: { courseId: 'course_a', accessTokenHash: tokenHash, learnerName: 'Learner' } };
          if (where.type === 'courseLesson') return { id: 'lesson_a', businessId: 'biz_a', type: 'courseLesson', data: { courseId: 'course_a', title: 'Quiz', quiz: [{ prompt: 'Question', options: ['No', 'Yes'], correctOption: 1 }], passPercent: 80 } };
          return null;
        }),
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(async ({ create }: any) => create),
      },
    };
    const controller = new PublicCoursesController(db);
    await expect(controller.completeLesson({ data: { courseId: 'course_a', lessonId: 'lesson_a', accessToken: 'a'.repeat(43), answers: [0] } })).resolves.toMatchObject({ completed: false, score: 0 });
    expect(db.businessRecord.upsert.mock.calls[0][0].create.status).toBe('in_progress');
  });
});
