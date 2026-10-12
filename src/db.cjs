const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  client_type TEXT NOT NULL DEFAULT 'person' CHECK(client_type IN ('person','company')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  service TEXT NOT NULL CHECK(service IN ('demolition','finishing','raised_floor')),
  source TEXT NOT NULL CHECK(source IN ('avito','phone','telegram','recommendation','website','other')),
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','measurement','estimate','negotiation','won','lost')),
  budget_rub INTEGER NOT NULL DEFAULT 0 CHECK(budget_rub >= 0),
  address TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  next_action_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER UNIQUE REFERENCES leads(id) ON DELETE SET NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  service TEXT NOT NULL CHECK(service IN ('demolition','finishing','raised_floor')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','active','completed','cancelled')),
  contract_rub INTEGER NOT NULL DEFAULT 0 CHECK(contract_rub >= 0),
  address TEXT NOT NULL DEFAULT '',
  start_date TEXT,
  end_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount_rub INTEGER NOT NULL CHECK(amount_rub > 0),
  payment_date TEXT NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'incoming' CHECK(payment_type IN ('incoming','refund')),
  method TEXT NOT NULL DEFAULT 'other',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  amount_rub INTEGER NOT NULL CHECK(amount_rub > 0),
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  is_paid INTEGER NOT NULL DEFAULT 1 CHECK(is_paid IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'note',
  body TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_at TEXT,
  is_done INTEGER NOT NULL DEFAULT 0 CHECK(is_done IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS prospects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL DEFAULT 'demolition' CHECK(service IN ('demolition','finishing','raised_floor')),
  region TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_name TEXT NOT NULL DEFAULT '',
  discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewed','contacted','converted','rejected')),
  notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS competitor_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  price_rub INTEGER CHECK(price_rub IS NULL OR price_rub >= 0),
  region TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  content_hash TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  UNIQUE(source_url)
);
CREATE TABLE IF NOT EXISTS import_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  details TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_payments_project_date ON payments(project_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_expenses_project_date ON expenses(project_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_region ON prospects(region);
`;

function openDatabase(userDataPath) {
  fs.mkdirSync(userDataPath, { recursive: true });
  const dbPath = path.join(userDataPath, 'struktura-crm.sqlite');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  const prospectColumns = new Set(db.prepare('PRAGMA table_info(prospects)').all().map(column => column.name));
  if (!prospectColumns.has('service')) db.exec("ALTER TABLE prospects ADD COLUMN service TEXT NOT NULL DEFAULT 'demolition' CHECK(service IN ('demolition','finishing','raised_floor'))");
  db.exec('CREATE INDEX IF NOT EXISTS idx_prospects_service ON prospects(service)');
  db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES ('schema_version','2')").run();
  db.prepare("UPDATE settings SET value='2' WHERE key='schema_version'").run();
  return db;
}

module.exports = { openDatabase, SCHEMA };
