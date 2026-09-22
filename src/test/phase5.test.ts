import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { detectProject } from '../detectors/projectDetector';
import { runReadinessCheck } from '../checks/readinessCheck';

suite('Phase 5 dependency checks', () => {
  test('Node project with dependencies installed passes dependency check', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-node-deps-'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'demo', scripts: { dev: 'vite' } }, null, 2));
    fs.mkdirSync(path.join(root, 'node_modules'));

    const project = detectProject(root);
    const summary = runReadinessCheck(project, root);
    const dependencyCheck = summary.checks.find((check) => check.category === 'dependencies');

    assert.ok(dependencyCheck);
    assert.strictEqual(dependencyCheck?.status, 'pass');
  });

  test('Node project without node_modules fails dependency validation', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-node-missing-'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'demo', scripts: { dev: 'vite' } }, null, 2));

    const project = detectProject(root);
    const summary = runReadinessCheck(project, root);
    const dependencyCheck = summary.checks.find((check) => check.category === 'dependencies');

    assert.ok(dependencyCheck);
    assert.strictEqual(dependencyCheck?.status, 'fail');
  });

  test('Python project with virtual environment is recognized as ready', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-python-venv-'));
    fs.writeFileSync(path.join(root, 'requirements.txt'), 'django==5.0.0\n');
    fs.mkdirSync(path.join(root, '.venv'));

    const project = detectProject(root);
    const summary = runReadinessCheck(project, root);
    const dependencyCheck = summary.checks.find((check) => check.category === 'dependencies');

    assert.ok(dependencyCheck);
    assert.strictEqual(dependencyCheck?.status, 'pass');
  });

  test('Python project without environment warns instead of failing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-python-no-venv-'));
    fs.writeFileSync(path.join(root, 'requirements.txt'), 'flask==3.0.0\n');

    const project = detectProject(root);
    const summary = runReadinessCheck(project, root);
    const dependencyCheck = summary.checks.find((check) => check.category === 'dependencies');

    assert.ok(dependencyCheck);
    assert.strictEqual(dependencyCheck?.status, 'warning');
  });
});
