import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { runReadinessCheck } from '../checks/readinessCheck';
import { detectProject } from '../detectors/projectDetector';
import { validateSafeFixPlan } from '../fixes/safeFixes';
import { buildPrevisHtml, createCsp, escapeHtml } from '../webview/PrevisViewProvider';
import { RuntimeToolResult } from '../models/types';

const runtime = (tool: string, available: boolean): RuntimeToolResult => ({
  tool,
  available,
  command: tool,
  args: ['--version'],
  message: available ? 'available' : 'missing',
  severity: available ? 'info' : 'warning',
  relevant: true,
});

suite('PreVisX stabilization hardening', () => {
  test('uses actual relevant runtime results in readiness', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-stabilization-runtime-'));
    fs.writeFileSync(path.join(root, 'package.json'), '{"name":"demo"}');
    const project = detectProject(root);
    const summary = runReadinessCheck(project, root, [runtime('node', false), runtime('npm', true), runtime('yarn', false), runtime('pnpm', false)]);

    assert.strictEqual(summary.checks.find((check) => check.id === 'runtime')?.status, 'fail');
    assert.ok(summary.checks.find((check) => check.id === 'runtime')?.message.includes('Node.js'));
  });

  test('reports malformed package.json without throwing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-stabilization-json-'));
    fs.writeFileSync(path.join(root, 'package.json'), '{ invalid');
    const project = detectProject(root);
    const summary = runReadinessCheck(project, root);

    assert.ok(project.reasons.includes('package.json is invalid JSON'));
    assert.strictEqual(summary.checks.find((check) => check.id === 'configuration')?.status, 'fail');
  });

  test('escapes webview values, emits CSP, and renders refresh controls', () => {
    const project = { rootPath: '/tmp/<unsafe>', projectTypes: ['nodejs'], detectedFrameworks: ['<framework>'], languageSummary: ['nodejs'], confidence: 70, reasons: [] };
    const summary = { score: 0, project, checks: [{ id: 'configuration', category: 'configuration' as const, name: 'Configuration', status: 'warning' as const, message: '<bad>', details: 'recommendation' }] };
    const html = buildPrevisHtml(project, summary);

    assert.ok(html.includes('&lt;unsafe&gt;'));
    assert.ok(html.includes('Content-Security-Policy'));
    assert.ok(html.includes('&lt;bad&gt;'));
    assert.ok(html.includes('data-command="refresh"'));
    assert.ok(html.includes('class="brand-name">PreVisX</h1>'));
    assert.ok(html.includes('aria-label="Project Readiness &amp; Environment Verification System"'));
    assert.ok(html.includes('font-weight: 800;'));
    assert.ok(html.includes('letter-spacing: 0.03em;'));
    assert.ok(createCsp('nonce').includes("script-src 'nonce-nonce'"));
    assert.strictEqual(escapeHtml('<x>&"'), '&lt;x&gt;&amp;&quot;');
  });

  test('rejects tampered Safe Fix plans', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-stabilization-fix-'));
    assert.strictEqual(validateSafeFixPlan({ id: 'tampered', kind: 'install-node-dependencies', title: 'Bad', description: 'Bad', rootPath: root, operation: 'command', command: 'cmd.exe', args: ['/c', 'del', '*'] }), false);
  });
});
