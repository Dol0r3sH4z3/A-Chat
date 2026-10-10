import { db } from "./db/connection.js";
import type { KeysBundle } from "@a-chat/shared";
import { uint8ArrayToBase64 } from "./utils/utils.js";

interface OPKEntry {
  id: number;
  pub: Uint8Array;
}

export interface DataBaseEntry {
  IK_dh_public: Uint8Array;
  IK_sign_public: Uint8Array;
  SPK_dh_public: Uint8Array;
  SPK_signature: Uint8Array;
  OPKs_public: OPKEntry[];
}

interface UserRow {
  nickname: string;
  ik_dh_public: Buffer;
  ik_sign_public: Buffer;
  spk_dh_public: Buffer;
  spk_signature: Buffer;
}

interface OpkRow {
  id: number;
  opk_id: number;
  pub: Buffer;
}

export class KeysDB {
  private stmts = {
    getUser: db.prepare<[string], UserRow>(
      `SELECT * FROM users WHERE nickname = ?`,
    ),
    insertUser: db.prepare(`
      INSERT INTO users (nickname, ik_dh_public, ik_sign_public, spk_dh_public, spk_signature)
      VALUES (@nickname, @ik_dh_public, @ik_sign_public, @spk_dh_public, @spk_signature)
    `),
    findByIdentity: db.prepare<[Buffer], { nickname: string }>(
      `SELECT nickname FROM users WHERE ik_sign_public = ?`,
    ),
    deleteUser: db.prepare<[string]>(`DELETE FROM users WHERE nickname = ?`),
    getOldestOpk: db.prepare<[string], OpkRow>(
      `SELECT * FROM opks WHERE nickname = ? ORDER BY id ASC LIMIT 1`,
    ),
    deleteOpk: db.prepare<[number]>(`DELETE FROM opks WHERE id = ?`),
    insertOpk: db.prepare(
      `INSERT INTO opks (nickname, opk_id, pub) VALUES (@nickname, @opk_id, @pub)`,
    ),
    updateSpk: db.prepare(
      `UPDATE users SET spk_dh_public = @spk_dh_public, spk_signature = @spk_signature WHERE nickname = @nickname`,
    ),
  };

  getUserData(nickname: string): DataBaseEntry | undefined {
    const row = this.stmts.getUser.get(nickname);
    if (!row) return undefined;

    const opkRows = db
      .prepare<[string], OpkRow>(`SELECT * FROM opks WHERE nickname = ?`)
      .all(nickname);

    return {
      IK_dh_public: new Uint8Array(row.ik_dh_public),
      IK_sign_public: new Uint8Array(row.ik_sign_public),
      SPK_dh_public: new Uint8Array(row.spk_dh_public),
      SPK_signature: new Uint8Array(row.spk_signature),
      OPKs_public: opkRows.map((o) => ({
        id: o.opk_id,
        pub: new Uint8Array(o.pub),
      })),
    };
  }

  isIdentityTaken(ik_pub: Uint8Array): boolean {
    const identityBuf = Buffer.from(ik_pub);
    const existingIdentity = this.stmts.findByIdentity.get(identityBuf);

    return !!existingIdentity;
  }

  removeUser(nickname: string): boolean {
    const result = this.stmts.deleteUser.run(nickname);
    return result.changes > 0;
  }

  addUser(
    nickname: string,
    data: DataBaseEntry,
  ): "exists" | "identity_taken" | "ok" {
    const existingUser = this.stmts.getUser.get(nickname);
    if (existingUser) return "exists";

    const identityBuf = Buffer.from(data.IK_sign_public);
    const existingIdentity = this.stmts.findByIdentity.get(identityBuf);

    if (existingIdentity && existingIdentity.nickname !== nickname) {
      return "identity_taken";
    }

    const insertAll = db.transaction(() => {
      this.stmts.insertUser.run({
        nickname,
        ik_dh_public: Buffer.from(data.IK_dh_public),
        ik_sign_public: identityBuf,
        spk_dh_public: Buffer.from(data.SPK_dh_public),
        spk_signature: Buffer.from(data.SPK_signature),
      });

      for (const opk of data.OPKs_public) {
        this.stmts.insertOpk.run({
          nickname,
          opk_id: opk.id,
          pub: Buffer.from(opk.pub),
        });
      }
    });

    insertAll();
    return "ok";
  }

  getUserKeys(nickname: string): KeysBundle | undefined {
    const row = this.stmts.getUser.get(nickname);
    if (!row) return undefined;

    const takeOpk = db.transaction(() => {
      const opk = this.stmts.getOldestOpk.get(nickname);
      if (opk) this.stmts.deleteOpk.run(opk.id);
      return opk;
    });

    const currentOPK = takeOpk();

    const baseBundle: KeysBundle = {
      IK_dh_public: uint8ArrayToBase64(new Uint8Array(row.ik_dh_public)),
      IK_sign_public: uint8ArrayToBase64(new Uint8Array(row.ik_sign_public)),
      SPK_dh_public: uint8ArrayToBase64(new Uint8Array(row.spk_dh_public)),
      SPK_signature: uint8ArrayToBase64(new Uint8Array(row.spk_signature)),
    };

    return {
      ...baseBundle,
      ...(currentOPK && {
        OPK_public: {
          id: currentOPK.opk_id,
          pub: uint8ArrayToBase64(new Uint8Array(currentOPK.pub)),
        },
      }),
    };
  }

  addOPKs(nickname: string, OPKs: OPKEntry[]): void {
    const insertMany = db.transaction((opks: OPKEntry[]) => {
      for (const opk of opks) {
        this.stmts.insertOpk.run({
          nickname,
          opk_id: opk.id,
          pub: Buffer.from(opk.pub),
        });
      }
    });

    insertMany(OPKs);
  }

  rotateSPK(
    nickname: string,
    SPK_dh_public: string,
    SPK_signature: string,
  ): void {
    this.stmts.updateSpk.run({
      nickname,
      spk_dh_public: Buffer.from(SPK_dh_public, "base64"),
      spk_signature: Buffer.from(SPK_signature, "base64"),
    });
  }
}

export const keysDB = new KeysDB();
