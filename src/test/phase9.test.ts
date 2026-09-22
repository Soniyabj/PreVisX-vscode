import * as assert from 'assert';

import { diagnoseReadiness } from '../diagnosis/diagnosisEngine';
import { CheckResult, DetectedProject, ReadinessSummary } from '../models/types';

const project: DetectedProject = {
  rootPath: '/tmp/demo',
  projectTypes: ['nodejs'],
  detectedFrameworks: [],
  languageSummary: ['nodejs'],
  confidence: 70,
  reasons: ['Found package.json'],
};

function summaryFor(...checks: CheckResult[]): ReadinessSummary {
  return { project, score: 50, checks };
}

suite('Phase 9 diagnosis engine', () => {
  test('turns failures into blocking error diagnoses', () => {
    const report = diagnoseReadiness(summaryFor({
      id: 'dependencies-node',
      category: 'dependencies',
      name: 'Node dependencies',
      status: 'fail',
      message: 'node_modules was not found.',
      details: 'package.json was detected.',
    }));

    assert.strictEqual(report.diagnoses.length, 1);
    assert.strictEqual(report.diagnoses[0].severity, 'error');
    assert.strictEqual(report.diagnoses[0].blocking, true);
    assert.strictEqual(report.diagnoses[0].evidence, 'package.json was detected.');
    assert.ok(report.diagnoses[0].recommendation.includes('install dependencies'));
    assert.strictEqual(report.hasBlockingIssues, true);
  });

  test('keeps warnings non-blocking and ignores passing checks', () => {
    const report = diagnoseReadiness(summaryFor(
      {
        id: 'environment',
        category: 'environment',
        name: 'Environment configuration',
        status: 'warning',
        message: 'No active environment file was detected.',
      },
      {
        id: 'runtime',
        category: 'runtime',
        name: 'Runtime check',
        status: 'pass',
        message: 'Required runtimes are present.',
      },
    ));

    assert.strictEqual(report.diagnoses.length, 1);
    assert.strictEqual(report.diagnoses[0].severity, 'warning');
    assert.strictEqual(report.diagnoses[0].blocking, false);
    assert.strictEqual(report.hasBlockingIssues, false);
  });

  test('represents unknown checks as informational diagnoses', () => {
    const report = diagnoseReadiness(summaryFor({
      id: 'port-default',
      category: 'port',
      name: 'Development port',
      status: 'unknown',
      message: 'No supported web project type was detected.',
    }));

    assert.strictEqual(report.diagnoses[0].severity, 'info');
    assert.strictEqual(report.diagnoses[0].blocking, false);
    assert.strictEqual(report.diagnoses[0].id, 'diagnosis-port-default');
  });
});