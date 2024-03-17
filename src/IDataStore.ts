// IDataStore.ts
export interface IDataStore {
  init(): Promise<void>;
  // Define other methods your bot will need, for example:
  createThread(userId: string, threadId: string): Promise<void>;
  resetThread(userId: string): Promise<void>;
  getThread(userId: string): Promise<string | null>;
  getAllThreads(lastThreadId: string): Promise<string[]>;

    getAllThreads(lastThreadId: string, pageSize: number): Promise<string[]>;
setThreadInactive(threadId: string): Promise<void>;
}