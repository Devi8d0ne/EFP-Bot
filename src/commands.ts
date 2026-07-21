import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("setup-server")
    .setDescription("Create or update the EFP server structure")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName("ping").setDescription("Check whether EFP Bot is online"),
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
