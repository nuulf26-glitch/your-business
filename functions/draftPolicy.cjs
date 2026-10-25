function nextRevision(stored, expected) {
  const current = Number.isSafeInteger(stored) && stored >= 0 ? stored : 0;
  if (!Number.isSafeInteger(expected) || expected < 0) throw new Error('Reload the editor to use the current saving system.');
  if (expected !== current) throw new Error('This draft changed in another tab or device. Your local edits are safe. Reload to review and recover them.');
  return current + 1;
}
module.exports = { nextRevision };
