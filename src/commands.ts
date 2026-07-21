import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("setup-server")
    .setDescription("Create or update the EFP server structure")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName("ping").setDescription("Check whether EFP Bot is online"),
  new SlashCommandBuilder()
    .setName("connect-wiki")
    .setDescription("Privately connect your Discord profile to your EFP Wiki account"),
  new SlashCommandBuilder()
    .setName("my-progress")
    .setDescription("View your linked EFP Wiki certification progress"),
  new SlashCommandBuilder()
    .setName("certification")
    .setDescription("View or manage EFP certification connections")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("status")
        .setDescription("View certification progress")
        .addUserOption((option) => option.setName("agent").setDescription("Agent to review; leave blank for yourself")),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("unlink")
        .setDescription("Admin: remove an agent's wiki connection")
        .addUserOption((option) => option.setName("agent").setDescription("Connected Discord member").setRequired(true)),
    )
    .addSubcommand((subcommand) => subcommand.setName("reconcile").setDescription("Admin: recheck recent wiki test-result messages")),
  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Open or close a private EFP office ticket")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("open")
        .setDescription("Open a private office request")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("What is this request about?")
            .setRequired(true)
            .addChoices(
              { name: "Commission", value: "commission" },
              { name: "Badge", value: "badge" },
              { name: "Payroll", value: "payroll" },
              { name: "System access", value: "access" },
              { name: "Paperwork", value: "paperwork" },
              { name: "EFP Jobs", value: "jobs" },
              { name: "General office question", value: "general" },
            ),
        )
        .addStringOption((option) => option.setName("subject").setDescription("Short summary").setRequired(true).setMaxLength(80))
        .addStringOption((option) => option.setName("details").setDescription("Details the office team needs").setRequired(true).setMaxLength(1500)),
    )
    .addSubcommand((subcommand) => subcommand.setName("close").setDescription("Close and archive the current ticket")),
].map((command) => command.toJSON());
