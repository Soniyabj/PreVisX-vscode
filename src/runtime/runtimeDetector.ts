import * as cp from 'child_process';
import { promisify } from 'util';

import { DetectedProject, RuntimeToolResult } from '../models/types';

export type { RuntimeToolResult } from '../models/types';

const execFileAsync = promisify(cp.execFile);

async function executeRuntimeCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  if (process.platform === 'win32' && command.endsWith('.cmd')) {
    const comSpec = process.env.ComSpec ?? 'cmd.exe';
    return execFileAsync(comSpec, ['/d', '/s', '/c', command, ...args], { shell: false }) as Promise<{ stdout: string; stderr: string }>;
  }

  return execFileAsync(command, args, { shell: false }) as Promise<{ stdout: string; stderr: string }>;
}

export type RuntimeExec = (
  command: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string }>;

export async function getRuntimeToolInfo(
  tool: string,
  command: string,
  args: string[],
  relevant: boolean,
  execFn: RuntimeExec = executeRuntimeCommand,
): Promise<RuntimeToolResult> {
  try {
    const result = await execFn(command, args);
    const output = String(result.stdout ?? '').trim();
    const version = output || String(result.stderr ?? '').trim() || 'unknown';

    return {
      tool,
      available: true,
      version,
      command,
      args,
      message: `${tool} is installed and available.`,
      severity: 'info',
      relevant,
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    const message = nodeError?.code === 'ENOENT'
      ? `${tool} is not installed or not available on PATH.`
      : `${tool} could not be executed successfully.`;

    return {
      tool,
      available: false,
      command,
      args,
      version: undefined,
      message,
      severity: 'warning',
      relevant,
    };
  }
}

export async function collectProjectRuntimeDiagnostics(
  project: DetectedProject,
  execFn: RuntimeExec = executeRuntimeCommand,
): Promise<RuntimeToolResult[]> {
  const runtimeResults: RuntimeToolResult[] = [];

  const isNodeProject = project.projectTypes.includes('nodejs');
  const isPythonProject = project.projectTypes.includes('python');
  const isJavaProject = project.projectTypes.includes('java');
  const isCppProject = project.projectTypes.includes('c-cpp');

  const commands: Array<{ tool: string; command: string; args: string[]; relevant: boolean }> = [
    { tool: 'node', command: 'node', args: ['--version'], relevant: isNodeProject },
    { tool: 'npm', command: 'npm', args: ['--version'], relevant: isNodeProject },
    { tool: 'yarn', command: 'yarn', args: ['--version'], relevant: isNodeProject },
    { tool: 'pnpm', command: 'pnpm', args: ['--version'], relevant: isNodeProject },
    { tool: 'python', command: 'python', args: ['--version'], relevant: isPythonProject },
    { tool: 'py', command: 'py', args: ['--version'], relevant: isPythonProject },
    { tool: 'java', command: 'java', args: ['--version'], relevant: isJavaProject },
    { tool: 'gcc', command: 'gcc', args: ['--version'], relevant: isCppProject },
    { tool: 'g++', command: 'g++', args: ['--version'], relevant: isCppProject },
    { tool: 'clang', command: 'clang', args: ['--version'], relevant: isCppProject },
    { tool: 'clang++', command: 'clang++', args: ['--version'], relevant: isCppProject },
    { tool: 'cl', command: 'cl', args: ['/?',], relevant: isCppProject },
  ];

  for (const command of commands) {
    if (!command.relevant) {
      continue;
    }

    const executable = process.platform === 'win32' && ['npm', 'yarn', 'pnpm'].includes(command.command)
      ? `${command.command}.cmd`
      : command.command;
    const result = await getRuntimeToolInfo(command.tool, executable, command.args, command.relevant, execFn);
    runtimeResults.push(result);
  }

  return runtimeResults;
}
