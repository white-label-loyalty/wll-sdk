import { spawn } from 'bun';
import invariant from 'invariant';

export async function getPackageVersion(requestedVersion?: string) {
  let tag = requestedVersion;
  if (tag === undefined) {
    const process = spawn({
      cmd: ['git', 'tag', '--sort=-version:refname'],
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [code, stdout, stderr] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ]);
    if (code !== 0) {
      throw new Error(
        `Failed to read git tags: ${stderr.trim() || stdout.trim()}`,
      );
    }
    tag = stdout.split('\n').find(Boolean);
  }

  invariant(
    tag,
    'A package version or git tag is required to generate the SDK.',
  );
  const version = tag.replace(/^v/, '');
  invariant(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
      version,
    ),
    `Package version "${tag}" is not a valid semantic version.`,
  );
  return version;
}
