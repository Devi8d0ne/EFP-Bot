import { ChannelType, Client, GatewayIntentBits, PermissionFlagsBits } from "discord.js";
import { config } from "./config.js";
import { matchesDisplayName } from "./server-layout.js";

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
    { role: "@everyone", channel: "welcome", allowView: true, allowSend: false },
    { role: "@everyone", channel: "the-opportunity", allowView: true, allowSend: false },
    { role: "@everyone", channel: "efp-jobs", allowView: true, allowSend: false },
    { role: "@everyone", channel: "recruiting-playbook", allowView: false, allowSend: false },
    { role: "@everyone", channel: "recruiting-ideas", allowView: false, allowSend: false },
    { role: "@everyone", channel: "town-square", allowView: false, allowSend: false },
    { role: "@everyone", channel: "Main Sales Floor", allowView: false, allowConnect: false },
    { role: "Agent", channel: "town-square", allowView: true, allowSend: true },
    { role: "Agent", channel: "agent-handbook", allowView: true, allowSend: false },
    { role: "Agent", channel: "recruiting-playbook", allowView: true, allowSend: false },
    { role: "Agent", channel: "Main Sales Floor", allowView: true, allowConnect: true },
    { role: "Agent", channel: "ADMIN OPERATIONS", allowView: false },
    { role: "Agent", channel: "LEADERSHIP OPERATIONS", allowView: false },
    { role: "Field Manager", channel: "LEADERSHIP OPERATIONS", allowView: true },
    { role: "Field Manager", channel: "OFFICE OPERATIONS", allowView: false },
    { role: "General Manager", channel: "LEADERSHIP OPERATIONS", allowView: true },
    { role: "General Manager", channel: "OFFICE OPERATIONS", allowView: true },
    { role: "Office", channel: "OFFICE OPERATIONS", allowView: true },
    { role: "Office", channel: "LEADERSHIP OPERATIONS", allowView: false },
    { role: "Admin", channel: "ADMIN OPERATIONS", allowView: true },
    { role: "Admin", channel: "APP DATA FEEDS", allowView: true },
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
    };
    for (const key of ["allowView", "allowSend", "allowConnect"] as const) {
      if (check[key] !== undefined && check[key] !== actual[key]) failures.push(`${check.role} in ${check.channel}: expected ${key}=${check[key]}, got ${actual[key]}`);
    }
  }

  const stage = channel("EFP All Hands");
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
