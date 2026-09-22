import * as assert from 'assert';

import { collectProjectRuntimeDiagnostics, getRuntimeToolInfo, RuntimeToolResult } from '../runtime/runtimeDetector';
import { DetectedProject } from '../models/types';

suite('Phase 4 runtime detection', () => {
  test('detects Node.js runtime when available', async () => {
    const fakeExec = async () => ({ stdout: 'v20.11.1\n', stderr: '' });
    const result = await getRuntimeToolInfo('node', 'node', ['--version'], true, fakeExec as any);

    assert.strictEqual(result.available, true);
    assert.strictEqual(result.version, 'v20.11.1');
    assert.strictEqual(result.tool, 'node');
  });

  test('detects missing Node.js runtime safely', async () => {
    const fakeExec = async () => {
      const error = new Error('spawn node ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    };

    const result = await getRuntimeToolInfo('node', 'node', ['--version'], true, fakeExec as any);

    assert.strictEqual(result.available, false);
    assert.strictEqual(result.tool, 'node');
    assert.ok(result.message.includes('not installed') || result.message.includes('not found'));
  });

  test('detects Python runtime when available', async () => {
    const fakeExec = async () => ({ stdout: 'Python 3.12.2\n', stderr: '' });
    const result = await getRuntimeToolInfo('python', 'python', ['--version'], true, fakeExec as any);

    assert.strictEqual(result.available, true);
    assert.ok(result.version?.includes('3.12.2'));
  });

  test('marks Java as unavailable when missing', async () => {
    const fakeExec = async () => {
      const error = new Error('spawn java ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    };

    const result = await getRuntimeToolInfo('java', 'java', ['--version'], true, fakeExec as any);

    assert.strictEqual(result.available, false);
    assert.strictEqual(result.tool, 'java');
  });

  test('detects compiler availability', async () => {
    const fakeExec = async (_command: string, _args: string[]) => ({ stdout: 'clang version 18.0.0\n', stderr: '' });
    const result = await getRuntimeToolInfo('clang', 'clang', ['--version'], true, fakeExec as any);

    assert.strictEqual(result.available, true);
    assert.ok(result.version?.includes('18.0.0'));
  });

  test('detects npm, yarn and pnpm tool availability', async () => {
    const fakeExec = async (command: string) => {
      const versions: Record<string, string> = {
        npm: '10.8.2\n',
        yarn: '1.22.22\n',
        pnpm: '9.0.0\n',
      };

      return { stdout: versions[command] ?? 'ok\n', stderr: '' };
    };

    const npmResult = await getRuntimeToolInfo('npm', 'npm', ['--version'], true, fakeExec as any);
    const yarnResult = await getRuntimeToolInfo('yarn', 'yarn', ['--version'], true, fakeExec as any);
    const pnpmResult = await getRuntimeToolInfo('pnpm', 'pnpm', ['--version'], true, fakeExec as any);

    assert.strictEqual(npmResult.available, true);
    assert.strictEqual(yarnResult.available, true);
    assert.strictEqual(pnpmResult.available, true);
  });

  test('applies project-aware relevance', async () => {
    const project: DetectedProject = {
      rootPath: '/tmp/demo',
      projectTypes: ['nodejs'],
      detectedFrameworks: ['vite'],
      languageSummary: ['nodejs'],
      confidence: 95,
      reasons: ['package.json detected'],
    };

    const fakeExec = async (command: string) => ({
      stdout: command === 'node' ? 'v22.0.0\n' : '11.0.0\n',
      stderr: '',
    });

    const results = await collectProjectRuntimeDiagnostics(project, fakeExec as any);
    const tools = results.map((item) => item.tool);

    assert.ok(tools.includes('node'));
    assert.ok(tools.includes('npm'));
    assert.ok(!tools.includes('java'));
  });
});
