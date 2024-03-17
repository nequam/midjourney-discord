import {
  ApplicationCommandOptionType,
  CacheType,
  ChannelType,
  Client,
  GatewayIntentBits,
  Interaction,
  Message,
  TextChannel,
} from "discord.js";
/*
 import { Midjourney, MidjourneyApi } from "midjourney";
*/
import {Midjourney} from "freezer-midjourney-api";
import {BotConfig, BotConfigParam, DefaultBotConfig} from "./interfaces";
import {OpenAICommunicator} from "./OpenAICommunicator";
import { createDataStore } from './DataStoreFactory';
import { IDataStore } from './IDataStore';

export class MidjourneyBot extends Midjourney {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessageReactions,
      GatewayIntentBits.DirectMessageTyping,
    ],
  });
  public config: BotConfig;
  // @ts-ignore
  private communicator: OpenAICommunicator;
  private dataStore: IDataStore;


  constructor(defaults: BotConfigParam) {
    const config = {
      ...DefaultBotConfig,
      ...defaults,
    };
    super(config);
    this.config = config;
    this.dataStore = createDataStore();
  }

  async start() {

    await this.dataStore.init();
    this.communicator = new OpenAICommunicator(this.dataStore);
    this.client.on("ready", this.onReady.bind(this));
    this.client.on("messageCreate", this.onMessage.bind(this));
    this.client.on("interactionCreate", this.onInteraction.bind(this));
    await this.init();
    await this.client.login(this.config.DavinciToken);
    this.log("Bot started");
  }

  async onInteraction(interaction: Interaction<CacheType>) {
    if (!interaction.isChatInputCommand()) return;
    switch (interaction.commandName) {
      case "oh_imagine":
        await this.ImagineCmd(interaction);
        break;
      case "ai_imagine":
        await this.ImagineCmdAI(interaction);
        break;
      case "ai_reset":
        await this.ResetAI(interaction);
        break;
    }

  }

  async ResetAI(interaction: Interaction<CacheType>) {
    if (!interaction.isChatInputCommand()) return;
    interaction.reply("Resetting your thread.");

    await this.communicator.resetAI(interaction.user.id.toString());
  }

async ImagineCmdAI(interaction: Interaction<CacheType>) {
    if (!interaction.isChatInputCommand()) return;
    const prompt = interaction.options.getString("prompt");
    if (prompt === null) {
    return;
    }
    this.log("prompt", prompt);

    interaction.reply("Talking to another AI, please wait a moment...");

    const newPrompt = await this.communicator.sendMessage(interaction.user.id.toString(), prompt);

    this.log("prompt", newPrompt);

    if (newPrompt!=prompt) {
      interaction.followUp("The old Prompt: " + prompt + "\nThe new prompt is " + newPrompt);
    } else {
      interaction.followUp("No Change");
    }
    this.MJApi.config.ChannelId = interaction.channelId;

    const httpStatus = await this.MJApi.ImagineApi(newPrompt);

    if (httpStatus !== 204) {
      await interaction.followUp("Request has failed; please try later");
    } else {
      await interaction.followUp(
          "Your image is being prepared, please wait a moment..."
      );
    }

}
  async ImagineCmd(interaction: Interaction<CacheType>) {
    if (!interaction.isChatInputCommand()) return;
    const prompt = interaction.options.getString("prompt");
    if (prompt === null) {
      return;
    }
    this.log("prompt", prompt);
    this.MJApi.config.ChannelId = interaction.channelId;
    const httpStatus = await this.MJApi.ImagineApi(prompt);
    if (httpStatus !== 204) {
      await interaction.reply("Request has failed; please try later");
    } else {
      await interaction.reply(
        "Your image is being prepared, please wait a moment..."
      );
    }
  }

  async onReady() {
    await this.client.application?.commands.create({
      name: "oh_imagine",
      description: "This command is a wrapper of MidJourneyAI",
      options: [
        {
          name: "prompt",
          type: ApplicationCommandOptionType.String,
          description: "The prompt for the AI to imagine",
          required: true,
        },
      ],
    });

    await this.client.application?.commands.create({
      name: "ai_imagine",
      description: "This command is a wrapper around ChatGPT and MidJoruneyAI",
      options: [
        {
          name: "prompt",
          type: ApplicationCommandOptionType.String,
          description: "The prompt for the AI to expand for midjourney",
          required: true,
        },
      ],
    });

    await this.client.application?.commands.create({
      name: "ai_reset",
      description: "Reset the thread that you are on.",
    });

  }

  async getMessage(channelId: string, messageId: string) {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) return;
    return await channel.messages.fetch(messageId);
  }

  async upscale(index: 1 | 2 | 3 | 4, channelId: string, messageID: string) {
    const msg = await this.getMessage(channelId, messageID);
    if (!msg) return;
    this.log(msg?.attachments.first()?.url);
    const messageHash = this.UriToHash(<string>msg.attachments.first()?.url);
    this.MJApi.config.ChannelId = channelId;
    const httpStatus = await this.MJApi.UpscaleApi({
      index,
      msgId: messageID,
      hash: messageHash,
      flags: 0
    });
    if (httpStatus !== 204) {
      await (<TextChannel>this.client.channels.cache.get(channelId)).send(
        "Request has failed; please try later"
      );
    } else {
      await (<TextChannel>this.client.channels.cache.get(channelId)).send(
        "Your upscale image is being prepared, please wait a moment..."
      );
    }
  }

  async variation(index: 1 | 2 | 3 | 4, channelId: string, messageID: string) {
    const msg = await this.getMessage(channelId, messageID);
    if (!msg) return;
    this.log(msg?.attachments.first()?.url);
    const messageHash = this.UriToHash(<string>msg.attachments.first()?.url);
    this.MJApi.config.ChannelId = channelId;
    const httpStatus = await this.MJApi.VariationApi({
      index,
      msgId: messageID,
      hash: messageHash,
      flags: 0
    });
    if (httpStatus !== 204) {
      await (<TextChannel>this.client.channels.cache.get(channelId)).send(
        "Request has failed; please try later"
      );
    } else {
      await (<TextChannel>this.client.channels.cache.get(channelId)).send(
        "Your variations image is being prepared, please wait a moment..."
      );
    }
  }

  private async onMessage(message: Message<boolean>) {
    if (message.author.bot) return; // Ignore messages from bots
    if (message.content === "") return;
    if (message.reference === null) return;
    if (message.reference.messageId === undefined) return;
    if (message.mentions.repliedUser?.id !== "936929561302675456") return;
    const option = message.content;
    const channelId = message.channelId;
    switch (option) {
      case "v1":
        await this.variation(1, channelId, message.reference.messageId);
        break;
      case "v2":
        await this.variation(2, channelId, message.reference.messageId);
        break;
      case "v3":
        await this.variation(3, channelId, message.reference.messageId);
        break;
      case "v4":
        await this.variation(4, channelId, message.reference.messageId);
        break;
      case "u1":
        await this.upscale(1, channelId, message.reference.messageId);
        break;
      case "u2":
        await this.upscale(2, channelId, message.reference.messageId);
        break;
      case "u3":
        await this.upscale(3, channelId, message.reference.messageId);
        break;
      case "u4":
        await this.upscale(4, channelId, message.reference.messageId);
        break;
    }
  }
}
