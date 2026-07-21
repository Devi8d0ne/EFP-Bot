import { Client, Events, GatewayIntentBits, PermissionFlagsBits } from "discord.js";
import { config } from "./config.js";
import { setupServer } from "./setup-server.js";
import { closeTicket, openTicket } from "./tickets.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
  console.log(`EFP Bot ready as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || !interaction.inGuild()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply({ content: "EFP Bot is online.", ephemeral: true });
    return;
  }

  if (interaction.commandName === "ticket") {
    try {
      if (!interaction.inCachedGuild()) return;
      if (interaction.options.getSubcommand() === "open") await openTicket(interaction);
      else await closeTicket(interaction);
    } catch (error) {
      console.error(error);
      const message = "The ticket action failed. Please alert an EFP administrator.";
      if (interaction.deferred || interaction.replied) await interaction.editReply(message);
      else await interaction.reply({ content: message, ephemeral: true });
    }
    return;
  }

  if (interaction.commandName === "setup-server") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "Administrator permission is required.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      const guild = await client.guilds.fetch(interaction.guildId);
      const result = await setupServer(guild);
      await interaction.editReply(
        `Setup complete: ${result.rolesCreated} roles created, ${result.rolesUpdated} roles updated, ` +
          `${result.categoriesCreated} categories created, ${result.channelsCreated} channels created, ` +
          `${result.channelsUpdated} channels updated.`,
      );
    } catch (error) {
      console.error(error);
      await interaction.editReply("Setup failed. Check the bot logs and its server permissions.");
    }
  }
});

client.login(config.token);
