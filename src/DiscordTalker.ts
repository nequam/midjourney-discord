import {
    Interaction
} from "discord.js";

import {MidjourneyBot} from "./bot";

export class DiscordTalker {
    private interaction: Interaction;
    private replied:boolean
    private bot:MidjourneyBot

    constructor(interaction: Interaction, bot:MidjourneyBot) {
        this.interaction = interaction;
        this.replied=false;
        this.bot=bot;
    }

    async sendResponse(message: string): Promise<void> {
        if (!this.interaction.isChatInputCommand()) return;
        if (!this.replied) {
           await this.interaction.reply(message);
           this.replied=true;
           return;
        }
        await this.interaction.followUp(message);
    }

    async sendImageResponse(prompt: string): Promise<void> {
        // await this.sendResponse("Talker Requesting: " + prompt);
        // await this.bot.MJApi.
        await this.bot.SendImageToMidJourney(prompt);
    }

    getUserId() : string
    {
        return this.interaction.user.id;
    }

    async getUser() : Promise<string>
    {

        const rVal =  JSON.stringify(this.interaction.user);
        return rVal;
    }

    async analyzePrompt(prompt: string): Promise<void> {
        await this.bot.AnalyzePrompt(prompt);
    }

}