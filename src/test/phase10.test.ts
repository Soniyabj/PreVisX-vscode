import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { applySafeFix, createSafeFixPlans, validateSafeFixPlan } from '../fixes/safeFixes';
import { detectProject } from '../detectors/projectDetector';
import { runReadinessCheck } from '../checks/readinessCheck';

suite('Phase 10 Safe Fixes', () => {
  test('plans supported fixes without executing them', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-phase10-node-'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'demo' }, null, 2));
    fs.writeFileSync(path.join(root, '.env.example'), 'PORT=3000\n');

    const project = detectProject(root);
    const plans = createSafeFixPlans(project, runReadinessCheck(project, root), root);

    assert.deepStrictEqual(plans.map((plan) => plan.kind), [
      'install-node-dependencies',
      'copy-environment-template',
    ]);
    assert.strictEqual(fs.existsSync(path.join(root, '.env')), false);
  });

  test('does not execute or mutate when approval is denied', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-phase10-denied-'));
    const plan = {
      id: 'fix-test',
      kind: 'copy-environment-template' as const,
      title: 'Copy environment template',
      description: 'Test plan',
      rootPath: root,
      operation: 'copy' as const,
      sourcePath: path.join(root, '.env.example'),
      targetPath: path.join(root, '.env'),
    };
    let executed = false;

    const result = await applySafeFix(plan, async () => false, async () => {
      executed = true;
    }, async () => {
      executed = true;
    });

    assert.strictEqual(result.status, 'cancelled');
    assert.strictEqual(executed, false);
    assert.strictEqual(fs.existsSync(plan.targetPath), false);
  });

  test('executes only after approval and uses the planned operation', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-phase10-approved-'));
    const plan = {
      id: 'fix-test',
      kind: 'install-node-dependencies' as const,
      title: 'Install dependencies',
      description: 'Test plan',
      rootPath: root,
      operation: 'command' as const,
      command: 'npm',
      args: ['install'],
    };
    let executedCommand = '';

    const result = await applySafeFix(plan, async () => true, async (command, args, cwd) => {
      executedCommand = `${command} ${args.join(' ')} ${cwd}`;
    });

    assert.strictEqual(result.status, 'applied');
    assert.ok(executedCommand.startsWith('npm install'));
    assert.ok(executedCommand.endsWith(root));
  });

  test('accepts a Safe Fix rooted in an active workspace', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-phase10-workspace-'));
    const plan = {
      id: 'workspace-fix',
      kind: 'install-node-dependencies' as const,
      title: 'Install dependencies',
      description: 'Test plan',
      rootPath: root,
      operation: 'command' as const,
      command: 'npm',
      args: ['install'],
    };

    assert.strictEqual(validateSafeFixPlan(plan, [root]), true);
  });

  test('rejects plans outside the active workspace', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-phase10-active-'));
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-phase10-outside-'));
    const plan = {
      id: 'outside-fix',
      kind: 'install-node-dependencies' as const,
      title: 'Install dependencies',
      description: 'Test plan',
      rootPath: outsideRoot,
      operation: 'command' as const,
      command: 'npm',
      args: ['install'],
    };

    assert.strictEqual(validateSafeFixPlan(plan, [workspaceRoot]), false);
  });

  test('rejects path traversal and unsupported operations', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-phase10-boundary-'));
    const traversalPlan = {
      id: 'traversal-fix',
      kind: 'create-python-venv' as const,
      title: 'Create environment',
      description: 'Test plan',
      rootPath: root,
      operation: 'command' as const,
      command: 'python',
      args: ['-m', 'venv', '..\\outside'],
    };
    const unsupportedPlan = {
      id: 'unsupported-fix',
      kind: 'install-node-dependencies' as const,
      title: 'Unsupported operation',
      description: 'Test plan',
      rootPath: root,
      operation: 'copy' as const,
      command: 'npm',
      args: ['install'],
    };

    assert.strictEqual(validateSafeFixPlan(traversalPlan, [root]), false);
    assert.strictEqual(validateSafeFixPlan(unsupportedPlan, [root]), false);
  });

  test('rejects invalid commands and arguments', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'previs-phase10-command-'));
    const plan = {
      id: 'invalid-command-fix',
      kind: 'install-node-dependencies' as const,
      title: 'Install dependencies',
      description: 'Test plan',
      rootPath: root,
      operation: 'command' as const,
      command: 'cmd.exe',
      args: ['/c', 'npm install'],
    };

    assert.strictEqual(validateSafeFixPlan(plan, [root]), false);
  });
});