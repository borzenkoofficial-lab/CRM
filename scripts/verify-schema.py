import sqlite3
from pathlib import Path
import re
import tempfile

source = Path(__file__).resolve().parents[1] / 'src' / 'db.cjs'
text = source.read_text(encoding='utf-8')
match = re.search(r'const SCHEMA = `([\s\S]*?)`;', text)
if not match:
    raise SystemExit('FAIL: schema literal not found')
schema = match.group(1)
expected = {'clients','leads','projects','payments','expenses','activities','tasks','prospects','competitor_listings','import_jobs','settings'}
with tempfile.TemporaryDirectory() as tmp:
    db_path = Path(tmp) / 'crm.sqlite'
    conn = sqlite3.connect(db_path)
    conn.executescript(schema)
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    missing = expected - tables
    if missing:
        raise SystemExit(f'FAIL: missing tables: {sorted(missing)}')
    client = conn.execute("INSERT INTO clients(name) VALUES ('Тестовый клиент')").lastrowid
    lead = conn.execute("INSERT INTO leads(client_id,title,service,source) VALUES (?,?,?,?)", (client,'Тестовая заявка','demolition','avito')).lastrowid
    project = conn.execute("INSERT INTO projects(lead_id,client_id,title,service,contract_rub) VALUES (?,?,?,?,?)", (lead,client,'Тестовый объект','demolition',10000)).lastrowid
    conn.execute("INSERT INTO payments(project_id,amount_rub,payment_date) VALUES (?,?,?)", (project,1000,'2026-10-12'))
    conn.commit()
    try:
        conn.execute("INSERT INTO leads(title,service,source) VALUES ('bad','unknown','avito')")
        raise SystemExit('FAIL: service CHECK constraint did not reject invalid value')
    except sqlite3.IntegrityError:
        pass
    conn.close()
    reopened = sqlite3.connect(db_path)
    persisted = reopened.execute('SELECT name FROM clients WHERE id=?', (client,)).fetchone()
    persisted_payment = reopened.execute('SELECT amount_rub FROM payments WHERE project_id=?', (project,)).fetchone()
    if persisted != ('Тестовый клиент',) or persisted_payment != (1000,):
        raise SystemExit('FAIL: persisted data missing after database reopen')
    reopened.close()
print(f'PASS: {len(expected)} tables created; foreign key/CHECK smoke tests and on-disk persistence across reopen passed.')
