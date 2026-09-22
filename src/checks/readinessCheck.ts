import * as fs from 'fs';
import * as path from 'path';

import { CheckResult, DetectedProject, ReadinessSummary, RuntimeToolResult } from '../models/types';
import { collectProjectRuntimeDiagnostics } from '../runtime/runtimeDetector';

export async function runProjectReadinessCheck(project: DetectedProject, rootPath: string): Promise<ReadinessSummary> {
  const runtimeResults = await collectProjectRuntimeDiagnostics(project);
  return runReadinessCheck(project, rootPath, runtimeResults);
}

export function runReadinessCheck(project: DetectedProject, rootPath: string, runtimeResults: RuntimeToolResult[] = []): ReadinessSummary {
  const checks: CheckResult[] = [];

  const runtimeStatus = checkRuntime(project, runtimeResults);
  const dependencyStatus = checkDependencies(project, rootPath);
  const envStatus = checkEnvironment(project, rootPath);
  const configStatus = checkConfiguration(project, rootPath);
  const buildStatus = checkBuildConfiguration(project, rootPath);
  const portStatus = checkPortConfiguration(project, rootPath);

  checks.push(runtimeStatus, dependencyStatus, envStatus, configStatus, buildStatus, portStatus);

  const total = checks.length;
  const passed = checks.filter((check) => check.status === 'pass').length;
  const score = Math.round((passed / total) * 100);

  return {
    score,
    checks,
    project,
  };
}

function checkRuntime(project: DetectedProject, runtimeResults: RuntimeToolResult[]): CheckResult {
  const relevant = runtimeResults.filter((result) => result.relevant);
  if (relevant.length === 0) {
    return {
      id: 'runtime',
      category: 'runtime',
      name: 'Runtime check',
      status: 'unknown',
      message: 'No supported runtime was identified for this project.',
    };
  }

  const available = new Set(relevant.filter((result) => result.available).map((result) => result.tool));
  const missing: string[] = [];
  const optionalMissing: string[] = [];

  if (project.projectTypes.includes('nodejs')) {
    if (!available.has('node')) { missing.push('Node.js'); }
    if (!available.has('npm')) { missing.push('npm'); }
    if (!available.has('yarn')) { optionalMissing.push('Yarn'); }
    if (!available.has('pnpm')) { optionalMissing.push('pnpm'); }
  }
  if (project.projectTypes.includes('python') && !available.has('python') && !available.has('py')) { missing.push('Python'); }
  if (project.projectTypes.includes('java') && !available.has('java')) { missing.push('Java'); }
  if (project.projectTypes.includes('c-cpp') && !['gcc', 'g++', 'clang', 'clang++', 'cl'].some((tool) => available.has(tool))) { missing.push('C/C++ compiler'); }

  return {
    id: 'runtime',
    category: 'runtime',
    name: 'Runtime check',
    status: missing.length === 0 ? (optionalMissing.length === 0 ? 'pass' : 'warning') : 'fail',
    message: missing.length === 0
      ? optionalMissing.length === 0
        ? 'Required runtimes are available.'
        : `Required runtimes are available; optional tools are missing: ${optionalMissing.join(', ')}.`
      : `Required runtimes are unavailable: ${missing.join(', ')}.`,
  };
}

function checkDependencies(project: DetectedProject, rootPath: string): CheckResult {
  const hasNodeInstall = fs.existsSync(path.join(rootPath, 'node_modules'));
  const hasRequirements = fs.existsSync(path.join(rootPath, 'requirements.txt'));
  const hasPyProject = fs.existsSync(path.join(rootPath, 'pyproject.toml'));
  const hasPipfile = fs.existsSync(path.join(rootPath, 'Pipfile'));
  const hasVenv = fs.existsSync(path.join(rootPath, '.venv')) || fs.existsSync(path.join(rootPath, 'venv'));
  const hasPom = fs.existsSync(path.join(rootPath, 'pom.xml'));
  const hasGradle = fs.existsSync(path.join(rootPath, 'build.gradle')) || fs.existsSync(path.join(rootPath, 'build.gradle.kts'));

  if (project.projectTypes.includes('nodejs')) {
    return {
      id: 'dependencies-node',
      category: 'dependencies',
      name: 'Node dependencies',
      status: hasNodeInstall ? 'pass' : 'fail',
      message: hasNodeInstall ? 'node_modules is present.' : 'node_modules was not found; install dependencies before running the app.',
    };
  }

  if (project.projectTypes.includes('python')) {
    if (hasRequirements || hasPyProject || hasPipfile) {
      return {
        id: 'dependencies-python',
        category: 'dependencies',
        name: 'Python dependencies',
        status: hasVenv ? 'pass' : 'warning',
        message: hasVenv
          ? 'Python dependency manifest and virtual environment were detected.'
          : 'Python dependency manifest was detected, but no virtual environment was found.',
      };
    }

    return {
      id: 'dependencies-python',
      category: 'dependencies',
      name: 'Python dependencies',
      status: 'warning',
      message: 'No Python dependency manifest was detected.',
    };
  }

  if (project.projectTypes.includes('java')) {
    return {
      id: 'dependencies-java',
      category: 'dependencies',
      name: 'Java dependencies',
      status: hasPom || hasGradle ? 'pass' : 'warning',
      message: hasPom || hasGradle ? 'Java dependency/build configuration was detected.' : 'No Java dependency manifest was found.',
    };
  }

  return {
    id: 'dependencies-default',
    category: 'dependencies',
    name: 'Dependency check',
    status: 'unknown',
    message: 'No dependency check was applicable for the detected project type.',
  };
}

function checkEnvironment(project: DetectedProject, rootPath: string): CheckResult {
  const envFiles = ['.env', '.env.local', '.env.example', '.env.development'];
  const found = envFiles.filter((file) => fs.existsSync(path.join(rootPath, file)));
  const hasRuntimeEnvironment = found.some((file) => file !== '.env.example');
  const hasEnvironmentTemplate = found.includes('.env.example');

  if (project.projectTypes.includes('python') || project.projectTypes.includes('nodejs') || project.projectTypes.includes('java')) {
    return {
      id: 'environment',
      category: 'environment',
      name: 'Environment configuration',
      status: hasRuntimeEnvironment ? 'pass' : 'warning',
      message: hasRuntimeEnvironment
        ? `Environment files found: ${found.join(', ')}`
        : hasEnvironmentTemplate
          ? '.env.example was found, but no active environment file was detected.'
          : 'No environment file was detected. Check for .env and required configuration values.',
      details: hasEnvironmentTemplate
        ? 'Use the example as a template and verify the active environment values before running the project.'
        : undefined,
    };
  }

  return {
    id: 'environment-default',
    category: 'environment',
    name: 'Environment configuration',
    status: 'unknown',
    message: 'No environment-specific check was applicable.',
  };
}

function checkConfiguration(project: DetectedProject, rootPath: string): CheckResult {
  if (project.reasons.includes('package.json is invalid JSON')) {
    return {
      id: 'configuration',
      category: 'configuration',
      name: 'Project configuration',
      status: 'fail',
      message: 'package.json contains invalid JSON and could not be inspected safely.',
      details: 'Fix the JSON syntax before relying on Node project configuration.',
    };
  }
  const requiredFiles = [
    ...(project.projectTypes.includes('nodejs')
      ? ['package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js', 'next.config.js', 'next.config.mjs']
      : []),
    ...(project.projectTypes.includes('python')
      ? ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py', 'setup.cfg', 'manage.py']
      : []),
    ...(project.projectTypes.includes('java') ? ['pom.xml', 'build.gradle', 'build.gradle.kts'] : []),
    ...(project.projectTypes.includes('c-cpp') ? ['Makefile', 'CMakeLists.txt'] : []),
  ];

  const found = requiredFiles.filter((file) => fs.existsSync(path.join(rootPath, file)));
  const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(rootPath, file)));

  if (found.length === 0) {
    return {
      id: 'configuration',
      category: 'configuration',
      name: 'Project configuration',
      status: 'warning',
      message: 'No expected configuration files were found for the project type.',
      details: requiredFiles.length > 0 ? `Expected files include: ${requiredFiles.join(', ')}` : undefined,
    };
  }

  return {
    id: 'configuration',
    category: 'configuration',
    name: 'Project configuration',
    status: 'pass',
    message: `Required project configuration files were found: ${found.join(', ')}`,
    details: missing.length > 0 ? `Optional or additional expected files not found: ${missing.join(', ')}` : undefined,
  };
}

function checkBuildConfiguration(project: DetectedProject, rootPath: string): CheckResult {
  const packageJsonPath = path.join(rootPath, 'package.json');
  let hasNodeBuildScript = false;

  if (project.projectTypes.includes('nodejs') && fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { scripts?: Record<string, string> };
      hasNodeBuildScript = typeof packageJson.scripts?.build === 'string' && packageJson.scripts.build.trim().length > 0;
    } catch {
      hasNodeBuildScript = false;
    }
  }

  const buildFiles = [
    ...(project.projectTypes.includes('python') ? ['pyproject.toml', 'setup.py', 'setup.cfg'] : []),
    ...(project.projectTypes.includes('java') ? ['pom.xml', 'build.gradle', 'build.gradle.kts'] : []),
    ...(project.projectTypes.includes('c-cpp') ? ['Makefile', 'CMakeLists.txt'] : []),
  ];
  const foundBuildFile = buildFiles.find((file) => fs.existsSync(path.join(rootPath, file)));
  const configured = hasNodeBuildScript || Boolean(foundBuildFile);

  if (project.projectTypes.includes('unknown')) {
    return {
      id: 'build-default',
      category: 'build',
      name: 'Build configuration',
      status: 'unknown',
      message: 'No supported project type was detected for build validation.',
    };
  }

  return {
    id: 'build',
    category: 'build',
    name: 'Build configuration',
    status: configured ? 'pass' : 'warning',
    message: configured
      ? `Build configuration detected: ${hasNodeBuildScript ? 'package.json build script' : foundBuildFile}.`
      : 'No build script or build configuration file was detected; build validation is not available.',
  };
}

function checkPortConfiguration(project: DetectedProject, rootPath: string): CheckResult {
  if (!project.projectTypes.some((type) => ['nodejs', 'python', 'java'].includes(type))) {
    return {
      id: 'port-default',
      category: 'port',
      name: 'Development port',
      status: 'unknown',
      message: 'No supported web project type was detected for port validation.',
    };
  }

  const portSources: Array<{ file: string; pattern: RegExp }> = [
    ...['.env', '.env.local', '.env.development'].map((file) => ({
      file,
      pattern: /(?:^|\s|["'])PORT\s*[=:]\s*["']?(\d{2,5})/i,
    })),
    { file: 'package.json', pattern: /(?:--port(?:=|\s+)|port\s*[=:]\s*["']?)(\d{2,5})/i },
    { file: 'application.properties', pattern: /(?:^|\s)server\.port\s*=\s*(\d{2,5})/i },
    { file: 'application.yml', pattern: /(?:^|\s)port\s*:\s*(\d{2,5})/i },
    { file: 'application.yaml', pattern: /(?:^|\s)port\s*:\s*(\d{2,5})/i },
  ];
  const configuredPort = portSources
    .map(({ file, pattern }) => {
      const fullPath = path.join(rootPath, file);
      if (!fs.existsSync(fullPath)) {
        return undefined;
      }

      const contents = fs.readFileSync(fullPath, 'utf8');
      const match = contents.match(pattern);
      return match?.[1] ? { file, port: match[1] } : undefined;
    })
    .find(Boolean);

  return {
    id: 'port',
    category: 'port',
    name: 'Development port',
    status: configuredPort ? 'pass' : 'warning',
    message: configuredPort
      ? `Development port configuration detected: ${configuredPort.port} (${configuredPort.file}).`
      : 'No PORT setting was detected in the project environment files.',
    details: 'Phase 7 reports configured ports only; it does not start processes or modify project files.',
  };
}
