'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inspectDatabase, restoreDatabase } = require('../src/backup-restore.cjs');

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'struktura-restore-'));
  const Database = class {
    constructor(filePath) {
      this.data = fs.readFileSync(filePath, 'utf8');
      if (this.data.startsWith('INVALID')) throw new Error('invalid database');
    }
    pragma() { return [{ integrity_check: this.data.includes('CORRUPT') ? 'corrupt' : 'ok' }]; }
    prepare() {
      return { all: () => (this.data.includes('MISSING_TABLES') ? [] : [
        { name: 'projects' }, { name: 'clients' }, { name: 'tasks' }
      ]) };
    }
    close() {}
  };
  return { root, Database };
}

test('inspectDatabase accepts an intact database with required tables', (t) => {
  const { root, Database } = setup();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'valid.sqlite');
  fs.writeFileSync(file, 'VALID');
  assert.equal(inspectDatabase(file, Database).ok, true);
});

test('inspectDatabase rejects missing tables and corrupt integrity', (t) => {
  const { root, Database } = setup();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const missing = path.join(root, 'missing.sqlite');
  fs.writeFileSync(missing, 'MISSING_TABLES');
  assert.throws(() => inspectDatabase(missing, Database), /обязательные таблицы/);
  const corrupt = path.join(root, 'corrupt.sqlite');
  fs.writeFileSync(corrupt, 'CORRUPT');
  assert.throws(() => inspectDatabase(corrupt, Database), /целостности/);
});

test('restoreDatabase backs up the old database and replaces it', (t) => {
  const { root, Database } = setup();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source.sqlite');
  const target = path.join(root, 'app', 'crm.sqlite');
  const backups = path.join(root, 'backups');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(source, 'NEW_DATABASE');
  fs.writeFileSync(target, 'OLD_DATABASE');
  const result = restoreDatabase({
    sourcePath: source, databasePath: target, backupDirectory: backups, Database,
    now: () => new Date('2026-10-14T10:00:00.000Z'),
  });
  assert.equal(result.ok, true);
  assert.equal(fs.readFileSync(target, 'utf8'), 'NEW_DATABASE');
  assert.equal(fs.readFileSync(result.backupPath, 'utf8'), 'OLD_DATABASE');
});

test('restoreDatabase rejects invalid source without changing current database', (t) => {
  const { root, Database } = setup();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source.sqlite');
  const target = path.join(root, 'crm.sqlite');
  fs.writeFileSync(source, 'CORRUPT');
  fs.writeFileSync(target, 'OLD_DATABASE');
  assert.throws(() => restoreDatabase({
    sourcePath: source, databasePath: target, backupDirectory: path.join(root, 'backups'), Database,
  }), /целостности/);
  assert.equal(fs.readFileSync(target, 'utf8'), 'OLD_DATABASE');
});

test('restoreDatabase can recover from a corrupt current database and preserves it as backup', (t) => {
  const { root, Database } = setup();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source.sqlite');
  const target = path.join(root, 'crm.sqlite');
  fs.writeFileSync(source, 'NEW_DATABASE');
  fs.writeFileSync(target, 'CORRUPT');
  const result = restoreDatabase({
    sourcePath: source, databasePath: target, backupDirectory: path.join(root, 'backups'), Database,
    now: () => new Date('2026-10-14T10:01:00.000Z'),
  });
  assert.equal(fs.readFileSync(target, 'utf8'), 'NEW_DATABASE');
  assert.equal(fs.readFileSync(result.backupPath, 'utf8'), 'CORRUPT');
});
