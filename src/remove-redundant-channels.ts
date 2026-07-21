import { Client, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";

const approvedNames = new Set([
  "morning-huddle",
  "midday-check",
  "end-of-day-review",
  "weekly-leadership",
  "meeting-agenda",
  "candidate-review",
  "office-ticket-desk",
]);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

try {
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  const logicalName = (name: string) => name.includes("・") ? name.split("・").slice(1).join("・") : name;
  const matches = channels.filter((channel) => channel && approvedNames.has(logicalName(channel.name)));

  for (const channel of matches.values()) {
    if (!channel) continue;
    await channel.delete("Remove user-approved redundant EFP channel");
    console.log(`Removed ${channel.name}`);
  }

  const missing = [...approvedNames].filter((name) => !matches.some((channel) => channel && logicalName(channel.name) === name));
  if (missing.length) console.log(`Already absent: ${missing.join(", ")}`);
} finally {
  client.destroy();
}
