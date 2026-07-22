import { ChannelType, Client, GatewayIntentBits, PermissionFlagsBits } from "discord.js";
import { config } from "./config.js";
import { matchesDisplayName, serverLayout } from "./server-layout.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const failures: string[] = [];

try {
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  const roles = await guild.roles.fetch();
  const channel = (name: string) => channels.find((candidate) => candidate && matchesDisplayName(candidate.name, name));
  const role = (name: string) => roles.find((candidate) => candidate.name === name);

  const checks = [
    { role: "@everyone", channel: "welcome", allowView: true, allowSend: false, allowThreadSend: false, allowCreatePublicThreads: false, allowCreatePrivateThreads: false },
    { role: "@everyone", channel: "the-opportunity", allowView: false, allowSend: false },
    { role: "@everyone", channel: "efp-jobs", allowView: false, allowSend: false },
    { role: "@everyone", channel: "lesson-01-foundation", allowView: false, allowSend: false },
    { role: "@everyone", channel: "certification-wall", allowView: false, allowSend: false, allowThreadSend: false, allowCreatePublicThreads: false, allowCreatePrivateThreads: false },
    { role: "@everyone", channel: "recruiting-playbook", allowView: false, allowSend: false },
    { role: "@everyone", channel: "recruiting-ideas", allowView: false, allowSend: false },
    { role: "@everyone", channel: "town-square", allowView: false, allowSend: false },
    { role: "@everyone", channel: "Main Sales Floor", allowView: false, allowConnect: false },
    { role: "Agent", channel: "town-square", allowView: true, allowSend: true },
    { role: "Agent", channel: "agent-handbook", allowView: true, allowSend: false, allowThreadSend: false, allowCreatePublicThreads: false, allowCreatePrivateThreads: false },
    { role: "Agent", channel: "recruiting-playbook", allowView: true, allowSend: false },
    { role: "Agent", channel: "the-opportunity", allowView: true, allowSend: false },
    { role: "Agent", channel: "lesson-01-foundation", allowView: true, allowSend: false },
    { role: "Agent", channel: "Main Sales Floor", allowView: true, allowConnect: true },
    { role: "@everyone", channel: "francis-team-live-sales-drops", allowView: false, allowSend: false },
    { role: "Agent", channel: "francis-team-live-sales-drops", allowView: true, allowSend: true, allowAttach: true, allowReact: true },
    { role: "Agent", channel: "dennis-team-live-sales-drops", allowView: true, allowSend: true, allowAttach: true, allowReact: true },
    { role: "Agent", channel: "dave-team-live-sales-drops", allowView: true, allowSend: true, allowAttach: true, allowReact: true },
    { role: "Agent", channel: "josiah-team-live-sales-drops", allowView: true, allowSend: true, allowAttach: true, allowReact: true },
    { role: "Agent", channel: "efp-daily-wall-chart", allowView: true, allowSend: false, allowReact: true },
    { role: "Agent", channel: "ADMIN OPERATIONS", allowView: false },
    { role: "Agent", channel: "LEADERSHIP OPERATIONS", allowView: false },
    { role: "Agent", channel: "certification-review", allowView: false },
    { role: "Field Manager", channel: "LEADERSHIP OPERATIONS", allowView: false },
    { role: "Field Manager", channel: "certification-review", allowView: false },
    { role: "Field Manager", channel: "OFFICE OPERATIONS", allowView: false },
    { role: "Field Manager", channel: "APP DATA FEEDS", allowView: false },
    { role: "General Manager", channel: "LEADERSHIP OPERATIONS", allowView: true },
    { role: "General Manager", channel: "certification-review", allowView: true, allowSend: true },
    { role: "General Manager", channel: "OFFICE OPERATIONS", allowView: true },
    { role: "Office", channel: "OFFICE OPERATIONS", allowView: true },
    { role: "Office", channel: "LEADERSHIP OPERATIONS", allowView: true },
    { role: "Office", channel: "certification-review", allowView: true, allowSend: true },
    { role: "Admin", channel: "ADMIN OPERATIONS", allowView: true },
    { role: "Admin", channel: "APP DATA FEEDS", allowView: true },
    { role: "Admin", channel: "certification-review", allowView: true, allowSend: true },
  ];

  for (const check of checks) {
    const targetRole = check.role === "@everyone" ? guild.roles.everyone : role(check.role);
    const targetChannel = channel(check.channel);
    if (!targetRole || !targetChannel) {
      failures.push(`Missing ${!targetRole ? `role ${check.role}` : `channel ${check.channel}`}`);
      continue;
    }
    const permissions = targetChannel.permissionsFor(targetRole);
    const actual = {
      allowView: permissions?.has(PermissionFlagsBits.ViewChannel) ?? false,
      allowSend: permissions?.has(PermissionFlagsBits.SendMessages) ?? false,
      allowConnect: permissions?.has(PermissionFlagsBits.Connect) ?? false,
      allowReact: permissions?.has(PermissionFlagsBits.AddReactions) ?? false,
      allowAttach: permissions?.has(PermissionFlagsBits.AttachFiles) ?? false,
      allowThreadSend: permissions?.has(PermissionFlagsBits.SendMessagesInThreads) ?? false,
      allowCreatePublicThreads: permissions?.has(PermissionFlagsBits.CreatePublicThreads) ?? false,
      allowCreatePrivateThreads: permissions?.has(PermissionFlagsBits.CreatePrivateThreads) ?? false,
    };
    for (const key of ["allowView", "allowSend", "allowConnect", "allowReact", "allowAttach", "allowThreadSend", "allowCreatePublicThreads", "allowCreatePrivateThreads"] as const) {
      if (check[key] !== undefined && check[key] !== actual[key]) failures.push(`${check.role} in ${check.channel}: expected ${key}=${check[key]}, got ${actual[key]}`);
    }
  }

  const stage = channel("EFP All Hands");
  const adminCommand = channel("admin-command");
  if (!adminCommand || guild.publicUpdatesChannelId !== adminCommand.id) failures.push("Community updates channel is not admin-command");
  for (const roleName of ["Admin", "Office", "General Manager", "Field Manager", "Agent", "EFP Certified"]) {
    if (!role(roleName)) failures.push(`Missing ${roleName} role`);
  }
  const forbiddenSettingsPermissions = [
    [PermissionFlagsBits.Administrator, "Administrator"],
    [PermissionFlagsBits.ManageGuild, "Manage Server"],
    [PermissionFlagsBits.ManageRoles, "Manage Roles"],
    [PermissionFlagsBits.ManageChannels, "Manage Channels"],
    [PermissionFlagsBits.ManageWebhooks, "Manage Webhooks"],
    [PermissionFlagsBits.ViewAuditLog, "View Audit Log"],
    [PermissionFlagsBits.ManageMessages, "Manage Messages"],
    [PermissionFlagsBits.ManageThreads, "Manage Threads"],
    [PermissionFlagsBits.ManageNicknames, "Manage Nicknames"],
    [PermissionFlagsBits.ManageGuildExpressions, "Manage Expressions"],
    [PermissionFlagsBits.CreateGuildExpressions, "Create Expressions"],
    [PermissionFlagsBits.ManageEvents, "Manage Events"],
    [PermissionFlagsBits.CreateEvents, "Create Events"],
    [PermissionFlagsBits.KickMembers, "Kick Members"],
    [PermissionFlagsBits.BanMembers, "Ban Members"],
    [PermissionFlagsBits.ModerateMembers, "Timeout Members"],
  ] as const;
  for (const roleName of ["Office", "General Manager", "Field Manager", "Agent", "EFP Certified"]) {
    const targetRole = role(roleName);
    if (!targetRole) continue;
    const definition = serverLayout.roles.find((candidate) => candidate.name === roleName);
    const expectedPermissions = (definition?.permissions ?? []).reduce((bits, permission) => bits | permission, 0n);
    if (targetRole.permissions.bitfield !== expectedPermissions) {
      failures.push(`${roleName} base permissions do not match the safe configured permission set`);
    }
    for (const [permission, label] of forbiddenSettingsPermissions) {
      if (targetRole.permissions.has(permission, false)) failures.push(`${roleName} unexpectedly has ${label}`);
    }
  }
  if (stage?.type !== ChannelType.GuildStageVoice) failures.push("EFP All Hands is not a Stage channel");
  for (const name of ["ideas-and-feedback", "recruiting-ideas", "arcadia-tickets", "idt-tickets", "office-questions"]) {
    if (channel(name)?.type !== ChannelType.GuildForum) failures.push(`${name} is not a Forum channel`);
  }
  const autoMod = await guild.autoModerationRules.fetch();
  if (autoMod.size < 2) failures.push(`Expected at least 2 AutoMod rules, found ${autoMod.size}`);

  if (failures.length) {
    console.error("Verification failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`Verification passed: ${checks.length} access checks, 5 forums, Stage, and ${autoMod.size} AutoMod rules.`);
  }
} finally {
  client.destroy();
}
