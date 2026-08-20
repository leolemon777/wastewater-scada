// 敏感信息扫描（SPEC-PLAN 11.4 / WP0）：
// 1) 已知真实凭据字面量不得出现在任何被跟踪文件；
// 2) JSON 配置与源码中的非空凭据赋值只允许空值或 <占位符>；
// 3) local 凭据文件必须被 git 忽略。
// 用法：npm run check:secrets
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

const trackedFiles = git('ls-files').split('\n').filter(Boolean);

// --- 规则 1：已知真实凭据字面量 ---
const knownCredentialPatterns = [
  { name: '无线 SSID', pattern: /wushuizhan/i },
  { name: '无线密码(引号形态)', pattern: /["'`]123456789["'`]/ },
  { name: '无线密码(键值形态)', pattern: /密码[：:]\s*`?123456789/ },
  { name: '网桥管理密码', pattern: /admin01/i },
  { name: 'M100 默认口令组合', pattern: /["']admin["']\s*,?\s*["']?Password["']?\s*[:=]\s*["']admin["']|Password["']?\s*[:=]\s*["']admin["']/i },
];

const textExtensions = /\.(md|json|ts|tsx|cs|mjs|js|ps1|xml|yml|yaml|toml|txt|html|css|env)$/i;
const violations = [];

for (const file of trackedFiles) {
  if (!textExtensions.test(file) || !fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  for (const { name, pattern } of knownCredentialPatterns) {
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        violations.push(`已知凭据[${name}] ${file}:${index + 1}: ${line.trim().slice(0, 80)}`);
      }
    });
  }

  // --- 规则 2：非空凭据赋值（JSON / C# / TS）---
  const assignmentPatterns = [
    /"(?:password|secret|apiKey|accessToken|token)"\s*:\s*"([^"]*)"/i,
    /(?:Password|Secret|ApiKey|AccessToken)\s*=\s*"([^"]*)"/,
  ];
  lines.forEach((line, index) => {
    for (const assignment of assignmentPatterns) {
      const match = line.match(assignment);
      if (match && match[1].trim() !== '' && !match[1].startsWith('<') && !match[1].startsWith('test-')) {
        violations.push(`非空凭据赋值 ${file}:${index + 1}: ${line.trim().slice(0, 80)}`);
      }
    }
  });
}

// --- 规则 3：本地凭据文件必须被忽略 ---
const localCredentialFile = 'docs/integration/本地凭据.local.md';
if (trackedFiles.includes(localCredentialFile)) {
  violations.push(`本地凭据文件被跟踪：${localCredentialFile}`);
}

assert.equal(
  violations.length,
  0,
  `敏感扫描发现 ${violations.length} 处违规：\n${violations.join('\n')}`,
);

console.log(`[check] secrets scan: clean over ${trackedFiles.length} tracked files`);
