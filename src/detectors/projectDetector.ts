import * as fs from 'fs';
import * as path from 'path';

import { DetectedProject } from '../models/types';

export function detectProject(rootPath: string): DetectedProject {
  const frameworkSet = new Set<string>();
  const projectTypes: string[] = [];
  const reasons: string[] = [];

  const files = fs.existsSync(rootPath) ? fs.readdirSync(rootPath) : [];

  if (files.includes('package.json')) {
    projectTypes.push('nodejs');
    reasons.push('Found package.json');

    let pkg: { scripts?: Record<string, string> } = {};
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(rootPath, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
    } catch {
      reasons.push('package.json is invalid JSON');
    }
    const scripts = pkg.scripts ?? {};

    if (scripts.dev || scripts.start) {
      reasons.push('Package scripts detected');
    }

    const scriptText = Object.values(scripts).join(' ');
    if (scriptText.toLowerCase().includes('vite')) {
      frameworkSet.add('vite');
    }
    if (scriptText.toLowerCase().includes('next')) {
      frameworkSet.add('nextjs');
    }
    if (files.some((file) => file.startsWith('vite.config'))) {
      frameworkSet.add('vite');
    }
    if (files.some((file) => file.startsWith('next.config'))) {
      frameworkSet.add('nextjs');
    }
    if (files.includes('tsconfig.json')) {
      frameworkSet.add('typescript');
    }
  }

  if (files.includes('requirements.txt') || files.includes('pyproject.toml') || files.includes('Pipfile')) {
    projectTypes.push('python');
    reasons.push('Found Python project manifest');

    if (files.includes('manage.py')) {
      frameworkSet.add('django');
    }

    if (files.includes('requirements.txt')) {
      const requirements = fs.readFileSync(path.join(rootPath, 'requirements.txt'), 'utf8').toLowerCase();
      if (requirements.includes('fastapi')) {
        frameworkSet.add('fastapi');
      }
      if (requirements.includes('flask')) {
        frameworkSet.add('flask');
      }
    }
  }

  if (files.includes('pom.xml') || files.includes('build.gradle') || files.includes('build.gradle.kts')) {
    projectTypes.push('java');
    reasons.push('Found Java build file');

    if (files.includes('pom.xml')) {
      frameworkSet.add('maven');
    }
    if (files.includes('build.gradle') || files.includes('build.gradle.kts')) {
      frameworkSet.add('gradle');
    }
  }

  if (files.includes('Makefile') || files.some((file) => file.endsWith('.c') || file.endsWith('.h') || file.endsWith('.cpp') || file.endsWith('.cc'))) {
    projectTypes.push('c-cpp');
    reasons.push('Found C/C++ source files');
  }

  if (projectTypes.length === 0) {
    projectTypes.push('unknown');
  }

  const languageSummary = Array.from(new Set(projectTypes));

  return {
    rootPath,
    projectTypes,
    detectedFrameworks: Array.from(frameworkSet),
    packageManager: files.includes('yarn.lock') ? 'yarn' : files.includes('pnpm-lock.yaml') ? 'pnpm' : files.includes('package-lock.json') ? 'npm' : undefined,
    languageSummary,
    confidence: Math.min(98, 50 + projectTypes.length * 20 + frameworkSet.size * 5),
    reasons,
  };
}
