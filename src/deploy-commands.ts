import { REST, Routes } from "discord.js";
import { commands } from "./commands.js";
import { config } from "./config.js";

const rest = new REST({ version: "10" }).setToken(config.token);

await rest.put(Routes.applicationGuildCommands(config.applicationId, config.guildId), {
  body: commands,
});

console.log(`Deployed ${commands.length} commands to guild ${config.guildId}.`);

