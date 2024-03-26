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
            await this.db.exec(`CREATE TABLE IF NOT EXISTS main.threads
                                (
                                    userId       TEXT PRIMARY KEY,
                                    threadId     TEXT,
                                    creationDate TEXT,
                                    active       BOOLEAN
                                )`);
// Create an index on the threadId column for faster lookups
            await this.db.exec(`CREATE INDEX IF NOT EXISTS main.idx_threadId ON threads (threadId);`);
            await this.db.exec(`CREATE TABLE IF NOT EXISTS main.datastore
                                (
                                    token TEXT collate NOCASE not null,
                                    user  TEXT                not null,
                                    value TEXT,
                                    CONSTRAINT datastore_pk PRIMARY KEY (token, user)
                                ) `);
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

    async  getTokensForUserOrGlobal(userId: string): Promise<string[]> {
        try {
            const statement = `SELECT token FROM datastore WHERE user = ? OR user = 'global'`;
            const tokens = await this.db.all(statement, userId); // Assuming 'this.db' is your SQLite database instance
            return tokens.map(row => row.token);
        } catch (error) {
            console.error('An error occurred while retrieving tokens:', error);
            return [];
        }
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
    async storeData(token: string, user: string, value: string): Promise<void> {
        const statement = `INSERT INTO datastore (token, user, value)
                       VALUES (?, ?, ?)
                       ON CONFLICT(token, user) DO UPDATE SET
                       value=excluded.value;`;
        await this.db.run(statement, token, user, value);
    }
    async getData(token: string, user: string): Promise<string | null> {
        const statement = `SELECT value FROM datastore WHERE token = ? AND user = ?`;
        const row = await this.db.get(statement, token, user);
        return row ? row.value : null;
    }

    async deleteData(token: string, user: string): Promise<void> {
        const statement = `DELETE FROM datastore WHERE token = ? AND user = ?`;
        await this.db.run(statement, token, user);
    }

}