import {OpenAICommunicator} from "./OpenAICommunicator";
import {IDataStore} from "./IDataStore";
import {DiscordTalker} from "./DiscordTalker";

export class FunctionDispatcher {
    Talker: DiscordTalker;
    DataStore: IDataStore;
    Communicator: OpenAICommunicator;
    constructor(talker: DiscordTalker, dataStore: IDataStore, openai: OpenAICommunicator) {
        this.Talker=talker;
        this.DataStore = dataStore;
        this.Communicator=openai;// You can initialize anything else you might need here
    }

    async Dispatch(functionName:string, args:any) : Promise<any>{
        switch (functionName) {
            case 'run_prompt':
                return this.run_prompt(args);
            case 'image_fail':
                return this.image_fail(args);
            case 'get_token':
                return this.get_token(args);
            case 'delete_token':
                return this.delete_token(args);
            case 'store_token':
                return this.store_token(args);
            case 'analyze_prompt':
                return this.analyze_prompt(args);
            default:
                throw new Error(`Function ${functionName} not recognized.`);
        }
    }

    async run_prompt(args:any) : Promise<any> {
        // logic for running prompt
        const prompt = args.prompt;
        await this.Talker.sendResponse("Requesting: " + prompt);
        await this.Talker.sendImageResponse(prompt)
    }

    async image_fail(args:any) : Promise<any> {
        // logic to handle image failure
        await this.Talker.sendResponse(args.Failure_message_detail);
    }

    async get_token(args:any) : Promise<any> {
        // logic to get a token
        let rVal= await this.DataStore.getData(args.token, this.Talker.getUserId())
        if (!rVal) {
           rVal= await this.DataStore.getData(args.token, "global")
        }
    }

    async delete_token(args:any) : Promise<any> {
        // logic to delete a token
        let userId = this.Talker.getUserId();
        if (args.level=="global") {
            userId="global";
        }
        await this.DataStore.deleteData(args.token, userId);
        return "ok";
    }

    async store_token(args: any) : Promise<any> {
        // logic to store a token
        let userId = this.Talker.getUserId();
        if (args.level=="global")
        {
            userId = "global";
        }
        await this.DataStore.storeData(args.token, userId, args.value);
    }

    async analyze_prompt(arg: any) : Promise<any> {
        const analysis= this.Talker.analyzePrompt(arg.prompt);
        await  this.Talker.sendResponse("Tha analysis is: " + analysis);
    }
}
