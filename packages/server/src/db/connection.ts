import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.join(process.cwd(), "data.sqlite");
export const db: import("better-sqlite3").Database = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    nickname TEXT PRIMARY KEY,
    ik_dh_public BLOB NOT NULL,
    ik_sign_public BLOB NOT NULL,
    spk_dh_public BLOB NOT NULL,
    spk_signature BLOB NOT NULL
  );

  CREATE TABLE IF NOT EXISTS opks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL,
    opk_id INTEGER NOT NULL,
    pub BLOB NOT NULL,
    FOREIGN KEY (nickname) REFERENCES users(nickname) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_identity ON users(ik_sign_public);
  CREATE INDEX IF NOT EXISTS idx_opks_nickname ON opks(nickname);
`);
