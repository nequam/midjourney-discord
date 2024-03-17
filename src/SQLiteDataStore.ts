// SQLiteDataStore.ts
import { IDataStore } from './IDataStore';
import { Database, open} from 'sqlite';
import sqlite3 from 'sqlite3';

export class SQLiteDataStore implements IDataStore {
    private db!: Database<sqlite3.Database, sqlite3.Statement>;

    async init(): Promise<void> {
        this.db = await open({
            filename: process.env.DATABASE_FILENAME || 'database.db',
            driver: sqlite3.Database,
        });
            await this.db.exec(`CREATE TABLE IF NOT EXISTS threads (
      userId TEXT PRIMARY KEY,
      threadId TEXT,
      creationDate TEXT,
      active BOOLEAN
    )`);
// Create an index on the threadId column for faster lookups
            await this.db.exec('CREATE INDEX IF NOT EXISTS idx_threadId ON threads (threadId);');

        }

    async createThread(userId: string, threadId: string): Promise<void> {
        const statement = `INSERT INTO threads (userId, threadId, creationDate, active)
                       VALUES (?, ?, datetime('now'), ?)
                       ON CONFLICT(userId) DO UPDATE SET
                       threadId=excluded.threadId,
                       creationDate=excluded.creationDate,
                       active=excluded.active;`;
        await this.db.run(statement, userId, threadId, true); // Assuming new thread creation sets active to true
    }

    async resetThread(userId: string): Promise<void> {
        // Assuming reset means to deactivate rather than delete
        const statement = `UPDATE threads SET active = ? WHERE userId = ?`;
        await this.db.run(statement, false, userId);
    }

    async getThread(userId: string): Promise<string | null> {
        const statement = `SELECT threadId FROM threads WHERE userId = ? AND active = ?`;
        const row = await this.db.get(statement, userId, true);
        return row ? row.threadId : null;
    }

    async getAllThreads(lastThreadId: string = "", pageSize: number = 10): Promise<string[]> {
        let statement = `SELECT threadId FROM threads WHERE active = ? `;
        const params :any[] = [true];

        if (lastThreadId) {
            statement += `AND threadId > ? ORDER BY threadId ASC LIMIT ?`;
            params.push(lastThreadId, pageSize);
        } else {
            statement += `ORDER BY threadId ASC LIMIT ?`;
            params.push(pageSize);
        }

        const rows = await this.db.all(statement, ...params);
        return rows.map((row) => row.threadId);
    }

    async setThreadInactive(threadId: string): Promise<void> {
        const statement = `UPDATE threads SET active = ? WHERE threadId = ?`;
        await this.db.run(statement, false, threadId);
    }


}