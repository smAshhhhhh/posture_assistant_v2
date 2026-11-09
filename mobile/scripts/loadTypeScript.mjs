import { readFile } from 'node:fs/promises';
import path from 'node:path';

import ts from 'typescript';

// 复用工程已有的 TypeScript 编译器，不为纯业务测试增加依赖。
export async function loadTypeScript(relativePath) {
  const filePath = path.resolve(relativePath);
  const source = await readFile(filePath, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    fileName: filePath,
  });
  const module = { exports: {} };
  const imports = new Map();

  for (const match of result.outputText.matchAll(/require\("(\.[^"]+)"\)/g)) {
    const specifier = match[1];
    imports.set(
      specifier,
      await loadTypeScript(path.resolve(path.dirname(filePath), `${specifier}.ts`)),
    );
  }

  const requireLocal = (specifier) => {
    if (!imports.has(specifier)) throw new Error(`业务测试不允许外部运行时依赖：${specifier}`);
    return imports.get(specifier);
  };
  const evaluate = new Function('require', 'module', 'exports', result.outputText);
  evaluate(requireLocal, module, module.exports);

  return module.exports;
}
