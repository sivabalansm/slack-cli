// Hermetic tests for slack-cli --profile / SLACK_PROFILE support.
// Each test creates a fresh temp dir, copies the slack script into it,
// writes fixture .env files, and spawns `node ./slack ...` from that dir.
// Env is hermetic: only PATH + HOME + per-test additions. Never inherits
// the developer's real SLACK_USER_TOKEN.

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, copyFileSync, chmodSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const SOURCE_SCRIPT = resolve(__dirname, '..', 'slack');

function makeWorkspace(envFiles = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'slack-profile-test-'));
  const dest = join(dir, 'slack');
  copyFileSync(SOURCE_SCRIPT, dest);
  chmodSync(dest, 0o755);
  for (const [name, content] of Object.entries(envFiles)) {
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

function runSlack(dir, args = [], extraEnv = {}) {
  // Hermetic: NEVER spread process.env (would leak developer's SLACK_USER_TOKEN).
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, ...extraEnv };
  return spawnSync('node', ['./slack', ...args], { cwd: dir, env, encoding: 'utf8' });
}

function parseConfig(stdout) {
  const out = {};
  for (const line of stdout.split('\n')) {
    const m = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

test('t1: no profile loads .env (default backward compat)', () => {
  const dir = makeWorkspace({ '.env': 'SLACK_USER_TOKEN=xoxp-test-default-AAAA\n' });
  const r = runSlack(dir, ['config']);
  assert.equal(r.status, 0, `stderr=${r.stderr} stdout=${r.stdout}`);
  const cfg = parseConfig(r.stdout);
  assert.equal(cfg.profile, 'default');
  assert.equal(cfg.envFileLoaded, 'true');
  assert.match(cfg.envFile, /\.env$/);
  assert.equal(cfg.userToken, 'set');
  assert.match(cfg.userTokenPreview, /AAAA$/);
});

test('t2: --profile foo loads .env.foo', () => {
  const dir = makeWorkspace({
    '.env': 'SLACK_USER_TOKEN=xoxp-test-default-AAAA\n',
    '.env.foo': 'SLACK_USER_TOKEN=xoxp-test-foo-BBBB\n',
  });
  const r = runSlack(dir, ['--profile', 'foo', 'config']);
  assert.equal(r.status, 0, `stderr=${r.stderr} stdout=${r.stdout}`);
  const cfg = parseConfig(r.stdout);
  assert.equal(cfg.profile, 'foo');
  assert.equal(cfg.envFileLoaded, 'true');
  assert.match(cfg.envFile, /\.env\.foo$/);
  assert.match(cfg.userTokenPreview, /BBBB$/);
});

test('t3: SLACK_PROFILE env var loads .env.foo', () => {
  const dir = makeWorkspace({ '.env.foo': 'SLACK_USER_TOKEN=xoxp-test-foo-BBBB\n' });
  const r = runSlack(dir, ['config'], { SLACK_PROFILE: 'foo' });
  assert.equal(r.status, 0, `stderr=${r.stderr} stdout=${r.stdout}`);
  const cfg = parseConfig(r.stdout);
  assert.equal(cfg.profile, 'foo');
  assert.match(cfg.userTokenPreview, /BBBB$/);
});

test('t4: --profile flag wins over SLACK_PROFILE env', () => {
  const dir = makeWorkspace({
    '.env.foo': 'SLACK_USER_TOKEN=xoxp-test-foo-BBBB\n',
    '.env.bar': 'SLACK_USER_TOKEN=xoxp-test-bar-CCCC\n',
  });
  const r = runSlack(dir, ['--profile', 'foo', 'config'], { SLACK_PROFILE: 'bar' });
  assert.equal(r.status, 0, `stderr=${r.stderr} stdout=${r.stdout}`);
  const cfg = parseConfig(r.stdout);
  assert.equal(cfg.profile, 'foo');
  assert.match(cfg.userTokenPreview, /BBBB$/);
});

test('t5: missing profile file → exit 1 with clear stderr', () => {
  const dir = makeWorkspace({});
  const r = runSlack(dir, ['--profile', 'nope', 'channels']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /profile 'nope' not found/);
  assert.match(r.stderr, /\.env\.nope/);
});

test('t6: --help works even with broken profile (warn, do not error)', () => {
  const dir = makeWorkspace({});
  const r = runSlack(dir, ['--profile', 'nope', '--help']);
  assert.equal(r.status, 0, `stderr=${r.stderr} stdout=${r.stdout}`);
  assert.match(r.stdout, /Usage:/);
  assert.match(r.stderr, /Warning.*nope/);
});

test('t7: shell SLACK_USER_TOKEN env beats .env file token', () => {
  const dir = makeWorkspace({ '.env': 'SLACK_USER_TOKEN=xoxp-test-default-AAAA\n' });
  const r = runSlack(dir, ['config'], { SLACK_USER_TOKEN: 'xoxp-shell-overrides-DDDD' });
  assert.equal(r.status, 0, `stderr=${r.stderr} stdout=${r.stdout}`);
  const cfg = parseConfig(r.stdout);
  assert.match(cfg.userTokenPreview, /DDDD$/);
});

test('t8: --profile=foo equals form works', () => {
  const dir = makeWorkspace({ '.env.foo': 'SLACK_USER_TOKEN=xoxp-test-foo-BBBB\n' });
  const r = runSlack(dir, ['--profile=foo', 'config']);
  assert.equal(r.status, 0, `stderr=${r.stderr} stdout=${r.stdout}`);
  const cfg = parseConfig(r.stdout);
  assert.equal(cfg.profile, 'foo');
  assert.match(cfg.userTokenPreview, /BBBB$/);
});

test('t9: path traversal via --profile rejected (validation > file lookup)', () => {
  const dir = makeWorkspace({});
  const r = runSlack(dir, ['--profile', '../etc/passwd', 'channels']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /[Ii]nvalid profile name/);
  // Must NOT be a "not found at" error — validation must reject before file resolution.
  assert.doesNotMatch(r.stderr, /not found at/);
});

test('t10: SLACK_PROFILE env var also validated against path traversal', () => {
  const dir = makeWorkspace({});
  const r = runSlack(dir, ['config'], { SLACK_PROFILE: '../etc' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /[Ii]nvalid profile name/);
});

test('t11: validation supersedes help (invalid name + --help still errors)', () => {
  const dir = makeWorkspace({});
  const r = runSlack(dir, ['--profile', '../etc/passwd', '--help']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /[Ii]nvalid profile name/);
});

test('t12: --profile after subcommand is NOT parsed (literal arg, prevents query injection)', () => {
  // Per F1: --profile parsing stops at the subcommand to protect search/send queries
  // like `slack search "--profile=hack"` from leaking into auth resolution.
  const dir = makeWorkspace({
    '.env': 'SLACK_USER_TOKEN=xoxp-test-default-AAAA\n',
    '.env.fake': 'SLACK_USER_TOKEN=xoxp-test-fake-EEEE\n',
  });
  const r = runSlack(dir, ['config', '--profile=fake']);
  assert.equal(r.status, 0, `stderr=${r.stderr} stdout=${r.stdout}`);
  const cfg = parseConfig(r.stdout);
  // Default profile must load (literal --profile=fake post-subcommand is ignored as flag)
  assert.equal(cfg.profile, 'default');
  assert.match(cfg.userTokenPreview, /AAAA$/);
});
