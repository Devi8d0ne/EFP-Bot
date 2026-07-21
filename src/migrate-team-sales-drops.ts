import { ChannelType, Client, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";
import { matchesDisplayName } from "./server-layout.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
try {
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  let channels = await guild.channels.fetch();
  const original = channels.find((channel) => channel?.type === ChannelType.GuildText && matchesDisplayName(channel.name, "live-sales-drops"));
  if (original?.type === ChannelType.GuildText) {
    await original.setName("📸・francis-team-live-sales-drops", "Preserve the existing sales-drop history for Francis's team");
    console.log("Renamed live-sales-drops for Francis's team.");
  }
  channels = await guild.channels.fetch();
  const francis = channels.find((channel) => channel?.type === ChannelType.GuildText && matchesDisplayName(channel.name, "francis-team-live-sales-drops"));
  if (!francis || francis.type !== ChannelType.GuildText) throw new Error("Francis's team sales-drop channel was not found");
  const teams = ["dennis", "dave", "josiah"];
  for (const team of teams) {
    const logicalName = `${team}-team-live-sales-drops`;
    if (channels.some((channel) => channel?.type === ChannelType.GuildText && matchesDisplayName(channel.name, logicalName))) continue;
    await guild.channels.create({
      name: `📸・${logicalName}`,
      type: ChannelType.GuildText,
      parent: francis.parentId,
      topic: `${team.charAt(0).toUpperCase()}${team.slice(1)}'s team: post sale-complete screenshots and a short running count so the team can celebrate wins in real time.`,
      permissionOverwrites: francis.permissionOverwrites.cache.map((overwrite) => ({ id: overwrite.id, type: overwrite.type, allow: overwrite.allow, deny: overwrite.deny })),
      reason: "Create team-specific live sales-drop channel",
    });
    console.log(`Created ${logicalName}.`);
  }
} finally {
  client.destroy();
}
