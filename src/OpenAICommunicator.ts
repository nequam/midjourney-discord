import {OpenAI} from "openai";
import {Threads} from "openai/resources/beta";
import MessageContentText = Threads.MessageContentText;
import {IDataStore} from "./IDataStore";

require('dotenv').config();

export class OpenAICommunicator {
    private openai;
    private assistant: any;
    private model: any;
    private dataStore: IDataStore;

    constructor(dataStore: IDataStore) {
        this.dataStore = dataStore;
        this.assistant = process.env.OPENAI_ASSISTANT_ID;
        this.model = process.env.OPENAI_MODEL;
        this.openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});
    }


    async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async resetAI(user: string) {
        let threadId = await this.dataStore.getThread(user);
        if (threadId != null) {
            await this.openai.beta.threads.del(threadId);
        }
        await this.dataStore.resetThread(user);
    }

    async sendMessage(user: string, messageInput: string): Promise<string> {
        let n: number;
        let threadId: string | null = null;
        // Retry 5 times to get a valid thread ID
        for (n = 0; n < 5; n++) {
            console.log("looking for thread")
            threadId = await this.dataStore.getThread(user);
            console.log("threadId", threadId);
            // Create a new thread ID if we didn't get one.
            if (threadId === null) {
                console.log("Creating new thread")
                const thread = await this.openai.beta.threads.create();
                threadId = thread.id;
                await this.dataStore.createThread(user, threadId);
            }
            let rThread = null;
            try {
                console.log("Checking thread:", threadId)
                let rThread = await this.openai.beta.threads.retrieve(threadId);
            } catch {
                console.error(`Thread ID ${threadId} is invalid: `);
                await this.dataStore.resetThread(user);
                threadId = null;
                continue;
            }
            // Check to see if thread ID is valid
            break;
            // Reset the cached threadid if it is invalid

        }

        if (threadId === null) {
            return messageInput;
        }


        const message = await this.openai.beta.threads.messages.create(
            threadId,
            {
                role: 'user',
                content: messageInput,
            }
        );

        const run = await this.openai.beta.threads.runs.create(
            threadId,
            {
                assistant_id: this.assistant,
            }
        );

        var runValue = await this.openai.beta.threads.runs.retrieve(
            threadId,
            run.id
        );

        while ( true ) {

            if (runValue.status == "completed" ||
                runValue.status == "failed" ||
                runValue.status == "cancelled" ||
                runValue.status == "expired") {
                break;
            }

            await this.sleep(2000);

            runValue = await this.openai.beta.threads.runs.retrieve(
                threadId,
                run.id
            );
        }

        // In case of error, just return the input message
        if (runValue.status != "completed") {
            return messageInput;
        }

        const messages = await this.openai.beta.threads.messages.list(
            threadId
        );

        try {
            return (messages.data[0].content[0] as MessageContentText).text.value;
        } catch {
            return messageInput;
        }


    }

    startCleanUpProcess() {
        this.cleanUpInactiveThreads("");
        setInterval(() => this.cleanUpInactiveThreads(""), 86400000); // 86400000 milliseconds in 24 hours
    }

    async cleanUpUnknownThreads() {


    }


    async cleanUpInactiveThreads(lastThreadId: string) {
        let threadIds = await this.dataStore.getAllThreads(lastThreadId);

        for (let threadId of threadIds) {
            try {
                await this.openai.beta.threads.retrieve(threadId);
            } catch (error) {
                // If thread is not valid, set it inactive
                console.error(`Thread ID ${threadId} is invalid: `, error);
                await this.dataStore.setThreadInactive(threadId);
            }
        }

        // Call the sleep function to wait for a minute before processing the next page
        await this.sleep(60000); // 60000 milliseconds in 1 minute
        if (threadIds.length > 0) {
            // Get the last threadId of the current page to use as the starting point for the next page
            const nextStartingThread = threadIds[threadIds.length - 1];
            this.cleanUpInactiveThreads(nextStartingThread);
        }
    }

    //... other existing methods


}