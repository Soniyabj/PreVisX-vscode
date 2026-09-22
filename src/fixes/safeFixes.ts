import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import { DetectedProject, ReadinessSummary, SafeFixPlan, SafeFixResult } from '../models/types';

const execFile = promisify(childProcess.execFile);

export type SafeFixApproval = () => Promise<boolean>;
export type SafeFixCommandExecutor = (command: string, args: string[], cwd: string) => Promise<void>;
export type SafeFixFileCopier = (sourcePath: string, targetPath: string) => Promise<void>;

function isInsideRoot(candidatePath: string, rootPath: string): boolean {
  const relativePath = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
  return relativePath === '' || (!relativePath.startsWith(`..${path.sep}`) && relativePath !== '..' && !path.isAbsolute(relativePath));
}

export function validateSafeFixPlan(plan: SafeFixPlan, workspaceRoots: readonly string[] = [plan.rootPath]): boolean {
  if (!path.isAbsolute(plan.rootPath) || !fs.existsSync(plan.rootPath) || !fs.statSync(plan.rootPath).isDirectory()) { return false; }
  const rootPath = path.resolve(plan.rootPath);
  if (!workspaceRoots.some((workspaceRoot) => path.isAbsolute(workspaceRoot) && isInsideRoot(rootPath, workspaceRoot))) { return false; }

  if (plan.kind === 'install-node-dependencies') {
    return plan.operation === 'command'
      && plan.command === 'npm'
      && JSON.stringify(plan.args) === JSON.stringify(['install'])
      && !plan.sourcePath
      && !plan.targetPath;
  }

  if (plan.kind === 'create-python-venv') {
    return plan.operation === 'command'
      && plan.command === 'python'
      && JSON.stringify(plan.args) === JSON.stringify(['-m', 'venv', '.venv'])
      && path.resolve(rootPath, '.venv') === path.resolve(rootPath, plan.args?.[2] ?? '')
      && !plan.sourcePath
      && !plan.targetPath;
  }

  if (plan.kind === 'copy-environment-template') {
    return plan.operation === 'copy'
      && path.resolve(plan.sourcePath ?? '') === path.resolve(rootPath, '.env.example')
      && path.resolve(plan.targetPath ?? '') === path.resolve(rootPath, '.env');
  }

  return false;
}

export function createSafeFixPlans(
  project: DetectedProject,
  summary: ReadinessSummary,
  rootPath: string,
): SafeFixPlan[] {
  const plans: SafeFixPlan[] = [];
  const dependencyCheck = summary.checks.find((check) => check.category === 'dependencies');
  const environmentCheck = summary.checks.find((check) => check.category === 'environment');

  if (project.projectTypes.includes('nodejs') && dependencyCheck?.id === 'dependencies-node' && dependencyCheck.status === 'fail') {
    plans.push({
      id: 'fix-node-dependencies',
      kind: 'install-node-dependencies',
      title: 'Install Node.js dependencies',
      description: 'Run npm install in the detected project workspace.',
      rootPath,
      operation: 'command',
      command: 'npm',
      args: ['install'],
    });
  }

  if (project.projectTypes.includes('python')
    && dependencyCheck?.id === 'dependencies-python'
    && dependencyCheck.status === 'warning'
    && !fs.existsSync(path.join(rootPath, '.venv'))
    && !fs.existsSync(path.join(rootPath, 'venv'))) {
    plans.push({
      id: 'fix-python-venv',
      kind: 'create-python-venv',
      title: 'Create Python virtual environment',
      description: 'Run python -m venv .venv in the detected project workspace.',
      rootPath,
      operation: 'command',
      command: 'python',
      args: ['-m', 'venv', '.venv'],
    });
  }

  const templatePath = path.join(rootPath, '.env.example');
  const activeEnvironmentPath = path.join(rootPath, '.env');
  if (environmentCheck?.id === 'environment'
    && environmentCheck.status === 'warning'
    && fs.existsSync(templatePath)
    && !fs.existsSync(activeEnvironmentPath)) {
    plans.push({
      id: 'fix-environment-template',
      kind: 'copy-environment-template',
      title: 'Create active environment file',
      description: 'Copy .env.example to .env so the project has an active environment template.',
      rootPath,
      operation: 'copy',
      sourcePath: templatePath,
      targetPath: activeEnvironmentPath,
    });
  }

  return plans;
}

export async function applySafeFix(
  plan: SafeFixPlan,
  requestApproval: SafeFixApproval,
  executeCommand: SafeFixCommandExecutor = defaultCommandExecutor,
  copyFile: SafeFixFileCopier = defaultFileCopier,
  workspaceRoots: readonly string[] = [plan.rootPath],
): Promise<SafeFixResult> {
  if (!validateSafeFixPlan(plan, workspaceRoots)) {
    return { plan, status: 'failed', message: 'Safe Fix plan was rejected as unsupported or unsafe.' };
  }

  const approved = await requestApproval();
  if (!approved) {
    return { plan, status: 'cancelled', message: 'Safe Fix was cancelled; no changes were made.' };
  }

  try {
    if (plan.operation === 'command' && plan.command && plan.args) {
      await executeCommand(plan.command, plan.args, plan.rootPath);
    } else if (plan.operation === 'copy' && plan.sourcePath && plan.targetPath) {
      await copyFile(plan.sourcePath, plan.targetPath);
    } else {
      return { plan, status: 'failed', message: 'Safe Fix plan is incomplete; no changes were made.' };
    }

    return { plan, status: 'applied', message: `${plan.title} completed.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The Safe Fix failed.';
    return { plan, status: 'failed', message };
  }
}

async function defaultCommandExecutor(command: string, args: string[], cwd: string): Promise<void> {
  await execFile(command, args, { cwd, shell: false });
}

async function defaultFileCopier(sourcePath: string, targetPath: string): Promise<void> {
  await fs.promises.copyFile(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
}