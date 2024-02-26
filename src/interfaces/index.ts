import { DefaultMJConfig, MJConfig, MJConfigParam } from "midjourney";

#import { DefaultMJConfig, MJConfig, MJConfigParam } from "@ymjir/midjourney-api";

export interface BotConfig extends MJConfig {
  DavinciToken: string;
}
export interface BotConfigParam extends MJConfigParam {
  DavinciToken: string;
}

export const DefaultBotConfig: BotConfig = {
  ...DefaultMJConfig,
  DavinciToken: "",
};
