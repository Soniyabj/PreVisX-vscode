import * as vscode from 'vscode';
import { randomBytes } from 'crypto';

import { detectProject } from '../detectors/projectDetector';
import { runProjectReadinessCheck } from '../checks/readinessCheck';
import { diagnoseReadiness } from '../diagnosis/diagnosisEngine';

type CheckCommand = 'refresh' | 'runFullCheck';

interface PrevisViewDependencies {
  getWorkspaceRoot: () => string;
  detectProject: typeof detectProject;
  runProjectReadinessCheck: typeof runProjectReadinessCheck;
  now: () => Date;
}

const defaultDependencies: PrevisViewDependencies = {
  getWorkspaceRoot: () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd(),
  detectProject,
  runProjectReadinessCheck,
  now: () => new Date(),
};

export function isCheckCommand(message: unknown): message is { command: CheckCommand } {
  return typeof message === 'object'
    && message !== null
    && 'command' in message
    && (((message as { command?: unknown }).command === 'refresh') || ((message as { command?: unknown }).command === 'runFullCheck'));
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[character] ?? character));
}

export function createCsp(nonce: string): string {
  return `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';`;
}

export class PrevisViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'previsxSidebar';
  private refreshView?: () => Promise<void>;

  public constructor(private readonly dependencies: PrevisViewDependencies = defaultDependencies) {}

  public async refresh(): Promise<void> {
    await this.refreshView?.();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): Thenable<void> {
    webviewView.title = 'PreVisX';
    webviewView.description = 'Project Readiness & Environment Verification';
    webviewView.webview.options = {
      enableScripts: true,
    };

    const refresh = async () => {
      try {
        // Resolve this when the action runs so the sidebar follows the active workspace.
        const workspaceRoot = this.dependencies.getWorkspaceRoot();
        const project = this.dependencies.detectProject(workspaceRoot);
        const summary = await this.dependencies.runProjectReadinessCheck(project, workspaceRoot);
        webviewView.webview.html = buildPrevisHtml(project, summary, this.dependencies.now());
      } catch (error) {
        console.error('PreVisX readiness check failed.', error);
        void vscode.window.showErrorMessage('PreVisX could not complete the readiness check. Try again or check the Extension Host log.');
        await webviewView.webview.postMessage({ command: 'checkFailed' });
      }
    };
    this.refreshView = refresh;

    const messageDisposable = webviewView.webview.onDidReceiveMessage(async (message: unknown) => {
      if (isCheckCommand(message)) {
        await refresh();
      }
    });
    webviewView.onDidDispose(() => messageDisposable.dispose());

    return refresh();
  }

}

export function buildPrevisHtml(
  project: ReturnType<typeof detectProject>,
  summary: Awaited<ReturnType<typeof runProjectReadinessCheck>>,
  lastChecked?: Date,
): string {
    const projectName = escapeHtml(project.rootPath.split(/[/\\]/).filter(Boolean).pop() ?? 'workspace-root');
    const diagnosisReport = diagnoseReadiness(summary);
    const nonce = randomBytes(16).toString('base64');
    const lastCheckedMarkup = lastChecked
      ? `<time datetime="${lastChecked.toISOString()}">Last checked: ${escapeHtml(lastChecked.toLocaleString())}</time>`
      : 'Ready to check';
    const statusIndicators = [
      { name: 'Runtime', value: summary.checks.find((check) => check.category === 'runtime')?.status ?? 'unknown', symbol: '✓' },
      { name: 'Dependencies', value: summary.checks.find((check) => check.category === 'dependencies')?.status ?? 'unknown', symbol: '✓' },
      { name: 'Environment', value: summary.checks.find((check) => check.category === 'environment')?.status ?? 'unknown', symbol: '✓' },
      { name: 'Configuration', value: summary.checks.find((check) => check.category === 'configuration')?.status ?? 'unknown', symbol: '✓' },
      { name: 'Build', value: summary.checks.find((check) => check.category === 'build')?.status ?? 'unknown', symbol: '✓' },
      { name: 'Port', value: summary.checks.find((check) => check.category === 'port')?.status ?? 'unknown', symbol: '✓' },
    ];

    const statusMarkup = statusIndicators
      .map((item) => {
        const className = item.value === 'pass' ? 'ok' : item.value === 'warning' ? 'warn' : item.value === 'fail' ? 'fail' : 'unknown';
        const symbol = item.value === 'pass' ? '✓' : item.value === 'warning' ? '!' : item.value === 'fail' ? '✗' : '?';
        return `<div class="status-row"><span class="name">${item.name}</span><span class="value ${className}">${symbol}</span></div>`;
      })
      .join('');

    const detectionText = project.projectTypes.length > 0
      ? project.projectTypes.map(escapeHtml).join(' / ')
      : 'Unknown';

    const frameworksText = project.detectedFrameworks.length > 0
      ? project.detectedFrameworks.map(escapeHtml).join(', ')
      : 'No specific framework detected';

    const problems = diagnosisReport.diagnoses
      .map((diagnosis) => `<li><strong>${escapeHtml(diagnosis.title)}</strong>: ${escapeHtml(diagnosis.summary)}${diagnosis.evidence ? `<br /><span>Evidence: ${escapeHtml(diagnosis.evidence)}</span>` : ''}<br /><span>Recommendation: ${escapeHtml(diagnosis.recommendation)}</span></li>`)
      .join('');

    const safeProblems = problems || '<li>No immediate readiness issues detected in the current project structure.</li>';

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="Content-Security-Policy" content="${createCsp(nonce)}" />
        <title>PreVisX</title>
        <style nonce="${nonce}">
          :root {
            --bg: #0f172a;
            --panel: #111827;
            --panel-strong: #1f2937;
            --border: #334155;
            --text: #e2e8f0;
            --muted: #94a3b8;
            --success: #34d399;
            --warning: #fbbf24;
            --danger: #f87171;
            --primary: #38bdf8;
          }

          body {
            margin: 0;
            padding: 16px;
            background: var(--bg);
            color: var(--text);
            font-family: var(--vscode-font-family, sans-serif);
            line-height: 1.5;
          }

          .shell {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          .brand {
            display: flex;
            align-items: center;
            gap: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border);
          }

          .brand-mark {
            width: 36px;
            height: 28px;
            border-radius: 8px;
            display: grid;
            place-items: center;
            background: linear-gradient(135deg, #5eead4, #38bdf8, #8b5cf6);
            font-size: 0.72rem;
            font-weight: 700;
            color: #0f172a;
          }

          .brand-name {
            margin: 0;
            color: var(--text);
            font-family: var(--vscode-font-family, "Segoe UI", sans-serif);
            font-size: 1.18rem;
            font-weight: 800;
            letter-spacing: 0.01em;
            line-height: 1.15;
          }

          .brand-tagline {
            margin-top: 5px;
            color: var(--muted);
            font-family: var(--vscode-font-family, "Segoe UI", sans-serif);
            font-size: 0.74rem;
            font-weight: 400;
            letter-spacing: 0.03em;
            line-height: 1.5;
          }

          .brand-tagline span {
            display: block;
          }

          .check-status {
            min-height: 1.3em;
            color: var(--muted);
            font-size: 0.72rem;
            letter-spacing: 0.015em;
            text-align: right;
          }

          button:disabled {
            cursor: progress;
            opacity: 0.75;
          }

          .meta {
            color: var(--muted);
            font-size: 0.76rem;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          }

          .project-card,
          .score-card,
          .panel {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 12px 14px;
          }

          .label {
            font-size: 0.7rem;
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin-bottom: 6px;
          }

          .project-name {
            font-size: 1.1rem;
            font-weight: 600;
            margin: 0;
          }

          .score {
            font-size: 2.1rem;
            line-height: 1;
            margin: 0;
            font-weight: 700;
            color: var(--primary);
          }

          .score-sub {
            color: var(--muted);
            font-size: 0.8rem;
            margin-top: 6px;
          }

          .status-list {
            display: grid;
            gap: 8px;
            margin-top: 4px;
          }

          .status-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            font-size: 0.82rem;
          }

          .status-row .name {
            color: var(--text);
          }

          .status-row .value {
            font-weight: 700;
          }

          .ok { color: var(--success); }
          .warn { color: var(--warning); }
          .fail { color: var(--danger); }
          .unknown { color: var(--muted); }

          .button-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          button {
            background: #1e293b;
            color: var(--text);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 8px 10px;
            font-weight: 600;
            cursor: pointer;
          }

          button.primary {
            background: linear-gradient(135deg, #0ea5e9, #8b5cf6);
            border-color: transparent;
            color: white;
          }

          h2 {
            margin: 0 0 8px 0;
            font-size: 0.88rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--muted);
          }

          ul {
            margin: 0;
            padding-left: 18px;
            color: var(--text);
          }

          li {
            margin-bottom: 8px;
            font-size: 0.82rem;
          }
        </style>
      </head>
      <body>
        <div class="shell">
          <div class="brand">
            <div class="brand-mark">PVX</div>
            <div>
              <h1 class="brand-name">PreVisX</h1>
              <div class="brand-tagline" aria-label="Project Readiness &amp; Environment Verification System">
                <span>Project Readiness</span>
                <span>&amp; Environment Verification</span>
                <span>System</span>
              </div>
            </div>
          </div>

          <div class="project-card">
            <div class="label">Project</div>
            <p class="project-name">${projectName}</p>
            <div class="meta">${detectionText}</div>
          </div>

          <div class="score-card">
            <div class="label">Readiness</div>
            <p class="score">${summary.score}%</p>
            <div class="score-sub">${summary.checks.filter((check) => check.status === 'pass').length} of ${summary.checks.length} checks passed</div>
          </div>

          <div class="panel">
            <div class="status-list">
              ${statusMarkup}
            </div>
          </div>

          <div class="button-row">
            <button class="primary" data-command="runFullCheck">Run Full Check</button>
            <button data-command="refresh">Refresh</button>
          </div>
          <div class="check-status" role="status" aria-live="polite">${lastCheckedMarkup}</div>

          <div class="panel">
            <h2>Detected stack</h2>
            <ul>
              <li>${frameworksText}</li>
            </ul>
          </div>

          <div class="panel">
            <h2>Problems</h2>
            <ul>
              ${safeProblems}
            </ul>
          </div>
        </div>
        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          const commandButtons = Array.from(document.querySelectorAll('[data-command]'));
          const checkStatus = document.querySelector('.check-status');

          function restoreButtons() {
            commandButtons.forEach((button) => {
              button.disabled = false;
              button.textContent = button.dataset.command === 'runFullCheck' ? 'Run Full Check' : 'Refresh';
            });
          }

          commandButtons.forEach((button) => {
            button.addEventListener('click', () => {
              const command = button.dataset.command;
              commandButtons.forEach((currentButton) => { currentButton.disabled = true; });
              button.textContent = command === 'runFullCheck' ? 'Running Check…' : 'Refreshing…';
              checkStatus.textContent = command === 'runFullCheck'
                ? 'Running full readiness check…'
                : 'Refreshing readiness data…';
              checkStatus.setAttribute('aria-busy', 'true');
              vscode.postMessage({ command });
            });
          });

          window.addEventListener('message', (event) => {
            if (event.data?.command === 'checkFailed') {
              checkStatus.textContent = 'PreVisX could not complete the check. Try again.';
              checkStatus.removeAttribute('aria-busy');
              restoreButtons();
            }
          });
        </script>
      </body>
      </html>`;
  }
