'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_REQUIRED_TABLES = ['projects', 'clients', 'tasks'];

function inspectDatabase(filePath, Database, requiredTables = DEFAULT_REQUIRED_TABLES) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Файл базы данных не найден.');
  }

  const db = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    const integrityRows = db.pragma('integrity_check');
    const integrityOk = Array.isArray(integrityRows)
      && integrityRows.length > 0
      && integrityRows.every((row) => Object.values(row).some((value) => value === 'ok'));
    if (!integrityOk) throw new Error('Проверка целостности SQLite не пройдена.');

    const tables = new Set(db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).all().map((row) => row.name));
    const missing = requiredTables.filter((name) => !tables.has(name));
    if (missing.length) {
      throw new Error(`В базе отсутствуют обязательные таблицы: ${missing.join(', ')}.`);
    }
    return { ok: true, tables: [...tables] };
  } finally {
    db.close();
  }
}

/**
 * Restore a SQLite file safely. The caller must close any live connection to
 * databasePath before invoking this function and reopen it after success.
 */
function restoreDatabase({
  sourcePath,
  databasePath,
  backupDirectory,
  Database,
  requiredTables = DEFAULT_REQUIRED_TABLES,
  now = () => new Date(),
}) {
  if (!Database) throw new TypeError('Не передан конструктор SQLite Database.');
  if (!sourcePath || !databasePath || !backupDirectory) {
    throw new TypeError('Нужно указать исходную базу, текущую базу и папку резервных копий.');
  }

  const source = path.resolve(sourcePath);
  const target = path.resolve(databasePath);
  const backupDir = path.resolve(backupDirectory);
  if (source === target) throw new Error('Исходный файл совпадает с текущей базой.');
  inspectDatabase(source, Database, requiredTables);

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = now().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `crm-before-restore-${stamp}.sqlite`);
  const stagedPath = path.join(path.dirname(target), `.crm-restore-${process.pid}-${stamp}.tmp`);
  const rollbackPath = path.join(path.dirname(target), `.crm-rollback-${process.pid}-${stamp}.tmp`);

  let movedCurrent = false;
  try {
    if (fs.existsSync(target)) {
      // Preserve the current file even if it is corrupt; restoring may be the recovery path.
      fs.copyFileSync(target, backupPath, fs.constants.COPYFILE_EXCL);
    }
    fs.copyFileSync(source, stagedPath, fs.constants.COPYFILE_EXCL);
    inspectDatabase(stagedPath, Database, requiredTables);

    if (fs.existsSync(target)) {
      fs.renameSync(target, rollbackPath);
      movedCurrent = true;
    }
    fs.renameSync(stagedPath, target);
    if (movedCurrent) fs.rmSync(rollbackPath, { force: true });
    return { ok: true, backupPath: fs.existsSync(backupPath) ? backupPath : null };
  } catch (error) {
    try {
      if (fs.existsSync(stagedPath)) fs.rmSync(stagedPath, { force: true });
      if (movedCurrent && fs.existsSync(rollbackPath)) {
        if (fs.existsSync(target)) fs.rmSync(target, { force: true });
        fs.renameSync(rollbackPath, target);
      }
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], 'Восстановление не удалось, и автоматический откат также завершился ошибкой.');
    }
    throw error;
  }
}

module.exports = { DEFAULT_REQUIRED_TABLES, inspectDatabase, restoreDatabase };
