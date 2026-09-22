import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import { buildPrevisHtml, PrevisViewProvider } from '../webview/PrevisViewProvider';
import { DetectedProject, ReadinessSummary } from '../models/types';

const project: DetectedProject = {
  rootPath: '/tmp/previs-ui-test',
  projectTypes: ['nodejs'],
  detectedFrameworks: ['vite'],
  languageSummary: ['nodejs'],
  confidence: 95,
  reasons: ['Found package.json'],
};

const summary: ReadinessSummary = {
  project,
  score: 67,
  checks: [
    {
      id: 'environment',
      category: 'environment',
      name: 'Environment configuration',
      status: 'warning',
      message: 'No environment file was detected.',
    },
  ],
};

suite('PreVisX sidebar UI', () => {
  test('configures a dedicated currentColor Activity Bar icon', () => {
    const projectRoot = path.resolve(__dirname, '../..');
    const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')) as {
      contributes: { viewsContainers: { activitybar: Array<{ id: string; icon: string }> } };
    };
    const activityBar = manifest.contributes.viewsContainers.activitybar.find((container) => container.id === 'previsx');
    const svg = fs.readFileSync(path.join(projectRoot, activityBar?.icon ?? ''), 'utf8');

    assert.strictEqual(activityBar?.icon, 'resources/previs-activity.svg');
    assert.ok(svg.includes('viewBox="0 0 24 24"'));
    assert.ok(svg.includes('fill="currentColor"'));
    assert.ok(!svg.includes('linearGradient'));
  });

  test('recalculates the complete sidebar state for a Run Full Check message', async () => {
    let messageHandler: ((message: unknown) => Promise<void>) | undefined;
    let detectionCalls = 0;
    let readinessCalls = 0;
    const webview = {
      html: '',
      options: {},
      onDidReceiveMessage: (listener: (message: unknown) => Promise<void>) => {
        messageHandler = listener;
        return { dispose: () => undefined };
      },
      postMessage: async () => true,
    };
    const view = {
      title: '',
      description: '',
      webview,
      onDidDispose: () => ({ dispose: () => undefined }),
    };
    const provider = new PrevisViewProvider({
      getWorkspaceRoot: () => '/tmp/current-workspace',
      detectProject: (rootPath) => {
        detectionCalls += 1;
        assert.strictEqual(rootPath, '/tmp/current-workspace');
        return project;
      },
      runProjectReadinessCheck: async (detectedProject, rootPath) => {
        readinessCalls += 1;
        assert.strictEqual(detectedProject, project);
        assert.strictEqual(rootPath, '/tmp/current-workspace');
        return summary;
      },
      now: () => new Date('2026-09-22T12:34:56.000Z'),
    });

    await provider.resolveWebviewView(view as never, {} as never, {} as never);
    await messageHandler?.({ command: 'runFullCheck' });

    assert.strictEqual(detectionCalls, 2);
    assert.strictEqual(readinessCalls, 2);
    assert.ok(webview.html.includes('Environment configuration needs review'));
    assert.ok(webview.html.includes('datetime="2026-09-22T12:34:56.000Z"'));
  });

  test('renders Full Check progress and completion acknowledgement', () => {
    const html = buildPrevisHtml(project, summary, new Date('2026-09-22T12:34:56.000Z'));

    assert.ok(html.includes('Running full readiness check…'));
    assert.ok(html.includes('Last checked:'));
    assert.ok(html.includes('role="status" aria-live="polite"'));
  });

  test('renders the official tagline on three comfortable lines', () => {
    const html = buildPrevisHtml(project, summary);

    assert.ok(html.includes('aria-label="Project Readiness &amp; Environment Verification System"'));
    assert.ok(html.includes('<span>Project Readiness</span>'));
    assert.ok(html.includes('<span>&amp; Environment Verification</span>'));
    assert.ok(html.includes('<span>System</span>'));
    assert.ok(html.includes('.brand-tagline span'));
    assert.ok(html.includes('line-height: 1.5;'));
  });
});
