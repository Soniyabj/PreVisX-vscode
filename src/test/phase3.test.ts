import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { detectProject } from '../detectors/projectDetector';
import { runReadinessCheck } from '../checks/readinessCheck';

suite('Phase 3 project detection and readiness', () => {
  test('detects a Node.js project', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-node-'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'demo-app', scripts: { dev: 'vite' } }, null, 2));
    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });

    const project = detectProject(root);

    assert.ok(project.projectTypes.includes('nodejs'));
    assert.ok(project.detectedFrameworks.includes('vite'));
  });

  test('detects a Python project and reports readiness', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-python-'));
    fs.writeFileSync(path.join(root, 'requirements.txt'), 'django==5.0.0\n');
    fs.writeFileSync(path.join(root, '.env.example'), 'DEBUG=True\n');

    const project = detectProject(root);
    const readiness = runReadinessCheck(project, root);

    assert.ok(project.projectTypes.includes('python'));
    assert.ok(readiness.checks.some((check) => check.category === 'environment'));
  });

  test('detects a Java project', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-java-'));
    fs.writeFileSync(path.join(root, 'pom.xml'), '<project><modelVersion>4.0.0</modelVersion></project>');

    const project = detectProject(root);

    assert.ok(project.projectTypes.includes('java'));
  });
});
