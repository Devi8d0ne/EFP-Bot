import { ChannelType, Client, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

try {
  await client.login(config.token);
  const connected = [...client.guilds.cache.values()];
  if (!connected.length) throw new Error("The bot is not connected to any Discord servers.");
  const configured = connected.find((guild) => guild.id === config.guildId);
  if (!configured) {
    throw new Error(`Configured server ${config.guildId} was not found. Connected servers: ${connected.map((guild) => `${guild.name} (${guild.id})`).join(", ")}`);
  }

  const guild = await client.guilds.fetch(configured.id);
  const roles = await guild.roles.fetch();
  const channels = await guild.channels.fetch();
  const member = await guild.members.fetchMe();

  console.log(`Server: ${guild.name} (${guild.id})`);
  console.log(`Community rules: ${guild.rulesChannel?.name ?? "none"}`);
  console.log(`Community updates: ${guild.publicUpdatesChannel?.name ?? "none"}`);
  console.log(`Features: ${guild.features.join(", ") || "none"}`);
  console.log(`Bot: ${member.user.tag} (${member.id})`);
  console.log(`Bot permissions: ${member.permissions.toArray().join(", ")}`);
  console.log("Roles (highest first):");
  for (const role of [...roles.values()].sort((a, b) => b.position - a.position)) {
    console.log(`- ${role.name} | id=${role.id} | position=${role.position} | permissions=${role.permissions.toArray().join(",") || "none"}`);
  }
  console.log("Channels:");
  for (const channel of [...channels.values()].filter((value) => value).sort((a, b) => a!.rawPosition - b!.rawPosition)) {
    const type = ChannelType[channel!.type] ?? String(channel!.type);
    console.log(`- ${channel!.name} | id=${channel!.id} | type=${type} | parent=${channel!.parent?.name ?? "none"}`);
  }
} finally {
  client.destroy();
}
