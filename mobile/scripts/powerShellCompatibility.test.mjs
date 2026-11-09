import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';

test(
  '模型脚本可被 Windows PowerShell 5.1 解析，不执行下载',
  {
    skip: process.platform !== 'win32',
  },
  () => {
    const command = [
      '$tokens = $null',
      '$parseErrors = $null',
      '[void][System.Management.Automation.Language.Parser]::ParseFile(',
      '$env:POSTURE_SCRIPT_TO_PARSE, [ref]$tokens, [ref]$parseErrors)',
      'if ($parseErrors.Count -gt 0) { throw ($parseErrors | Out-String) }',
    ].join('\n');
    const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', command], {
      encoding: 'utf8',
      env: {
        ...process.env,
        POSTURE_SCRIPT_TO_PARSE: path.resolve('scripts/downloadPoseModel.ps1'),
      },
    });
    assert.equal(output.trim(), '');
  },
);
