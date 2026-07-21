import { ChannelType, Client, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
try {
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  let channels = await guild.channels.fetch();
  const legacyNames = new Set(["general", "rules"]);
  let deleted = 0;
  for (const channel of channels.values()) {
    if (!channel || !legacyNames.has(channel.name.toLowerCase())) continue;
    try {
      await channel.delete("Remove legacy default EFP channel");
      deleted++;
    } catch (error) {
      console.warn(`Could not remove legacy channel ${channel.name}:`, error instanceof Error ? error.message : error);
    }
  }
  channels = await guild.channels.fetch();
  for (const categoryName of ["Text Channels", "Voice Channels"]) {
    const category = channels.find((channel) => channel?.type === ChannelType.GuildCategory && channel.name === categoryName);
    if (!category || category.type !== ChannelType.GuildCategory) continue;
    const hasChildren = channels.some((channel) => channel?.parentId === category.id);
    if (!hasChildren) {
      await category.delete("Remove empty legacy default category");
      deleted++;
    }
  }
  channels = await guild.channels.fetch();
  const moderatorOnly = channels.find((channel) => channel?.name.toLowerCase() === "moderator-only");
  const adminCategory = channels.find((channel) => channel?.type === ChannelType.GuildCategory && channel.name.endsWith("・ADMIN OPERATIONS"));
  if (moderatorOnly && adminCategory?.type === ChannelType.GuildCategory) {
    await moderatorOnly.setParent(adminCategory, { lockPermissions: false, reason: "Keep moderator-only in the bottom admin section" });
    await moderatorOnly.setPosition(adminCategory.children.cache.size - 1, { reason: "Keep moderator-only at the bottom" });
  }
  console.log(`Removed ${deleted} legacy channels/categories.`);
} finally {
  client.destroy();
}
