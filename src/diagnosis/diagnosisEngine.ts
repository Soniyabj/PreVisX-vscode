import { CheckResult, Diagnosis, DiagnosisReport, ReadinessSummary } from '../models/types';

export function diagnoseReadiness(summary: ReadinessSummary): DiagnosisReport {
  const diagnoses = summary.checks
    .filter((check) => check.status !== 'pass')
    .map((check) => createDiagnosis(check));

  return {
    project: summary.project,
    score: summary.score,
    diagnoses,
    hasBlockingIssues: diagnoses.some((diagnosis) => diagnosis.blocking),
  };
}

function createDiagnosis(check: CheckResult): Diagnosis {
  const severity = check.status === 'fail' ? 'error' : check.status === 'warning' ? 'warning' : 'info';
  const blocking = check.status === 'fail';

  return {
    id: `diagnosis-${check.id}`,
    checkId: check.id,
    category: check.category,
    severity,
    title: diagnosisTitle(check),
    summary: check.message,
    evidence: check.details,
    recommendation: diagnosisRecommendation(check),
    blocking,
  };
}

function diagnosisTitle(check: CheckResult): string {
  if (check.status === 'fail') {
    return `${check.name} failed`;
  }

  if (check.status === 'warning') {
    return `${check.name} needs review`;
  }

  return `${check.name} could not be verified`;
}

function diagnosisRecommendation(check: CheckResult): string {
  switch (check.category) {
    case 'runtime':
      return 'Verify that the required runtime is installed and available on PATH.';
    case 'dependencies':
      return 'Verify the project dependency manifest and install dependencies using the project package manager.';
    case 'environment':
      return 'Review the environment template and provide the active values required by the project.';
    case 'configuration':
      return 'Review the detected project type and add the expected project configuration.';
    case 'build':
      return 'Review the project build configuration before attempting to build or run it.';
    case 'port':
      return 'Review the project port configuration and ensure the intended development port is documented.';
    default:
      return 'Review this readiness check before running the project.';
  }
}