// DataStoreFactory.ts
import { IDataStore } from './IDataStore';
import { SQLiteDataStore } from './SQLiteDataStore';

export function createDataStore(): IDataStore {
    // You could extend this switch statement for other databases in the future
    switch (process.env.DATABASE_TYPE) {
        case 'SQLITE':
            return new SQLiteDataStore();
        // Default to SQLLITE if no database type is specified, as it's built-in
        default:
            return new SQLiteDataStore();
    }
}