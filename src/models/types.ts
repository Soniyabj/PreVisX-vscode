export type CheckStatus = 'pass' | 'fail' | 'warning' | 'unknown';

export interface DetectedProject {
  rootPath: string;
  projectTypes: string[];
  detectedFrameworks: string[];
  packageManager?: string;
  languageSummary: string[];
  confidence: number;
  reasons: string[];
}

export interface CheckResult {
  id: string;
  category: 'runtime' | 'dependencies' | 'environment' | 'configuration' | 'port' | 'build';
  name: string;
  status: CheckStatus;
  message: string;
  details?: string;
}

export interface ReadinessSummary {
  score: number;
  checks: CheckResult[];
  project: DetectedProject;
}

export interface RuntimeToolResult {
  tool: string;
  available: boolean;
  version?: string;
  command: string;
  args: string[];
  message: string;
  severity: 'info' | 'warning' | 'error';
  relevant: boolean;
}

export type DiagnosisSeverity = 'error' | 'warning' | 'info';

export interface Diagnosis {
  id: string;
  checkId: string;
  category: CheckResult['category'];
  severity: DiagnosisSeverity;
  title: string;
  summary: string;
  evidence?: string;
  recommendation: string;
  blocking: boolean;
}

export interface DiagnosisReport {
  project: DetectedProject;
  score: number;
  diagnoses: Diagnosis[];
  hasBlockingIssues: boolean;
}

export type SafeFixKind = 'install-node-dependencies' | 'create-python-venv' | 'copy-environment-template';

export interface SafeFixPlan {
  id: string;
  kind: SafeFixKind;
  title: string;
  description: string;
  rootPath: string;
  operation: 'command' | 'copy';
  command?: string;
  args?: string[];
  sourcePath?: string;
  targetPath?: string;
}

export type SafeFixStatus = 'applied' | 'cancelled' | 'failed';

export interface SafeFixResult {
  plan: SafeFixPlan;
  status: SafeFixStatus;
  message: string;
}
