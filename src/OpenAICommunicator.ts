import {OpenAI} from "openai";
import {Threads} from "openai/resources/beta";
import MessageContentText = Threads.MessageContentText;
import {IDataStore} from "./IDataStore";
import fs from 'fs/promises';
import {RequiredActionFunctionToolCall} from "openai/resources/beta/threads";
import {DiscordTalker} from "./DiscordTalker";
import {FunctionDispatcher} from "./FunctionDispatcher";

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

    async init() {
        const assistantData = JSON.parse(await fs.readFile('assistantData.json', 'utf8'));
        const { Name, Functions, Instructions } = assistantData;

        // Step 2: Get the instructions from the referred file
        const instructionsContent = await fs.readFile(Instructions, 'utf8');

        const formattedFunctions = Functions.map((fn: any) => ({
            "type": "function",
            "function": fn // Assuming fn is already a correctly formatted object
        }));

        // at some point, this need to be updated to page through all assistants.

        let myAssistant;
        try {
            const myAssistants = await this.openai.beta.assistants.list({
                order: "desc",
                limit: 30
            });

            // Find assistant by name
            myAssistant = myAssistants.data.find(assistant => assistant.name === Name);

            // Step 4: If the assistant is found, check if updates are needed
            if (myAssistant) {

                // Check if instructions match
                const instructionsMatch = (myAssistant.instructions?.trim() ?? "") === instructionsContent.trim();
                // Check if tools match (you will need to define your own logic for matching functions and tools correctly)
                const toolsMatch = JSON.stringify(myAssistant.tools.sort()) === JSON.stringify(formattedFunctions.sort());
                if (!instructionsMatch || !toolsMatch) {
                    // Update the assistant
                    myAssistant = await this.openai.beta.assistants.update(myAssistant.id, {
                        instructions: instructionsContent,
                        tools: formattedFunctions
                    });
                }
            } else {
                // Step 5: If no assistant is found, create it
                myAssistant = await this.openai.beta.assistants.create({
                    instructions: instructionsContent,
                    name: Name,
                    tools: formattedFunctions,
                    model: this.model,
                });
            }
        } catch (error) {
            console.error('An error occurred:', error);
            process.exit(1); // Exit with a non-zero error code to indicate failure
        }

        this.assistant=myAssistant.id;

        console.log('Assistant Processed:', myAssistant);
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

    async sendMessage(user: string, messageInput: string, talker: DiscordTalker): Promise<string> {
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

            try {
                console.log("Checking thread:", threadId)
                const tThread=await this.openai.beta.threads.retrieve(threadId);

                let runs = await this.openai.beta.threads.runs.list(tThread.id)

                while (true) {
                    for (let run of runs.data) {
                        if (run.status !== 'failed' && run.status !== 'completed' && run.status !== 'expired') {
                            console.log("Thread is running.  Wiping it.")
                            await this.dataStore.resetThread(user);
                            threadId = null;
                            break;
                        }
                    }

                    if (threadId==null || !runs.hasNextPage()) break;
                    runs = await runs.getNextPage();
                }
                if (threadId==null) continue;


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

        let dispatcher = new FunctionDispatcher(talker, this.dataStore, this);

        await this.openai.beta.threads.messages.create(
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

        let runValue = await this.openai.beta.threads.runs.retrieve(
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

            if (runValue.status=="requires_action")
            {

                const required_action = runValue.required_action
                const required_tools: Array<RequiredActionFunctionToolCall> | undefined = required_action?.submit_tool_outputs.tool_calls

                if (required_tools) {

                    let tool_output_items = []
                    for(let rtool of required_tools) {

                        const function_name = rtool.function.name
                        const tool_args = JSON.parse(rtool.function.arguments)

                        console.log("-", function_name, tool_args)

                        let tool_output = await dispatcher.Dispatch(function_name, tool_args)

                        tool_output_items.push({
                            tool_call_id: rtool.id,
                            output: JSON.stringify(tool_output)
                        })

                    }
                    await this.openai.beta.threads.runs.submitToolOutputs(threadId, run.id, { tool_outputs: tool_output_items });
                }
            }

            await this.sleep(1000);

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
        this.cleanUpInactiveThreads("").then(r => console.log("Clean up process started"));
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
            await this.cleanUpInactiveThreads(nextStartingThread);
        }
    }

    //... other existing methods


}