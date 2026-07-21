import { Client, Events, GatewayIntentBits, PermissionFlagsBits } from "discord.js";
import { config } from "./config.js";
import { setupServer } from "./setup-server.js";
import { closeTicket, openTicket } from "./tickets.js";
import {
  handleCertificationCommand,
  handleConnectWikiModal,
  isCertificationModal,
  reconcileCertificationFeed,
  showConnectWikiModal,
  showMyProgress,
} from "./certification.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let certificationPollRunning = false;

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`EFP Bot ready as ${readyClient.user.tag}`);
  try {
    const processed = await reconcileCertificationFeed(client, false);
    console.log(`Certification feed reconciled: ${processed} recent result messages reviewed.`);
  } catch (error) {
    console.error("Certification startup reconciliation failed", error);
  }
  setInterval(async () => {
    if (certificationPollRunning) return;
    certificationPollRunning = true;
    try {
      await reconcileCertificationFeed(client, true);
    } catch (error) {
      console.error("Certification feed poll failed", error);
    } finally {
      certificationPollRunning = false;
    }
  }, 15_000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isModalSubmit() && isCertificationModal(interaction)) {
    if (!interaction.inCachedGuild()) return;
    try {
      await handleConnectWikiModal(interaction);
    } catch (error) {
      console.error("Wiki connection failed", error);
      const message = "The Wiki connection failed. Please try again or alert an EFP administrator.";
      if (interaction.deferred || interaction.replied) await interaction.editReply(message);
      else await interaction.reply({ content: message, ephemeral: true });
    }
    return;
  }
  if (!interaction.isChatInputCommand() || !interaction.inGuild()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply({ content: "EFP Bot is online.", ephemeral: true });
    return;
  }

  if (interaction.commandName === "connect-wiki") {
    await showConnectWikiModal(interaction);
    return;
  }

  if (interaction.commandName === "my-progress") {
    if (!interaction.inCachedGuild()) return;
    await showMyProgress(interaction);
    return;
  }

  if (interaction.commandName === "certification") {
    if (!interaction.inCachedGuild()) return;
    try {
      await handleCertificationCommand(interaction, client);
    } catch (error) {
      console.error("Certification command failed", error);
      const message = "The certification action failed. Please alert an EFP administrator.";
      if (interaction.deferred || interaction.replied) await interaction.editReply(message);
      else await interaction.reply({ content: message, ephemeral: true });
    }
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
