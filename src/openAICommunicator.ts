import {OpenAI} from "openai";
import {Threads} from "openai/resources/beta";
import MessageContentText = Threads.MessageContentText;
require('dotenv').config();

export class OpenAICommunicator {
    private openai;
    private assistant: any;
    private model: any;
    constructor() {
        this.assistant = process.env.OPENAI_ASSISTANT_ID;
        this.model = process.env.OPENAI_MODEL;
        this.openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});
    }


    async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async sendMessage(messageInput: string) {
        const thread = await this.openai.beta.threads.create();

        const message = await this.openai.beta.threads.messages.create(
            thread.id,
            {
                role: 'user',
                content: messageInput,
            }
        );

        const run = await this.openai.beta.threads.runs.create(
            thread.id,
            {
                assistant_id: this.assistant,
            }
        );

        var runValue = await this.openai.beta.threads.runs.retrieve(
            thread.id,
            run.id
        );

        while (true)
        {

            if (runValue.status == "completed" ||
                runValue.status == "failed"  ||
                runValue.status == "cancelled" ||
                runValue.status == "expired") {
                break;
            }

            await this.sleep(2000);

            runValue = await this.openai.beta.threads.runs.retrieve(
                thread.id,
                run.id
            );
        }

        // In case of error, just return the input message
        if (runValue.status != "completed") {
            return messageInput;
        }

        const messages = await this.openai.beta.threads.messages.list(
            thread.id
        );

        try {
            return (messages.data[0].content[0] as MessageContentText).text.value;
        } catch {
            return messageInput;
        }


    }
}