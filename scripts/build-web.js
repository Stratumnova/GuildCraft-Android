import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function fingerprintFor({ version, commit, builtAt }) {
  return crypto.createHash('sha256')
    .update(`${version}\n${commit}\n${builtAt}`)
    .digest('hex')
    .slice(0, 12);
}

export async function generateWebBuild({ sourceDir, outputDir, version, commit, builtAt }) {
  if (![sourceDir, outputDir, version, commit, builtAt].every(Boolean)) {
    throw new TypeError('sourceDir, outputDir, version, commit, and builtAt are required');
  }
  const buildInfo = {
    version,
    commit,
    fingerprint: fingerprintFor({ version, commit, builtAt }),
    builtAt
  };
  const generatedDir = path.join(sourceDir, 'generated');
  fs.mkdirSync(generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(generatedDir, 'buildInfo.js'),
    `export const BUILD_INFO = Object.freeze(${JSON.stringify(buildInfo, null, 2)});\n`
  );
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'build-info.json'), `${JSON.stringify(buildInfo, null, 2)}\n`);
  return buildInfo;
}

async function main() {
  const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
  const builtAt = process.env.BUILD_TIMESTAMP ?? new Date().toISOString();
  const commit = process.env.GITHUB_SHA ?? process.env.BUILD_COMMIT ?? 'local-development';
  const build = await generateWebBuild({
    sourceDir: path.join(projectDir, 'src'),
    outputDir: path.join(projectDir, 'www'),
    version: packageJson.version,
    commit,
    builtAt
  });
  process.stdout.write(`Built Market Stall Lab ${build.fingerprint}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
