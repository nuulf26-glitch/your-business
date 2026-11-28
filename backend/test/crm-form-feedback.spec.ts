import * as path from 'node:path';
import { readFileSync } from 'node:fs';

describe('CRM form submission feedback regression', () => {
  it('resets the captured form after async saving succeeds', () => {
    const source = readFileSync(path.resolve(process.cwd(), '../src/pages/CRM.jsx'), 'utf8');
    const submit = source.match(/async function submit\(e,type\)\{([\s\S]*?)\n return <DashboardLayout>/)?.[1];

    expect(submit).toBeDefined();
    expect(submit).toContain('const form=e.currentTarget;const f=new FormData(form);');
    expect(submit).toContain('form.reset();await load();');
    expect(submit).not.toContain('e.currentTarget.reset()');
  });
});
