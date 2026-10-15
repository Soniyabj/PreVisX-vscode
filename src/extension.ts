import * as vscode from 'vscode';
import { PrevisViewProvider } from './webview/PrevisViewProvider';
import { detectProject } from './detectors/projectDetector';
import { runReadinessCheck, runProjectReadinessCheck } from './checks/readinessCheck';
import { applySafeFix, createSafeFixPlans } from './fixes/safeFixes';

export function activate(context: vscode.ExtensionContext) {
  console.log('PreVisX activated');

  const provider = new PrevisViewProvider();

  const sidebarDisposable = vscode.window.registerWebviewViewProvider(
    PrevisViewProvider.viewType,
    provider,
  );

  const openSidebarCommand = vscode.commands.registerCommand('PREVISX.openSidebar', () => {
    vscode.commands.executeCommand('workbench.view.extension.previsx');
  });

  const messageCommand = vscode.commands.registerCommand('PREVISX.showMessage', () => {
    vscode.window.showInformationMessage('PreVisX is ready. Project readiness checks are available.');
  });

  const safeFixCommand = vscode.commands.registerCommand('PREVISX.applySafeFixes', async () => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      vscode.window.showWarningMessage('PreVisX Safe Fixes require an open workspace.');
      return;
    }

    const project = detectProject(workspaceRoot);
    const summary = await runProjectReadinessCheck(project, workspaceRoot);
    const plans = createSafeFixPlans(project, summary, workspaceRoot);
    if (plans.length === 0) {
      vscode.window.showInformationMessage('PreVisX found no supported Safe Fixes for this workspace.');
      return;
    }

    for (const plan of plans) {
      const approval = await vscode.window.showWarningMessage(
        `${plan.title}: ${plan.description} Continue?`,
        { modal: true },
        'Approve',
        'Cancel',
      );
      const workspaceRoots = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];
      const result = await applySafeFix(plan, async () => approval === 'Approve', undefined, undefined, workspaceRoots);
      if (result.status === 'applied') {
        await provider.refresh();
        vscode.window.showInformationMessage(result.message);
      } else if (result.status === 'failed') {
        vscode.window.showErrorMessage(result.message);
      }
    }
  });

  context.subscriptions.push(sidebarDisposable, openSidebarCommand, messageCommand, safeFixCommand);
}

export function deactivate() {}
