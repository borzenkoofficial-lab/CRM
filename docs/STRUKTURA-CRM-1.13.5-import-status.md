# STRUKTURA CRM 1.13.5 — import and verification status

## Source archive

The uploaded `struktura-crm-v1.13.4-source(1).zip` contains version 1.13.4 source. Local `npm test` completed with **100/100 tests passing**. This does not prove a Windows EXE build or a real Electron GUI run on Windows.

## Repository baseline

Before this branch, GitHub repository `borzenkoofficial-lab/CRM` contained version 0.2.1 and a reduced file tree compared with the uploaded 1.13.4 archive. This branch is therefore **not** a complete import of v1.13.4/v1.13.5 and does not change the app release version.

## Change in this branch

Adds `src/backup-restore.cjs`, a guarded SQLite file restore utility with:
- SQLite `integrity_check`;
- required-table validation;
- a pre-restore backup of the current database;
- a staged replacement and rollback attempt on failure.

The utility still needs integration with Electron main/preload/renderer and verification with the real `better-sqlite3` driver before use in the production CRM. Unit tests use a test adapter and are not a substitute for SQLite/Windows integration tests.

## Not claimed as completed

- Full import of every file from the 1.13.4 archive.
- GUI integration of the restore command.
- Windows GUI or EXE installer build.
- Verification of Windows notifications or multi-page PDF printing.
