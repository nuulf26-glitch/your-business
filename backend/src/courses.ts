import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { Request } from 'express';
import { DbService } from './database';
import { SessionGuard } from './session';
import { courseRecordId, gradeQuiz, normalizeCourse, normalizeLesson, publicLesson } from './course-policy';

type SessionRequest = Request & { user: { id: string } };
const data = (body: any) => body?.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data as Record<string, any> : {};
const safeCourse = (row: any) => ({ id: row.id, ...row.data, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt });
const safeLesson = (row: any) => ({ id: row.id, ...row.data, status: row.status });

@Controller('courses')
@UseGuards(SessionGuard)
export class CoursesController {
  constructor(private readonly db: DbService) {}

  private async business(req: SessionRequest) {
    const selected = String(req.get('x-cyb-business-id') || '').trim();
    const business = await this.db.business.findFirst({ where: { ownerId: req.user.id, ...(selected ? { id: selected } : {}) } });
    if (!business) throw new NotFoundException('Business not found.');
    return business;
  }
  private async course(businessId: string, id: string) {
    const row = await this.db.businessRecord.findFirst({ where: { id, businessId, type: 'course' } });
    if (!row) throw new NotFoundException('Course not found.');
    return row;
  }

  @Get()
  async list(@Req() req: SessionRequest) {
    const business = await this.business(req);
    const rows = await this.db.businessRecord.findMany({ where: { businessId: business.id, type: 'course' }, orderBy: { updatedAt: 'desc' }, take: 300 });
    return Promise.all(rows.map(async row => ({ ...safeCourse(row), lessonCount: await this.db.businessRecord.count({ where: { businessId: business.id, type: 'courseLesson', status: { not: 'archived' }, data: { path: ['courseId'], equals: row.id } } }) })));
  }

  @Post()
  async create(@Req() req: SessionRequest, @Body() body: unknown) {
    const business = await this.business(req);
    let course: ReturnType<typeof normalizeCourse>;
    try { course = normalizeCourse(data(body)); } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Invalid course.'); }
    const duplicate = await this.db.businessRecord.findFirst({ where: { businessId: business.id, type: 'course', data: { path: ['slug'], equals: course.slug }, status: { not: 'archived' } } });
    if (duplicate) throw new BadRequestException('That course URL is already in use.');
    const row = await this.db.businessRecord.create({ data: { businessId: business.id, type: 'course', status: 'draft', data: { ...course, publishedAt: null } as any } });
    return safeCourse(row);
  }

  @Get(':courseId')
  async detail(@Req() req: SessionRequest, @Param('courseId') courseId: string) {
    const business = await this.business(req), course = await this.course(business.id, courseId);
    const lessons = await this.db.businessRecord.findMany({ where: { businessId: business.id, type: 'courseLesson', status: { not: 'archived' }, data: { path: ['courseId'], equals: course.id } }, orderBy: { createdAt: 'asc' }, take: 200 });
    const enrollments = await this.db.businessRecord.findMany({ where: { businessId: business.id, type: 'courseEnrollment', data: { path: ['courseId'], equals: course.id } }, orderBy: { createdAt: 'desc' }, take: 500 });
    return { ...safeCourse(course), lessons: lessons.map(safeLesson), enrollments: enrollments.map(row => ({ id: row.id, ...(({ accessTokenHash: _hash, ...rest }) => rest)(row.data as any), status: row.status })) };
  }

  @Patch(':courseId')
  async update(@Req() req: SessionRequest, @Param('courseId') courseId: string, @Body() body: unknown) {
    const business = await this.business(req), prior = await this.course(business.id, courseId), patch = data(body);
    const merged = { ...(prior.data as Record<string, any>), ...patch };
    let normalized: ReturnType<typeof normalizeCourse>;
    try { normalized = normalizeCourse(merged); } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Invalid course.'); }
    if (normalized.slug !== (prior.data as any).slug) {
      const duplicate = await this.db.businessRecord.findFirst({ where: { businessId: business.id, type: 'course', status: { not: 'archived' }, data: { path: ['slug'], equals: normalized.slug } } });
      if (duplicate && duplicate.id !== prior.id) throw new BadRequestException('That course URL is already in use.');
    }
    const status = patch.status === undefined ? prior.status : String(patch.status);
    if (!['draft', 'published', 'archived'].includes(status)) throw new BadRequestException('Invalid course status.');
    if (status === 'published' && prior.status !== 'published') {
      const lesson = await this.db.businessRecord.findFirst({ where: { businessId: business.id, type: 'courseLesson', status: { not: 'archived' }, data: { path: ['courseId'], equals: courseId } } });
      if (!lesson) throw new BadRequestException('Add at least one lesson before publishing.');
    }
    const next = { ...normalized, publishedAt: status === 'published' ? (prior.data as any).publishedAt || new Date().toISOString() : null };
    const result = await this.db.businessRecord.updateMany({ where: { id: courseId, businessId: business.id, type: 'course' }, data: { status, data: next as any } });
    if (!result.count) throw new NotFoundException('Course not found.');
    return safeCourse({ ...prior, status, data: next });
  }

  @Post(':courseId/lessons')
  async addLesson(@Req() req: SessionRequest, @Param('courseId') courseId: string, @Body() body: unknown) {
    const business = await this.business(req), course = await this.course(business.id, courseId);
    if (course.status === 'published') throw new BadRequestException('Unpublish the course before changing lessons.');
    let lesson: ReturnType<typeof normalizeLesson>;
    try { lesson = normalizeLesson(data(body), 0); } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Invalid lesson.'); }
    const count = await this.db.businessRecord.count({ where: { businessId: business.id, type: 'courseLesson', data: { path: ['courseId'], equals: course.id } } });
    const row = await this.db.businessRecord.create({ data: { businessId: business.id, type: 'courseLesson', status: 'active', data: { ...lesson, courseId, order: lesson.order || count } as any } });
    return safeLesson(row);
  }

  @Patch(':courseId/lessons/:lessonId')
  async updateLesson(@Req() req: SessionRequest, @Param('courseId') courseId: string, @Param('lessonId') lessonId: string, @Body() body: unknown) {
    const business = await this.business(req), course = await this.course(business.id, courseId);
    if (course.status === 'published') throw new BadRequestException('Unpublish the course before changing lessons.');
    const prior = await this.db.businessRecord.findFirst({ where: { id: lessonId, businessId: business.id, type: 'courseLesson', data: { path: ['courseId'], equals: courseId } } });
    if (!prior) throw new NotFoundException('Lesson not found.');
    if (data(body).status === 'archived') {
      await this.db.businessRecord.updateMany({ where: { id: lessonId, businessId: business.id, type: 'courseLesson' }, data: { status: 'archived' } });
      return { id: lessonId, status: 'archived' };
    }
    let lesson: ReturnType<typeof normalizeLesson>;
    try { lesson = normalizeLesson({ ...(prior.data as any), ...data(body) }, Number((prior.data as any).order) || 0); } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Invalid lesson.'); }
    const result = await this.db.businessRecord.updateMany({ where: { id: lessonId, businessId: business.id, type: 'courseLesson' }, data: { data: { ...lesson, courseId } as any } });
    if (!result.count) throw new NotFoundException('Lesson not found.');
    return { id: lessonId, ...lesson };
  }

  @Post(':courseId/enrollments')
  async inviteLearner(@Req() req: SessionRequest, @Param('courseId') courseId: string, @Body() body: unknown) {
    const business = await this.business(req), course = await this.course(business.id, courseId), payload = data(body);
    if (course.status !== 'published') throw new BadRequestException('Publish the course before inviting learners.');
    const learnerName = String(payload.learnerName || '').trim().slice(0, 120), email = String(payload.email || '').trim().toLowerCase().slice(0, 254);
    if (!learnerName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter a learner name and valid email.');
    const expiresAt = payload.expiresAt ? new Date(String(payload.expiresAt)) : null;
    if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now() || expiresAt.getTime() > Date.now() + 366 * 86400000)) throw new BadRequestException('Choose an expiry within the next year.');
    const accessToken = randomBytes(32).toString('base64url'), tokenHash = createHash('sha256').update(accessToken).digest('hex');
    const id = courseRecordId('course_enrollment', business.id, course.id, tokenHash);
    const row = await this.db.businessRecord.create({ data: { id, businessId: business.id, type: 'courseEnrollment', status: 'active', data: { courseId, learnerName, email, accessTokenHash: tokenHash, expiresAt: expiresAt?.toISOString() || null, grantedAt: new Date().toISOString() } as any } });
    return { enrollment: { id: row.id, learnerName, email, status: row.status, expiresAt: expiresAt?.toISOString() || null }, accessToken };
  }

  @Patch(':courseId/enrollments/:enrollmentId')
  async updateEnrollment(@Req() req: SessionRequest, @Param('courseId') courseId: string, @Param('enrollmentId') enrollmentId: string, @Body() body: unknown) {
    const business = await this.business(req); await this.course(business.id, courseId);
    const enrollment = await this.db.businessRecord.findFirst({ where: { id: enrollmentId, businessId: business.id, type: 'courseEnrollment', data: { path: ['courseId'], equals: courseId } } });
    if (!enrollment) throw new NotFoundException('Enrollment not found.');
    const status = String(data(body).status || '');
    if (!['active', 'revoked'].includes(status)) throw new BadRequestException('Enrollment status must be active or revoked.');
    await this.db.businessRecord.updateMany({ where: { id: enrollmentId, businessId: business.id, type: 'courseEnrollment' }, data: { status } });
    return { id: enrollmentId, status };
  }
}

@Controller('public/courses')
export class PublicCoursesController {
  constructor(private readonly db: DbService) {}

  private async enrollment(courseId: string, accessToken: string) {
    if (typeof accessToken !== 'string' || accessToken.length < 40 || accessToken.length > 64) throw new NotFoundException('Course access is invalid or expired.');
    const course = await this.db.businessRecord.findFirst({ where: { id: courseId, type: 'course', status: 'published' } });
    if (!course) throw new NotFoundException('Course not found.');
    const tokenHash = createHash('sha256').update(accessToken).digest('hex');
    const enrollmentId = courseRecordId('course_enrollment', course.businessId, course.id, tokenHash);
    const row = await this.db.businessRecord.findFirst({ where: { id: enrollmentId, businessId: course.businessId, type: 'courseEnrollment', status: 'active', data: { path: ['courseId'], equals: courseId } } });
    if (!row || (row.data as any).accessTokenHash !== tokenHash) throw new NotFoundException('Course access is invalid or expired.');
    const expiry = Date.parse(String((row.data as any).expiresAt || ''));
    if (Number.isFinite(expiry) && expiry <= Date.now()) throw new NotFoundException('Course access is invalid or expired.');
    return { course, enrollment: row };
  }

  @Post('access')
  async access(@Body() body: unknown) {
    const payload = data(body), courseId = String(payload.courseId || ''), accessToken = payload.accessToken;
    const { course, enrollment } = await this.enrollment(courseId, accessToken);
    const lessons = await this.db.businessRecord.findMany({ where: { businessId: course.businessId, type: 'courseLesson', status: { not: 'archived' }, data: { path: ['courseId'], equals: course.id } }, orderBy: { createdAt: 'asc' }, take: 200 });
    const progress = await this.db.businessRecord.findMany({ where: { businessId: course.businessId, type: 'courseProgress', data: { path: ['enrollmentId'], equals: enrollment.id } }, take: 500 });
    const completed = new Set(progress.filter(row => (row.data as any).completed === true).map(row => String((row.data as any).lessonId)));
    const publicCourse = { id: course.id, title: (course.data as any).title, description: (course.data as any).description, lessons: lessons.map(publicLesson) };
    let certificate: any = null;
    if (lessons.length && lessons.every(lesson => completed.has(lesson.id))) {
      const certificateCode = courseRecordId('CERT', course.businessId, enrollment.id, course.id).slice(-16).toUpperCase();
      const certificateId = courseRecordId('course_certificate', course.businessId, enrollment.id, course.id);
      await this.db.businessRecord.createMany({ data: [{ id: certificateId, businessId: course.businessId, type: 'courseCertificate', status: 'issued', data: { courseId: course.id, enrollmentId: enrollment.id, learnerName: (enrollment.data as any).learnerName, courseTitle: (course.data as any).title, certificateCode, issuedAt: new Date().toISOString() } as any }], skipDuplicates: true });
      certificate = { courseTitle: (course.data as any).title, learnerName: (enrollment.data as any).learnerName, certificateCode };
    }
    return { course: publicCourse, progress: progress.map(row => ({ lessonId: (row.data as any).lessonId, completed: (row.data as any).completed, score: (row.data as any).score || null })), certificate };
  }

  @Post('progress')
  async completeLesson(@Body() body: unknown) {
    const payload = data(body), courseId = String(payload.courseId || ''), lessonId = String(payload.lessonId || ''), accessToken = payload.accessToken;
    const { course, enrollment } = await this.enrollment(courseId, accessToken);
    const lesson = await this.db.businessRecord.findFirst({ where: { id: lessonId, businessId: course.businessId, type: 'courseLesson', status: { not: 'archived' }, data: { path: ['courseId'], equals: course.id } } });
    if (!lesson) throw new NotFoundException('Lesson not found.');
    let grade: { score: number; passed: boolean };
    try { grade = gradeQuiz(lesson.data, payload.answers); } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Quiz answers are invalid.'); }
    const id = courseRecordId('course_progress', course.businessId, enrollment.id, lesson.id);
    const prior = await this.db.businessRecord.findUnique({ where: { id } });
    const completed = grade.passed || (prior?.data as any)?.completed === true;
    const attempts = Number((prior?.data as any)?.attempts || 0) + 1;
    await this.db.businessRecord.upsert({ where: { id }, create: { id, businessId: course.businessId, type: 'courseProgress', status: completed ? 'completed' : 'in_progress', data: { courseId, enrollmentId: enrollment.id, lessonId, completed, score: grade.score, attempts, updatedAt: new Date().toISOString() } as any }, update: { status: completed ? 'completed' : 'in_progress', data: { courseId, enrollmentId: enrollment.id, lessonId, completed, score: grade.score, attempts, updatedAt: new Date().toISOString() } as any } });
    return { lessonId, completed, score: grade.score, passed: grade.passed };
  }
}
