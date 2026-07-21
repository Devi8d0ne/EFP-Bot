import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type Guild,
  type ModalSubmitInteraction,
} from "discord.js";
import { config } from "./config.js";
import { matchesDisplayName } from "./server-layout.js";

type AgentRegistryEntry = { name: string; email: string; credentialHash: string; active: boolean };
type AgentLink = { agentCode: string; agentName: string; linkedAt: string };
type TestResult = { score: string; result: string; submittedAt: string; messageId: string };
type AgentProgress = {
  lessons: Record<string, TestResult>;
  completedLessons: number;
  totalLessons: number;
  final?: TestResult;
  certifiedAt?: string;
  announcedAt?: string;
};
type CertificationState = {
  version: 1;
  links: Record<string, AgentLink>;
  progress: Record<string, AgentProgress>;
  processedMessageIds: string[];
};
type RawWebhookMessage = {
  id: string;
  embeds?: Array<{
    title?: string;
    footer?: { text?: string };
    fields?: Array<{ name: string; value: string }>;
  }>;
};

const DATA_PATH = process.env.EFP_CERTIFICATION_DATA_PATH || resolve(process.cwd(), ".data/certification.json");
const AGENTS_PATH = process.env.EFP_WIKI_AGENTS_PATH || resolve(process.cwd(), "../efp-wiki/src/agents.js");
const WEBHOOKS_PATH = process.env.EFP_DISCORD_WEBHOOKS_PATH || resolve(process.cwd(), ".discord-webhooks.json");
const WIKI_URL = "https://wiki.energyfreedomproject.site";
const CONNECT_MODAL_ID = "efp:connect-wiki";
export const CONNECT_BUTTON_ID = "efp:open-connect-wiki";
export const PROGRESS_BUTTON_ID = "efp:my-progress";
const CONNECT_WINDOW_MS = 15 * 60 * 1000;
const CONNECT_MAX_ATTEMPTS = 5;
const connectAttempts = new Map<string, number[]>();
let stateQueue: Promise<void> = Promise.resolve();

const lessons = [
  [1, "01-foundation-and-process", "Foundation and the Field Process"],
  [2, "02-psychology-and-reclosing", "Psychology and Reclosing"],
  [3, "03-arcadia-community-solar", "Arcadia Community Solar"],
  [4, "04-idt-offer-and-disclosures", "IDT Offer and Disclosures"],
  [5, "05-transitions-contentions-and-referrals", "Transitions, Contentions, and Referrals"],
  [6, "06-lmi-document-validation", "LMI Document Validation"],
  [7, "07-utility-bill-validation", "Utility Bill Validation"],
  [8, "08-field-standards-and-certification", "Field Standards and Certification"],
  [9, "09-rebuttal-frameworks-and-reclosing", "Rebuttal Frameworks and Reclosing"],
] as const;

function emptyState(): CertificationState {
  return { version: 1, links: {}, progress: {}, processedMessageIds: [] };
}

async function readState(): Promise<CertificationState> {
  try {
    const parsed = JSON.parse(await readFile(DATA_PATH, "utf8")) as Partial<CertificationState>;
    return {
      version: 1,
      links: parsed.links ?? {},
      progress: parsed.progress ?? {},
      processedMessageIds: parsed.processedMessageIds ?? [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
    throw error;
  }
}

async function writeState(state: CertificationState) {
  await mkdir(dirname(DATA_PATH), { recursive: true });
  const temporary = `${DATA_PATH}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(temporary, DATA_PATH);
}

async function mutateState<T>(mutator: (state: CertificationState) => Promise<T> | T): Promise<T> {
  let output!: T;
  const task = stateQueue.then(async () => {
    const state = await readState();
    output = await mutator(state);
    await writeState(state);
  });
  stateQueue = task.catch(() => undefined);
  await task;
  return output;
}

async function loadAgents(): Promise<AgentRegistryEntry[]> {
  const sourceStat = await stat(AGENTS_PATH);
  const imported = await import(`${pathToFileURL(AGENTS_PATH).href}?v=${sourceStat.mtimeMs}`) as { agents?: unknown };
  if (!Array.isArray(imported.agents)) throw new Error(`Agent registry is invalid: ${AGENTS_PATH}`);
  return imported.agents.filter((entry): entry is AgentRegistryEntry => {
    if (!entry || typeof entry !== "object") return false;
    const value = entry as Partial<AgentRegistryEntry>;
    return typeof value.name === "string" && typeof value.email === "string" && typeof value.credentialHash === "string" && typeof value.active === "boolean";
  });
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function credentialHash(email: string, zip: string) {
  return createHash("sha256").update(`${normalizeEmail(email)}:${zip.trim()}`).digest("hex");
}

function hasConnectCapacity(userId: string) {
  const now = Date.now();
  const recent = (connectAttempts.get(userId) ?? []).filter((time) => now - time < CONNECT_WINDOW_MS);
  if (recent.length >= CONNECT_MAX_ATTEMPTS) return false;
  recent.push(now);
  connectAttempts.set(userId, recent);
  return true;
}

function findLogicalChannel(guild: Guild, name: string) {
  return guild.channels.cache.find((channel) => matchesDisplayName(channel.name, name));
}

function progressFor(state: CertificationState, agentCode: string): AgentProgress {
  return state.progress[agentCode] ??= { lessons: {}, completedLessons: 0, totalLessons: 9 };
}

function progressText(link: AgentLink, progress?: AgentProgress) {
  const passed = progress ? Object.values(progress.lessons).filter((result) => result.result === "PASS").length : 0;
  const reported = progress?.completedLessons ?? 0;
  const lessonLines = lessons.map(([number, , title]) => `${progress?.lessons[String(number)]?.result === "PASS" ? "✅" : "▫️"} ${number}. ${title}`);
  const finalStatus = progress?.final?.result === "PASS" ? "✅ Passed" : progress?.final ? `⚠️ ${progress.final.result}` : "▫️ Not submitted";
  return `**${link.agentName}**\nAgent code: \`${link.agentCode}\`\nLesson progress reported by wiki: **${reported}/9**\nTracked passing results: **${passed}/9**\n\n${lessonLines.join("\n")}\n\n**Final certification:** ${finalStatus}\n**Certified role:** ${progress?.certifiedAt ? "✅ Granted" : "▫️ Not yet"}`;
}

export async function showConnectWikiModal(interaction: ChatInputCommandInteraction | ButtonInteraction) {
  const modal = new ModalBuilder().setCustomId(CONNECT_MODAL_ID).setTitle("Connect your EFP Wiki account");
  const email = new TextInputBuilder()
    .setCustomId("wiki-email")
    .setLabel("EFP Wiki email")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(254)
    .setPlaceholder("you@example.com");
  const zip = new TextInputBuilder()
    .setCustomId("wiki-zip")
    .setLabel("EFP Wiki ZIP code")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(10)
    .setPlaceholder("12345");
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(email),
    new ActionRowBuilder<TextInputBuilder>().addComponents(zip),
  );
  await interaction.showModal(modal);
}

export function isCertificationModal(interaction: ModalSubmitInteraction) {
  return interaction.customId === CONNECT_MODAL_ID;
}

export async function handleConnectWikiModal(interaction: ModalSubmitInteraction<"cached">) {
  if (!hasConnectCapacity(interaction.user.id)) {
    await interaction.reply({ content: "Too many connection attempts. Wait 15 minutes and try again.", ephemeral: true });
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  const email = interaction.fields.getTextInputValue("wiki-email");
  const zip = interaction.fields.getTextInputValue("wiki-zip");
  if (!/^\d{5}(?:-\d{4})?$/.test(zip.trim())) {
    await interaction.editReply("Enter the same valid ZIP code used for your EFP Wiki account.");
    return;
  }
  const hash = credentialHash(email, zip);
  const agents = await loadAgents();
  const agent = agents.find((entry) => entry.active && normalizeEmail(entry.email) === normalizeEmail(email) && entry.credentialHash === hash);
  if (!agent) {
    await interaction.editReply("That email and ZIP did not match an active EFP Wiki account.");
    return;
  }
  const agentCode = agent.credentialHash.slice(0, 8);
  const result = await mutateState((state) => {
    const claimedBy = Object.entries(state.links).find(([discordId, link]) => discordId !== interaction.user.id && link.agentCode === agentCode);
    if (claimedBy) return "claimed" as const;
    const existing = state.links[interaction.user.id];
    if (existing && existing.agentCode !== agentCode) return "different" as const;
    state.links[interaction.user.id] = { agentCode, agentName: agent.name, linkedAt: new Date().toISOString() };
    return "linked" as const;
  });
  if (result === "claimed") {
    await interaction.editReply("That EFP Wiki account is already connected. Ask an Admin to review the connection.");
    return;
  }
  if (result === "different") {
    await interaction.editReply("Your Discord profile is already connected to another EFP Wiki account. Ask an Admin to unlink it first.");
    return;
  }
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const agentRole = interaction.guild.roles.cache.find((role) => role.name === "Agent");
  if (agentRole && !member.roles.cache.has(agentRole.id)) await member.roles.add(agentRole, "Verified through EFP Wiki credentials");
  await maybeGrantCertification(interaction.guild, agentCode);
  connectAttempts.delete(interaction.user.id);
  const firstLesson = `${WIKI_URL}/?lesson=${lessons[0][1]}#lesson-test`;
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Open Lesson 1").setEmoji("🎓").setURL(firstLesson),
  );
  await interaction.editReply({ content: `Connected successfully as **${agent.name}**. Your email and ZIP were not stored.`, components: [buttons] });
}

export async function showMyProgress(interaction: ChatInputCommandInteraction<"cached"> | ButtonInteraction<"cached">, targetUserId = interaction.user.id) {
  const state = await readState();
  const link = state.links[targetUserId];
  if (!link) {
    await interaction.reply({ content: targetUserId === interaction.user.id ? "Your Discord profile is not connected yet. Run `/connect-wiki`." : "That Discord member is not connected to an EFP Wiki account.", ephemeral: true });
    return;
  }
  await interaction.reply({ content: progressText(link, state.progress[link.agentCode]), ephemeral: true });
}

async function sendCoachingAlert(guild: Guild, agentCode: string, subject: string, score: string, messageUrl: string) {
  const state = await readState();
  const linked = Object.entries(state.links).find(([, link]) => link.agentCode === agentCode);
  const channel = findLogicalChannel(guild, "field-coaching");
  if (!channel || channel.type !== ChannelType.GuildText) return;
  const description = linked
    ? `${linked[1].agentName} (<@${linked[0]}>) needs review before retaking this assessment.`
    : `Unlinked agent code \`${agentCode}\` needs review before retaking this assessment.`;
  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0xd7ae54)
      .setTitle("Training review required")
      .setDescription(description)
      .addFields({ name: "Assessment", value: subject.slice(0, 1024) }, { name: "Score", value: score.slice(0, 1024), inline: true })
      .setTimestamp()],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Open result").setURL(messageUrl))],
    allowedMentions: { parse: [] },
  });
}

async function sendLessonPassMessage(guild: Guild, agentCode: string, lessonNumber: number) {
  const state = await readState();
  const linked = Object.entries(state.links).find(([, link]) => link.agentCode === agentCode);
  if (!linked) return;
  const member = await guild.members.fetch(linked[0]).catch(() => null);
  if (!member) return;
  const next = lessons[lessonNumber];
  const content = next
    ? `✅ Lesson ${lessonNumber} passed. Next up: **Lesson ${next[0]} — ${next[2]}**.`
    : "✅ Lesson 9 passed. Return to the EFP Wiki and complete the final certification assessment.";
  const components = next
    ? [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Open Lesson ${next[0]}`).setURL(`${WIKI_URL}/?lesson=${next[1]}#lesson-test`))]
    : [];
  await member.send({ content, components }).catch(() => undefined);
}

async function maybeGrantCertification(guild: Guild, agentCode: string) {
  const state = await readState();
  const progress = state.progress[agentCode];
  if (!progress || progress.final?.result !== "PASS" || progress.completedLessons < progress.totalLessons) return;
  const linked = Object.entries(state.links).find(([, link]) => link.agentCode === agentCode);
  if (!linked) return;
  const [discordId, link] = linked;
  const member = await guild.members.fetch(discordId).catch(() => null);
  const certifiedRole = guild.roles.cache.find((role) => role.name === "EFP Certified");
  if (!member || !certifiedRole) return;
  if (!member.roles.cache.has(certifiedRole.id)) await member.roles.add(certifiedRole, "Passed all EFP Wiki lessons and final certification");
  let shouldAnnounce = false;
  await mutateState((fresh) => {
    const current = progressFor(fresh, agentCode);
    current.certifiedAt ??= new Date().toISOString();
    if (!current.announcedAt) {
      current.announcedAt = new Date().toISOString();
      shouldAnnounce = true;
    }
  });
  if (!shouldAnnounce) return;
  const wall = findLogicalChannel(guild, "certification-wall");
  if (wall?.type !== ChannelType.GuildText) return;
  await wall.send({
    content: `🎓 Congratulations <@${discordId}>!`,
    embeds: [new EmbedBuilder()
      .setColor(0xe6a817)
      .setTitle("EFP CERTIFIED")
      .setDescription(`**${link.agentName}** completed all nine EFP lessons and passed the final certification assessment.`)
      .addFields({ name: "Achievement", value: "🏆 EFP Certified", inline: true }, { name: "Next step", value: "Keep learning, apply the standard, and support the team.", inline: true })
      .setTimestamp()
      .setFooter({ text: "Show them some love: 🎉 🔥 ⚡" })],
    allowedMentions: { users: [discordId] },
  });
}

function embedFields(message: RawWebhookMessage) {
  const embed = message.embeds?.[0];
  return {
    embed,
    values: new Map((embed?.fields ?? []).map((field) => [field.name, field.value])),
  };
}

async function processCertificationMessage(guild: Guild, channelId: string, message: RawWebhookMessage, notify = true) {
  const { embed, values } = embedFields(message);
  const subject = embed?.title ?? "";
  if (!embed || embed.footer?.text !== "EFP Wiki test result" || /INTEGRATION TEST/i.test(subject)) return false;
  const agentCode = values.get("Agent code")?.trim();
  const score = values.get("Score")?.trim() ?? "Not provided";
  const result = values.get("Result")?.trim() ?? "REVIEW REQUIRED";
  const submittedAt = values.get("Submitted")?.trim() ?? new Date().toISOString();
  const completedRaw = values.get("Completed Lesson Tests")?.trim() ?? "0/9";
  if (!agentCode || !/^[a-z0-9-]{6,20}$/i.test(agentCode)) return false;
  const lessonMatch = subject.match(/EFP Wiki Test\s*[—-]\s*(\d+)\./i);
  const isFinal = /Final Certification/i.test(subject);
  if (!lessonMatch && !isFinal) return false;
  let wasNew = false;
  let lessonNumber: number | null = null;
  await mutateState((state) => {
    if (state.processedMessageIds.includes(message.id)) return;
    state.processedMessageIds.push(message.id);
    state.processedMessageIds = state.processedMessageIds.slice(-1000);
    const progress = progressFor(state, agentCode);
    const completed = completedRaw.match(/^(\d+)\/(\d+)$/);
    if (completed) {
      progress.completedLessons = Number(completed[1]);
      progress.totalLessons = Number(completed[2]);
    }
    const record = { score, result, submittedAt, messageId: message.id };
    if (isFinal) progress.final = record;
    else if (lessonMatch?.[1]) {
      lessonNumber = Number(lessonMatch[1]);
      progress.lessons[String(lessonNumber)] = record;
    }
    wasNew = true;
  });
  if (!wasNew) return true;
  if (result === "PASS") {
    if (notify && lessonNumber) await sendLessonPassMessage(guild, agentCode, lessonNumber);
    await maybeGrantCertification(guild, agentCode);
  } else if (notify) {
    await sendCoachingAlert(guild, agentCode, subject, score, `https://discord.com/channels/${guild.id}/${channelId}/${message.id}`);
  }
  return true;
}

async function getWikiTestWebhookUrl() {
  const configured = process.env.EFP_WIKI_TEST_WEBHOOK_URL?.trim();
  if (configured) return configured;
  const parsed = JSON.parse(await readFile(WEBHOOKS_PATH, "utf8")) as { wikiTest?: { url?: string } };
  const url = parsed.wikiTest?.url?.trim();
  if (!url) throw new Error(`wikiTest webhook URL is missing from ${WEBHOOKS_PATH}`);
  return url;
}

export async function reconcileCertificationFeed(client: Client, notify = true) {
  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  const feed = channels.find((channel) => channel?.type === ChannelType.GuildText && matchesDisplayName(channel.name, "wiki-test-results"));
  if (!feed || feed.type !== ChannelType.GuildText) throw new Error("wiki-test-results channel is not configured");
  const webhookUrl = (await getWikiTestWebhookUrl()).replace(/\/$/, "");
  const messages = await feed.messages.fetch({ limit: 100 });
  const knownMessageIds = new Set((await readState()).processedMessageIds);
  let processed = 0;
  for (const message of [...messages.values()].reverse()) {
    if (!message.webhookId || knownMessageIds.has(message.id)) continue;
    const response = await fetch(`${webhookUrl}/messages/${message.id}`);
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`Unable to read wiki webhook message ${message.id}: HTTP ${response.status}`);
    const raw = await response.json() as RawWebhookMessage;
    if (await processCertificationMessage(guild, feed.id, raw, notify)) processed++;
    else {
      await mutateState((state) => {
        if (!state.processedMessageIds.includes(message.id)) state.processedMessageIds.push(message.id);
        state.processedMessageIds = state.processedMessageIds.slice(-1000);
      });
    }
  }
  return processed;
}

function isOperationsMember(interaction: ChatInputCommandInteraction<"cached">) {
  return interaction.member.roles.cache.some((role) => ["Admin", "Office", "General Manager"].includes(role.name));
}

export async function handleCertificationCommand(interaction: ChatInputCommandInteraction<"cached">, client: Client) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === "status") {
    const target = interaction.options.getUser("agent") ?? interaction.user;
    if (target.id !== interaction.user.id && !isOperationsMember(interaction)) {
      await interaction.reply({ content: "Only Office, General Manager, or Admin can view another agent's status.", ephemeral: true });
      return;
    }
    await showMyProgress(interaction, target.id);
    return;
  }
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: "Administrator permission is required for that certification action.", ephemeral: true });
    return;
  }
  if (subcommand === "unlink") {
    const target = interaction.options.getUser("agent", true);
    const removed = await mutateState((state) => Boolean(state.links[target.id] && delete state.links[target.id]));
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    for (const roleName of ["Agent", "EFP Certified"]) {
      const role = interaction.guild.roles.cache.find((candidate) => candidate.name === roleName);
      if (member && role && member.roles.cache.has(role.id)) await member.roles.remove(role, "Wiki connection removed by administrator");
    }
    await interaction.reply({ content: removed ? `Removed ${target}'s EFP Wiki connection and certification roles.` : `${target} was not connected.`, ephemeral: true });
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  const count = await reconcileCertificationFeed(client);
  await interaction.editReply(`Certification reconciliation complete. Reviewed ${count} recent result messages.`);
}
