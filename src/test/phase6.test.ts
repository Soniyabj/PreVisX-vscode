import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { detectProject } from '../detectors/projectDetector';
import { runReadinessCheck } from '../checks/readinessCheck';

suite('Phase 6 environment and configuration checks', () => {
  test('warns when only an environment template is present', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-phase6-env-template-'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'demo' }, null, 2));
    fs.writeFileSync(path.join(root, '.env.example'), 'PORT=3000\n');

    const project = detectProject(root);
    const summary = runReadinessCheck(project, root);
    const environmentCheck = summary.checks.find((check) => check.category === 'environment');

    assert.ok(environmentCheck);
    assert.strictEqual(environmentCheck?.status, 'warning');
    assert.ok(environmentCheck?.message.includes('active environment file'));
  });

  test('passes when an active environment file is present', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-phase6-env-active-'));
    fs.writeFileSync(path.join(root, 'requirements.txt'), 'flask==3.0.0\n');
    fs.writeFileSync(path.join(root, '.env'), 'PORT=8000\n');

    const project = detectProject(root);
    const summary = runReadinessCheck(project, root);
    const environmentCheck = summary.checks.find((check) => check.category === 'environment');

    assert.ok(environmentCheck);
    assert.strictEqual(environmentCheck?.status, 'pass');
  });

  test('reports detected project configuration and missing expected files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-phase6-config-'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'demo' }, null, 2));

    const project = detectProject(root);
    const summary = runReadinessCheck(project, root);
    const configurationCheck = summary.checks.find((check) => check.category === 'configuration');

    assert.ok(configurationCheck);
    assert.strictEqual(configurationCheck?.status, 'pass');
    assert.ok(configurationCheck?.message.includes('package.json'));
    assert.ok(configurationCheck?.details?.includes('tsconfig.json'));
  });
});