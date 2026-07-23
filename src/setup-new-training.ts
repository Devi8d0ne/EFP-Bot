import { readFile, writeFile } from "node:fs/promises";
import { ChannelType, Client, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";
import { matchesDisplayName } from "./server-layout.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

try {
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  await guild.channels.fetch();

  const trainingCategory = guild.channels.cache.find(
    (channel) => channel?.type === ChannelType.GuildCategory && matchesDisplayName(channel.name, "TRAINING & CERTIFICATION"),
  );
  const lessonTemplate = guild.channels.cache.find(
    (channel) => channel?.type === ChannelType.GuildText && matchesDisplayName(channel.name, "lesson-11-fit-for-duty"),
  );
  const salesCategory = guild.channels.cache.find(
    (channel) => channel?.type === ChannelType.GuildCategory && matchesDisplayName(channel.name, "SALES FLOOR"),
  );
  const dailyWall = guild.channels.cache.find(
    (channel) => channel?.type === ChannelType.GuildText && matchesDisplayName(channel.name, "efp-daily-wall-chart"),
  );
  if (!trainingCategory || trainingCategory.type !== ChannelType.GuildCategory || !lessonTemplate || lessonTemplate.type !== ChannelType.GuildText) {
    throw new Error("Training category or lesson template not found.");
  }
  if (!salesCategory || salesCategory.type !== ChannelType.GuildCategory || !dailyWall || dailyWall.type !== ChannelType.GuildText) {
    throw new Error("Sales category or Daily Wall Chart template not found.");
  }

  const ensureClone = async (name: string, topic: string, parentId: string, template: typeof lessonTemplate) => {
    const existing = guild.channels.cache.find(
      (channel) => channel?.type === ChannelType.GuildText && matchesDisplayName(channel.name, name),
    );
    const permissionOverwrites = template.permissionOverwrites.cache.map((overwrite) => ({
      id: overwrite.id,
      type: overwrite.type,
      allow: overwrite.allow,
      deny: overwrite.deny,
    }));
    if (existing && existing.type === ChannelType.GuildText) {
      return existing.edit({ parent: parentId, topic, permissionOverwrites, reason: "Add only the new EFP training and wall channels" });
    }
    return guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: parentId,
      topic,
      permissionOverwrites,
      reason: "Add only the new EFP training and wall channels",
    });
  };

  await ensureClone(
    "lesson-12-sales-tracker",
    "Lesson 12 copy, audio, and Sales Tracker: Daily and Weekly Reporting test.",
    trainingCategory.id,
    lessonTemplate,
  );
  await ensureClone(
    "lesson-13-document-scanner",
    "Lesson 13 copy, audio, and Document Scanner and Live Sales Drops test.",
    trainingCategory.id,
    lessonTemplate,
  );
  const weeklyWall = await ensureClone(
    "efp-weekly-wall-chart",
    "Automated agent recognition from completed Monday-through-Sunday EFP Wiki sales totals. No customer or commission details.",
    salesCategory.id,
    dailyWall,
  );

  const roadmap = guild.channels.cache.find(
    (channel) => channel?.type === ChannelType.GuildText && matchesDisplayName(channel.name, "certification-roadmap"),
  );
  const certificationWall = guild.channels.cache.find(
    (channel) => channel?.type === ChannelType.GuildText && matchesDisplayName(channel.name, "certification-wall"),
  );
  if (roadmap?.type === ChannelType.GuildText) await roadmap.setTopic("Thirteen guided lessons, lesson tests, final certification, and coach sign-off.");
  if (certificationWall?.type === ChannelType.GuildText) await certificationWall.setTopic("Celebrate agents who complete all thirteen lesson tests and pass final EFP certification.");

  const hooks = await weeklyWall.fetchWebhooks();
  const hook = hooks.find((candidate) => candidate.name === "EFP Weekly Wall Chart")
    ?? await weeklyWall.createWebhook({ name: "EFP Weekly Wall Chart", reason: "EFP weekly sales recognition" });
  let secrets: Record<string, { channelId: string; url: string }> = {};
  try {
    secrets = JSON.parse(await readFile(".discord-webhooks.json", "utf8"));
  } catch {
    // Initialize the local registry when necessary.
  }
  secrets.weeklyWallChart = { channelId: weeklyWall.id, url: hook.url };
  await writeFile(".discord-webhooks.json", `${JSON.stringify(secrets, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  console.log("Lesson 12, Lesson 13, and the Weekly Wall Chart are configured.");
} finally {
  client.destroy();
}
