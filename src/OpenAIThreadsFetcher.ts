import {OpenAI} from "openai";
const axios = require('axios');

export class OpenAIThreadsFetcher {
    token: string;
    org: string;
    url: string;
    headers: object;
    private openai
    constructor(token: string, org: string) {
        this.token = token;
        this.org = org;
        this.openai = new OpenAI({apiKey: token, organization:org});
        this.url = 'https://api.openai.com/v1/threads';

        var BearerToken = this.token;


        this.headers = {
            Authorization: `Bearer ${BearerToken}`,
            'Openai-Organization': this.org,
            'OpenAI-Beta': 'assistants=v1',
        };
    }

    async getThreads(page = 1, pageSize = 10) {
        const params = { limit: pageSize}; //, page: page };
        try {
            const response = await axios.get(this.url, { headers: this.headers, params });
            const threadIds = response.data.data.map((t: { id: any; }) => t.id);
            return threadIds;
        } catch (error) {
            console.error(error);
            throw new Error('Error fetching threads');
        }
    }

    async processThreads(pageLimit: number) {
        let page = 1;
        let threadIds = await this.getThreads(page);

        while (threadIds.length > 0 && page <= pageLimit) {
            for (const tid of threadIds) {
                console.log(`Processing thread with id: ${tid}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            page++;
            threadIds = await this.getThreads(page);
        }
    }
}

