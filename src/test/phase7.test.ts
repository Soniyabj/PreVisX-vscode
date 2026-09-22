import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { detectProject } from '../detectors/projectDetector';
import { runReadinessCheck } from '../checks/readinessCheck';

suite('Phase 7 build and port checks', () => {
  test('recognizes Node build and port configuration', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-phase7-node-'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      name: 'demo',
      scripts: { build: 'vite build' },
    }, null, 2));
    fs.writeFileSync(path.join(root, '.env'), 'PORT=4173\n');

    const summary = runReadinessCheck(detectProject(root), root);
    const buildCheck = summary.checks.find((check) => check.category === 'build');
    const portCheck = summary.checks.find((check) => check.category === 'port');

    assert.strictEqual(buildCheck?.status, 'pass');
    assert.strictEqual(portCheck?.status, 'pass');
    assert.ok(portCheck?.message.includes('4173'));
  });

  test('warns when supported projects lack build and port configuration', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-phase7-python-'));
    fs.writeFileSync(path.join(root, 'requirements.txt'), 'flask==3.0.0\n');

    const summary = runReadinessCheck(detectProject(root), root);
    const buildCheck = summary.checks.find((check) => check.category === 'build');
    const portCheck = summary.checks.find((check) => check.category === 'port');

    assert.strictEqual(buildCheck?.status, 'warning');
    assert.strictEqual(portCheck?.status, 'warning');
  });

  test('does not claim build or port readiness for unknown projects', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-phase7-unknown-'));
    const summary = runReadinessCheck(detectProject(root), root);

    assert.strictEqual(summary.checks.find((check) => check.category === 'build')?.status, 'unknown');
    assert.strictEqual(summary.checks.find((check) => check.category === 'port')?.status, 'unknown');
  });
});