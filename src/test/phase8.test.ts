import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { detectProject } from '../detectors/projectDetector';
import { runReadinessCheck } from '../checks/readinessCheck';

suite('Phase 8 common configuration diagnostics', () => {
  test('reports common Node configuration and script port declarations', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-phase8-node-'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      name: 'demo',
      scripts: { dev: 'vite --port 5174' },
    }, null, 2));
    fs.writeFileSync(path.join(root, 'vite.config.ts'), 'export default {}\n');

    const summary = runReadinessCheck(detectProject(root), root);
    const configurationCheck = summary.checks.find((check) => check.category === 'configuration');
    const portCheck = summary.checks.find((check) => check.category === 'port');

    assert.strictEqual(configurationCheck?.status, 'pass');
    assert.ok(configurationCheck?.message.includes('vite.config.ts'));
    assert.strictEqual(portCheck?.status, 'pass');
    assert.ok(portCheck?.message.includes('5174'));
  });

  test('reports Java application port configuration', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-phase8-java-'));
    fs.writeFileSync(path.join(root, 'pom.xml'), '<project />');
    fs.writeFileSync(path.join(root, 'application.properties'), 'server.port=8081\n');

    const summary = runReadinessCheck(detectProject(root), root);
    const portCheck = summary.checks.find((check) => check.category === 'port');

    assert.strictEqual(portCheck?.status, 'pass');
    assert.ok(portCheck?.message.includes('8081'));
  });

  test('recognizes CMake as common C/C++ configuration', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-phase8-cpp-'));
    fs.writeFileSync(path.join(root, 'main.cpp'), 'int main() { return 0; }\n');
    fs.writeFileSync(path.join(root, 'CMakeLists.txt'), 'project(demo)\n');

    const summary = runReadinessCheck(detectProject(root), root);
    const configurationCheck = summary.checks.find((check) => check.category === 'configuration');

    assert.strictEqual(configurationCheck?.status, 'pass');
    assert.ok(configurationCheck?.message.includes('CMakeLists.txt'));
  });
});