import { createHash, randomUUID } from 'node:crypto';

export type PublicSupportSubmission = {
  requestId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  needsHuman: boolean;
};

const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export function parsePublicSupportSubmission(value: unknown): PublicSupportSubmission {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const requestId = text(input.requestId, 128);
  const name = text(input.name, 120);
  const email = text(input.email, 254).toLowerCase();
  const subject = text(input.subject, 160);
  const message = text(input.message, 5000);
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(requestId)) throw new Error('A valid request key is required.');
  if (!name) throw new Error('Enter your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (!subject) throw new Error('Enter a subject.');
  if (message.length < 5) throw new Error('Add a little more detail to your message.');
  return { requestId, name, email, subject, message, needsHuman: input.needsHuman === true };
}

export function supportRecordId(businessId: string, requestId: string) {
  return `support_${createHash('sha256').update(`${businessId}:${requestId}`).digest('hex').slice(0, 48)}`;
}

export function supportRequestHash(submission: PublicSupportSubmission) {
  const { requestId: _requestId, ...safe } = submission;
  return createHash('sha256').update(JSON.stringify(safe)).digest('hex');
}

export function appendSupportNote(value: unknown, note: string, authorId: string, at = new Date().toISOString()) {
  const data = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
  const messages = Array.isArray(data.messages) ? data.messages : [];
  return {
    ...data,
    messages: [...messages, { id: randomUUID(), kind: 'internal_note', body: note, authorId, at }],
    updatedAt: at,
  };
}

export function updateSupportConversation(value: unknown, patch: unknown, actorId: string, at = new Date().toISOString()) {
  const data = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
  const update = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch as Record<string, unknown> : {};
  const status = update.status === undefined ? data.status : update.status;
  if (!['open', 'in_progress', 'waiting', 'closed'].includes(String(status))) throw new Error('Choose a valid ticket status.');
  if (update.assignToMe !== undefined && typeof update.assignToMe !== 'boolean') throw new Error('Assignment must be enabled or disabled.');
  const assignedToUserId = update.assignToMe === true ? actorId : update.assignedToUserId === undefined ? data.assignedToUserId ?? null : update.assignedToUserId;
  if (assignedToUserId !== null && assignedToUserId !== actorId) throw new Error('Tickets can only be assigned to you or left unassigned.');
  if (update.requiresHuman !== undefined && typeof update.requiresHuman !== 'boolean') throw new Error('Human handoff must be enabled or disabled.');
  const requiresHuman = update.requiresHuman === undefined ? Boolean(data.requiresHuman) : update.requiresHuman;
  return {
    ...data,
    status,
    assignedToUserId,
    requiresHuman,
    ...(requiresHuman ? {} : { handoffReason: null }),
    ...(update.handoffReason === undefined ? {} : { handoffReason: requiresHuman ? text(update.handoffReason, 200) : null }),
    updatedAt: at,
    ...(status === 'closed' ? { closedAt: data.closedAt || at } : status === 'open' || status === 'in_progress' ? { closedAt: null } : {}),
  };
}

export function supportInboxTestHelpers() {
  return { parsePublicSupportSubmission, supportRecordId, supportRequestHash, appendSupportNote, updateSupportConversation };
}
