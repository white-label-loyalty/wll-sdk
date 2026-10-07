import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getPackageVersion } from '../src/generators/package-version';

describe('SDK package version', () => {
  const originalDirectory = process.cwd();
  let directory: string;

  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: directory, stdio: 'pipe' });

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'wll-sdk-version-'));
    git('init');
    git(
      '-c',
      'user.name=SDK Test',
      '-c',
      'user.email=sdk@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '--allow-empty',
      '-m',
      'fixture',
    );
    process.chdir(directory);
  });

  afterEach(() => {
    process.chdir(originalDirectory);
    rmSync(directory, { recursive: true, force: true });
  });

  it('selects the higher version when lightweight tags share one commit', async () => {
    git('tag', '0.1.0');
    git('tag', '0.1.1');
    expect(await getPackageVersion()).toBe('0.1.1');
  });

  it('uses the requested release instead of another tag', async () => {
    git('tag', '9.0.0');
    expect(await getPackageVersion('0.1.1')).toBe('0.1.1');
  });

  it('accepts a v-prefixed release tag', async () => {
    expect(await getPackageVersion('v0.1.1')).toBe('0.1.1');
  });

  it('accepts prerelease and build metadata', async () => {
    expect(await getPackageVersion('0.1.1-rc.1+build.2')).toBe(
      '0.1.1-rc.1+build.2',
    );
  });

  it('rejects a build without a version or tags', async () => {
    await expect(getPackageVersion()).rejects.toThrow(
      'package version or git tag',
    );
  });

  for (const version of ['', 'main', '01.1.1', '0.1.1-', '0.1.1-01']) {
    it(`rejects invalid version ${JSON.stringify(version)}`, async () => {
      await expect(getPackageVersion(version)).rejects.toThrow();
    });
  }
});
