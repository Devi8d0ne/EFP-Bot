import { Client, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";
import { setupServer } from "./setup-server.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

try {
  await client.login(config.token);
  const available = [...client.guilds.cache.values()];
  const connectedGuild = client.guilds.cache.get(config.guildId);
  if (!connectedGuild) {
    const guildList = available.length
      ? available.map((guild) => `${guild.name} (${guild.id})`).join(", ")
      : "none";
    throw new Error(`Bot is not connected to configured guild ${config.guildId}. Connected guilds: ${guildList}`);
  }
  const guild = await client.guilds.fetch(connectedGuild.id);
  const result = await setupServer(guild);

  console.log(`Configured ${guild.name} (${guild.id}).`);
  console.log(result);
} finally {
  client.destroy();
}
