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
type TestResult = {
  score: string;
  result: string;
  submittedAt: string;
  messageId: string;
  subject?: string;
  sourceChannelId?: string;
  coachingAlertedAt?: string;
};
type CoachingAlertRecord = TestResult & { agentCode: string };
type AgentProgress = {
  lessons: Record<string, TestResult>;
  completedLessons: number;
  totalLessons: number;
  final?: TestResult;
  reviewMessageId?: string;
  reviewRequestedAt?: string;
  coachingAssignedAt?: string;
  coachingAssignedBy?: string;
  certifiedAt?: string;
  certifiedBy?: string;
  certificationRevokedAt?: string;
  inactiveAgentRoleFlaggedAt?: string;
  announcedAt?: string;
};
type CertificationState = {
  version: 1;
  links: Record<string, AgentLink>;
  progress: Record<string, AgentProgress>;
  coachingAlerts: Record<string, CoachingAlertRecord>;
  feedBackfillComplete: boolean;
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
const CERTIFICATION_ACTION_PREFIX = "efp:certification";
const OPERATIONS_ROLES = ["Admin", "Office", "General Manager"];
const CONNECT_WINDOW_MS = 15 * 60 * 1000;
const CONNECT_MAX_ATTEMPTS = 5;
const connectAttempts = new Map<string, number[]>();
let stateQueue: Promise<void> = Promise.resolve();
const agentActionQueues = new Map<string, Promise<unknown>>();

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
  [10, "10-workplace-harassment-prevention", "Workplace Sexual Harassment Prevention"],
  [11, "11-substance-free-and-fit-for-duty", "Substance-Free and Fit-for-Duty Standards"],
  [12, "12-sales-tracker-daily-and-weekly-reporting", "Sales Tracker: Daily and Weekly Reporting"],
  [13, "13-document-scanner-and-live-sales-drops", "Document Scanner and Live Sales Drops"],
] as const;

function emptyState(): CertificationState {
  return { version: 1, links: {}, progress: {}, coachingAlerts: {}, feedBackfillComplete: false, processedMessageIds: [] };
}

async function readState(): Promise<CertificationState> {
  try {
    const parsed = JSON.parse(await readFile(DATA_PATH, "utf8")) as Partial<CertificationState>;
    return {
      version: 1,
      links: parsed.links ?? {},
      progress: parsed.progress ?? {},
      coachingAlerts: parsed.coachingAlerts ?? {},
      feedBackfillComplete: parsed.feedBackfillComplete ?? false,
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

async function findActiveAgentByCode(agentCode: string) {
  const normalizedCode = agentCode.trim().toLowerCase();
  const agents = await loadAgents();
  return agents.find((agent) => agent.active && agent.credentialHash.slice(0, 8).toLowerCase() === normalizedCode);
}

async function withAgentAction<T>(agentCode: string, action: () => Promise<T>): Promise<T> {
  const previous = agentActionQueues.get(agentCode) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(action);
  agentActionQueues.set(agentCode, current);
  try {
    return await current;
  } finally {
    if (agentActionQueues.get(agentCode) === current) agentActionQueues.delete(agentCode);
  }
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
  const progress = state.progress[agentCode] ??= { lessons: {}, completedLessons: 0, totalLessons: lessons.length };
  progress.totalLessons = lessons.length;
  return progress;
}

function isCertificationEligible(progress?: AgentProgress) {
  return Boolean(
    progress?.final?.result === "PASS"
    && lessons.every(([number]) => progress.lessons[String(number)]?.result === "PASS"),
  );
}

function isCertificationApproved(progress?: AgentProgress) {
  return Boolean(progress?.certifiedAt && !progress.certificationRevokedAt);
}

function reviewMarker(agentCode: string, progress: AgentProgress) {
  const cycle = progress.certificationRevokedAt ?? progress.final?.messageId ?? "pending";
  return `EFP Certification Review • Agent ${agentCode} • ${cycle}`;
}

function graduationMarker(agentCode: string, certifiedAt: string) {
  return `EFP Graduation • Agent ${agentCode} • ${certifiedAt}`;
}

function hasEmbedFooterMarker(message: { embeds: Array<{ footer?: { text: string } | null }> }, marker: string) {
  return message.embeds.some((embed) => embed.footer?.text === marker);
}

function isDiscordErrorCode(error: unknown, code: number) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === code);
}

function isUnknownMessageError(error: unknown) {
  return isDiscordErrorCode(error, 10008);
}

function progressText(link: AgentLink, progress?: AgentProgress) {
  const passed = progress ? Object.values(progress.lessons).filter((result) => result.result === "PASS").length : 0;
  const reported = progress?.completedLessons ?? 0;
  const lessonLines = lessons.map(([number, , title]) => `${progress?.lessons[String(number)]?.result === "PASS" ? "✅" : "▫️"} ${number}. ${title}`);
  const finalStatus = progress?.final?.result === "PASS" ? "✅ Passed" : progress?.final ? `⚠️ ${progress.final.result}` : "▫️ Not submitted";
  const managerStatus = progress?.certificationRevokedAt
    ? "⛔ Certification removed — contact an EFP manager"
    : isCertificationApproved(progress)
      ? "✅ Approved"
      : progress?.coachingAssignedAt
        ? "🧭 Coaching assigned"
        : progress?.reviewMessageId
          ? "⏳ Pending manager approval"
          : isCertificationEligible(progress)
            ? "⏳ Ready for manager review"
            : "▫️ Not yet eligible";
  return `**${link.agentName}**\nAgent code: \`${link.agentCode}\`\nLesson progress reported by wiki: **${reported}/${lessons.length}**\nTracked passing results: **${passed}/${lessons.length}**\n\n${lessonLines.join("\n")}\n\n**Final certification:** ${finalStatus}\n**Manager review:** ${managerStatus}\n**Certified role:** ${isCertificationApproved(progress) ? "✅ Granted" : "▫️ Not granted"}`;
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

export async function handleConnectWikiModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guildId) {
    await interaction.reply({ content: "Wiki connections can only be completed inside the EFP Discord server.", ephemeral: true });
    return;
  }
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
  const result = await withAgentAction(agentCode, () => mutateState((state) => {
    const claimedBy = Object.entries(state.links).find(([discordId, link]) => discordId !== interaction.user.id && link.agentCode === agentCode);
    if (claimedBy) return "claimed" as const;
    const existing = state.links[interaction.user.id];
    if (existing && existing.agentCode !== agentCode) return "different" as const;
    state.links[interaction.user.id] = { agentCode, agentName: agent.name, linkedAt: new Date().toISOString() };
    return "linked" as const;
  }));
  if (result === "claimed") {
    await interaction.editReply("That EFP Wiki account is already connected. Ask an Admin to review the connection.");
    return;
  }
  if (result === "different") {
    await interaction.editReply("Your Discord profile is already connected to another EFP Wiki account. Ask an Admin to unlink it first.");
    return;
  }
  const guild = interaction.guild ?? await interaction.client.guilds.fetch(interaction.guildId);
  await maybeRequestCertificationReview(guild, agentCode);
  connectAttempts.delete(interaction.user.id);
  const firstLesson = `${WIKI_URL}/?lesson=${lessons[0][1]}#lesson-test`;
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Open Lesson 1").setEmoji("🎓").setURL(firstLesson),
  );
  await interaction.editReply({ content: `Connected successfully as **${agent.name}**. Your email and ZIP were not stored. This connection tracks Wiki progress only; EFP management assigns server access roles.`, components: [buttons] });
}

export async function showMyProgress(interaction: ChatInputCommandInteraction | ButtonInteraction, targetUserId = interaction.user.id) {
  const state = await readState();
  const link = state.links[targetUserId];
  if (!link) {
    await interaction.reply({ content: targetUserId === interaction.user.id ? "Your Discord profile is not connected yet. Run `/connect-wiki`." : "That Discord member is not connected to an EFP Wiki account.", ephemeral: true });
    return;
  }
  await interaction.reply({ content: progressText(link, state.progress[link.agentCode]), ephemeral: true });
}

async function sendCoachingAlert(guild: Guild, agentCode: string, record: TestResult) {
  const state = await readState();
  const linked = Object.entries(state.links).find(([, link]) => link.agentCode === agentCode);
  const channel = findLogicalChannel(guild, "field-coaching");
  if (!channel || channel.type !== ChannelType.GuildText) throw new Error("field-coaching channel is not configured");
  const marker = `EFP Coaching Alert • Result ${record.messageId}`;
  const recent = await channel.messages.fetch({ limit: 100 });
  if (recent.some((message) => hasEmbedFooterMarker(message, marker))) return;
  const description = linked
    ? `${linked[1].agentName} (<@${linked[0]}>) needs review before retaking this assessment.`
    : `Unlinked agent code \`${agentCode}\` needs review before retaking this assessment.`;
  const sourceChannelId = record.sourceChannelId;
  if (!sourceChannelId) throw new Error(`Result ${record.messageId} is missing its source channel`);
  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0xd7ae54)
      .setTitle("Training review required")
      .setDescription(description)
      .addFields({ name: "Assessment", value: (record.subject ?? "EFP Wiki assessment").slice(0, 1024) }, { name: "Score", value: record.score.slice(0, 1024), inline: true })
      .setTimestamp()
      .setFooter({ text: marker })],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Open result").setURL(`https://discord.com/channels/${guild.id}/${sourceChannelId}/${record.messageId}`))],
    allowedMentions: { parse: [] },
  });
}

function progressResults(progress: AgentProgress) {
  return [...Object.values(progress.lessons), ...(progress.final ? [progress.final] : [])];
}

async function deliverPendingCoachingAlert(guild: Guild, agentCode: string, record: TestResult) {
  await sendCoachingAlert(guild, agentCode, record);
  await mutateState((fresh) => {
    const queued = fresh.coachingAlerts[record.messageId];
    if (queued && queued.result !== "PASS" && !queued.coachingAlertedAt) queued.coachingAlertedAt = new Date().toISOString();
    const current = progressFor(fresh, agentCode);
    const stored = progressResults(current).find((candidate) => candidate.messageId === record.messageId);
    if (stored && stored.result !== "PASS" && !stored.coachingAlertedAt) stored.coachingAlertedAt = new Date().toISOString();
  });
}

async function retryPendingCoachingAlerts(guild: Guild, fallbackSourceChannelId: string, activeCodes: Set<string>) {
  const state = await readState();
  const queuedMessageIds = new Set(Object.keys(state.coachingAlerts));
  for (const record of Object.values(state.coachingAlerts)) {
    if (!activeCodes.has(record.agentCode.toLowerCase()) || record.result === "PASS" || record.coachingAlertedAt) continue;
    await deliverPendingCoachingAlert(guild, record.agentCode, { ...record, sourceChannelId: record.sourceChannelId ?? fallbackSourceChannelId });
  }
  for (const [agentCode, progress] of Object.entries(state.progress)) {
    if (!activeCodes.has(agentCode.toLowerCase())) continue;
    for (const record of progressResults(progress)) {
      if (record.result === "PASS" || record.coachingAlertedAt || queuedMessageIds.has(record.messageId)) continue;
      await deliverPendingCoachingAlert(guild, agentCode, { ...record, sourceChannelId: record.sourceChannelId ?? fallbackSourceChannelId });
    }
  }
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
    : `✅ Lesson ${lessons.length} passed. Return to the EFP Wiki and complete the final certification assessment.`;
  const components = next
    ? [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Open Lesson ${next[0]}`).setURL(`${WIKI_URL}/?lesson=${next[1]}#lesson-test`))]
    : [];
  await member.send({ content, components }).catch(() => undefined);
}

function certificationActionRow(agentCode: string, disabled = false) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CERTIFICATION_ACTION_PREFIX}:approve:${agentCode}`)
      .setStyle(ButtonStyle.Success)
      .setLabel("Approve Certification")
      .setEmoji("🎓")
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`${CERTIFICATION_ACTION_PREFIX}:coach:${agentCode}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Assign Coaching")
      .setEmoji("🧭")
      .setDisabled(disabled),
  );
}

export function isCertificationActionButton(customId: string) {
  return new RegExp(`^${CERTIFICATION_ACTION_PREFIX}:(?:approve|coach):[a-z0-9-]{6,20}$`, "i").test(customId);
}

async function maybeRequestCertificationReview(guild: Guild, agentCode: string) {
  return withAgentAction(agentCode, async () => {
    const activeAgent = await findActiveAgentByCode(agentCode);
    if (!activeAgent) return false;
    let state = await readState();
    let progress = state.progress[agentCode];
    if (!progress || !isCertificationEligible(progress) || isCertificationApproved(progress)) return false;
    const linked = Object.entries(state.links).find(([, link]) => link.agentCode === agentCode);
    if (!linked) return false;
    const [discordId, link] = linked;
    const member = await guild.members.fetch(discordId).catch((error: unknown) => {
      if (isDiscordErrorCode(error, 10007)) return null;
      throw error;
    });
    if (!member) return false;
    const reviewChannel = findLogicalChannel(guild, "certification-review");
    if (!reviewChannel || reviewChannel.type !== ChannelType.GuildText) return false;

    if (progress.reviewMessageId) {
      let existing = null;
      try {
        existing = await reviewChannel.messages.fetch(progress.reviewMessageId);
      } catch (error) {
        if (!isUnknownMessageError(error)) throw error;
      }
      if (existing) return false;
      await mutateState((fresh) => {
        const current = progressFor(fresh, agentCode);
        if (current.reviewMessageId === progress?.reviewMessageId) {
          delete current.reviewMessageId;
          delete current.reviewRequestedAt;
        }
      });
      state = await readState();
      progress = state.progress[agentCode];
      if (!progress || !isCertificationEligible(progress) || isCertificationApproved(progress)) return false;
    }

    const marker = reviewMarker(agentCode, progress);
    const recentReviewMessages = await reviewChannel.messages.fetch({ limit: 100 });
    const adoptableReview = recentReviewMessages.find((message) => hasEmbedFooterMarker(message, marker));
    if (adoptableReview) {
      await mutateState((fresh) => {
        const current = progressFor(fresh, agentCode);
        if (!isCertificationEligible(current) || isCertificationApproved(current)) return;
        current.reviewMessageId = adoptableReview.id;
        current.reviewRequestedAt ??= adoptableReview.createdAt.toISOString();
      });
      return false;
    }

    const resultChannel = findLogicalChannel(guild, "wiki-test-results");
    const finalResultUrl = resultChannel && progress?.final?.messageId
      ? `https://discord.com/channels/${guild.id}/${resultChannel.id}/${progress.final.messageId}`
      : undefined;
    const components = [certificationActionRow(agentCode)];
    if (finalResultUrl) {
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Open Final Result").setURL(finalResultUrl),
      ));
    }
    const reviewMessage = await reviewChannel.send({
      content: `Certification review ready for <@${discordId}>.`,
      embeds: [new EmbedBuilder()
        .setColor(0x4e8cff)
        .setTitle("Manager certification approval")
        .setDescription(`The Wiki reports that **${activeAgent.name}** has ${lessons.length} lesson passes and a passing final assessment. These submitted results make the agent eligible for review; they do not independently verify field readiness.`)
        .addFields(
          { name: "Wiki identity", value: `${link.agentName}\nAgent code: \`${agentCode}\``, inline: true },
          { name: "Wiki-reported results", value: "✅ Lessons 1–9 reported PASS\n✅ Final reported PASS", inline: true },
          { name: "Manager field-readiness check", value: "Independently confirm the agent can apply the EFP standard in the field. Then approve certification or assign coaching." },
        )
        .setTimestamp()
        .setFooter({ text: marker })],
      components,
      allowedMentions: { parse: [] },
    });
    await mutateState((fresh) => {
      const current = progressFor(fresh, agentCode);
      if (!isCertificationEligible(current) || isCertificationApproved(current)) return;
      current.reviewMessageId = reviewMessage.id;
      current.reviewRequestedAt = new Date().toISOString();
    });
    return true;
  });
}

async function sendGraduationAnnouncement(guild: Guild, agentCode: string) {
  const state = await readState();
  const progress = state.progress[agentCode];
  if (!progress?.certifiedAt || progress.certificationRevokedAt || progress.announcedAt) return Boolean(progress?.announcedAt);
  const activeAgent = await findActiveAgentByCode(agentCode);
  if (!activeAgent) return false;
  const linked = Object.entries(state.links).find(([, link]) => link.agentCode === agentCode);
  if (!linked) throw new Error(`Agent ${agentCode} no longer has a Discord connection`);
  const [discordId] = linked;
  const wall = findLogicalChannel(guild, "certification-wall");
  if (!wall || wall.type !== ChannelType.GuildText) throw new Error("certification-wall channel is not configured");
  const marker = graduationMarker(agentCode, progress.certifiedAt);
  const recentWallMessages = await wall.messages.fetch({ limit: 100 });
  const adoptableAnnouncement = recentWallMessages.find((message) => hasEmbedFooterMarker(message, marker));
  if (adoptableAnnouncement) {
    await mutateState((fresh) => {
      const current = progressFor(fresh, agentCode);
      if (isCertificationApproved(current) && !current.announcedAt) current.announcedAt = adoptableAnnouncement.createdAt.toISOString();
    });
    return true;
  }
  await wall.send({
    content: `🎓 Congratulations <@${discordId}>!`,
    embeds: [new EmbedBuilder()
      .setColor(0xe6a817)
      .setTitle("EFP CERTIFIED")
      .setDescription(`**${activeAgent.name}** completed all ${lessons.length} EFP lessons, passed the final certification assessment, and received manager approval.`)
      .addFields({ name: "Achievement", value: "🏆 EFP Certified", inline: true }, { name: "Next step", value: "Keep learning, apply the standard, and support the team.", inline: true })
      .setTimestamp()
      .setFooter({ text: marker })],
    allowedMentions: { users: [discordId] },
  });
  await mutateState((fresh) => {
    const current = progressFor(fresh, agentCode);
    if (isCertificationApproved(current) && !current.announcedAt) current.announcedAt = new Date().toISOString();
  });
  return true;
}

function isOperationsButtonMember(interaction: ButtonInteraction<"cached">) {
  return interaction.member.roles.cache.some((role) => OPERATIONS_ROLES.includes(role.name));
}

export async function handleCertificationActionButton(interaction: ButtonInteraction<"cached">) {
  const match = interaction.customId.match(/^efp:certification:(approve|coach):([a-z0-9-]{6,20})$/i);
  if (!match) return;
  const actionValue = match[1];
  const agentCodeValue = match[2];
  if (!actionValue || !agentCodeValue) return;
  if (!isOperationsButtonMember(interaction)) {
    await interaction.reply({ content: "Only Office, General Manager, or Admin can make a certification decision.", ephemeral: true });
    return;
  }
  const action = actionValue.toLowerCase();
  const agentCode = agentCodeValue.toLowerCase();
  await interaction.deferReply({ ephemeral: true });
  await withAgentAction(agentCode, async () => {
    const activeAgent = await findActiveAgentByCode(agentCode);
    if (!activeAgent) throw new Error(`Agent ${agentCode} is no longer active in the EFP Wiki registry`);
    const state = await readState();
    const progress = state.progress[agentCode];
    const linked = Object.entries(state.links).find(([, link]) => link.agentCode === agentCode);
    if (!linked) throw new Error(`Agent ${agentCode} does not have a connected Discord profile`);
    const [discordId] = linked;
    if (progress?.reviewMessageId !== interaction.message.id) {
      await interaction.editReply("This certification request is no longer current. Use the newest card in certification-review.");
      return;
    }

    if (action === "coach") {
      if (progress?.coachingAssignedAt) {
        await interaction.editReply(`Coaching was already assigned to **${activeAgent.name}**.`);
        return;
      }
      const coachingChannel = findLogicalChannel(interaction.guild, "field-coaching");
      if (!coachingChannel || coachingChannel.type !== ChannelType.GuildText) throw new Error("field-coaching channel is not configured");
      await coachingChannel.send({
        content: `🧭 Certification coaching assigned for <@${discordId}> by <@${interaction.user.id}>.`,
        embeds: [new EmbedBuilder()
          .setColor(0xd7ae54)
          .setTitle("Certification coaching assignment")
          .setDescription(`**${activeAgent.name}** completed the assessments but needs a manager coaching check before certification approval.`)
          .addFields({ name: "Agent code", value: `\`${agentCode}\``, inline: true }, { name: "Review", value: `[Open approval request](${interaction.message.url})`, inline: true })
          .setTimestamp()],
        allowedMentions: { users: [discordId, interaction.user.id] },
      });
      const member = await interaction.guild.members.fetch(discordId).catch(() => null);
      await member?.send("Your EFP certification is in coaching review. A manager will follow up with you before final approval.").catch(() => undefined);
      await mutateState((fresh) => {
        const current = progressFor(fresh, agentCode);
        current.coachingAssignedAt = new Date().toISOString();
        current.coachingAssignedBy = interaction.user.id;
      });
      await interaction.editReply(`Coaching assigned to **${activeAgent.name}** in the field-coaching channel.`);
      return;
    }

    if (!isCertificationEligible(progress)) {
      await interaction.editReply(`**${activeAgent.name}** is not currently eligible. All ${lessons.length} distinct lesson tests and the final assessment must show PASS.`);
      return;
    }
    const member = await interaction.guild.members.fetch(discordId).catch(() => null);
    const certifiedRole = interaction.guild.roles.cache.find((role) => role.name === "EFP Certified");
    if (!member) throw new Error(`The connected Discord member for ${activeAgent.name} is not in this server`);
    if (!certifiedRole) throw new Error("EFP Certified role is not configured");
    if (!member.roles.cache.has(certifiedRole.id)) {
      await member.roles.add(certifiedRole, `Certification approved by ${interaction.user.tag}`);
    }
    await mutateState((fresh) => {
      const current = progressFor(fresh, agentCode);
      if (!isCertificationApproved(current)) {
        current.certifiedAt = new Date().toISOString();
        current.certifiedBy = interaction.user.id;
        delete current.certificationRevokedAt;
        delete current.announcedAt;
      }
    });
    await sendGraduationAnnouncement(interaction.guild, agentCode);
    await interaction.message.edit({ components: [certificationActionRow(agentCode, true)] });
    await interaction.editReply(`Certification approved for **${activeAgent.name}**. The EFP Certified role is live and the graduation wall has been updated.`);
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
  const footer = embed?.footer?.text?.trim() ?? "";
  if (!embed || !/^EFP Wiki (?:test )?result\b/i.test(footer) || /INTEGRATION TEST/i.test(subject)) return false;
  const agentCode = values.get("Agent code")?.trim().toLowerCase();
  const score = values.get("Score")?.trim() ?? "Not provided";
  const result = values.get("Result")?.trim().toUpperCase() ?? "REVIEW REQUIRED";
  const submittedAt = values.get("Submitted")?.trim() ?? new Date().toISOString();
  const completedRaw = values.get("Completed Lesson Tests")?.trim() ?? `0/${lessons.length}`;
  if (!agentCode || !/^[a-z0-9-]{6,20}$/i.test(agentCode)) return false;
  const lessonMatch = subject.match(/EFP Wiki Test\s*[—-]\s*(\d+)\./i);
  const isFinal = /Final Certification/i.test(subject);
  if (!lessonMatch && !isFinal) return false;
  const parsedLessonNumber = lessonMatch?.[1] ? Number(lessonMatch[1]) : null;
  if (parsedLessonNumber !== null && (parsedLessonNumber < 1 || parsedLessonNumber > lessons.length)) return false;
  if (!await findActiveAgentByCode(agentCode)) return false;
  let wasNew = false;
  let lessonNumber: number | null = null;
  await mutateState((state) => {
    if (state.processedMessageIds.includes(message.id)) return;
    state.processedMessageIds.push(message.id);
    state.processedMessageIds = state.processedMessageIds.slice(-1000);
    const progress = progressFor(state, agentCode);
    const completed = completedRaw.match(/^(\d+)\/(\d+)$/);
    if (completed && Number(completed[2]) === lessons.length) {
      progress.completedLessons = Number(completed[1]);
      progress.totalLessons = lessons.length;
    }
    const record: TestResult = { score, result, submittedAt, messageId: message.id, subject, sourceChannelId: channelId };
    if (isFinal) progress.final = record;
    else if (parsedLessonNumber !== null) {
      lessonNumber = parsedLessonNumber;
      progress.lessons[String(lessonNumber)] = record;
    }
    if (result !== "PASS") {
      state.coachingAlerts[message.id] = { ...record, agentCode };
      const alerts = Object.values(state.coachingAlerts).sort((left, right) => left.submittedAt.localeCompare(right.submittedAt));
      for (const stale of alerts.slice(0, Math.max(0, alerts.length - 1000))) delete state.coachingAlerts[stale.messageId];
    }
    wasNew = true;
  });
  if (!wasNew) return true;
  if (result === "PASS") {
    if (notify && lessonNumber) await sendLessonPassMessage(guild, agentCode, lessonNumber);
    await maybeRequestCertificationReview(guild, agentCode);
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

async function flagInactiveAgentRole(guild: Guild, discordId: string, agentCode: string, agentName: string) {
  const marker = `EFP Inactive Agent Role Review • ${discordId} • ${agentCode}`;
  const reviewChannel = findLogicalChannel(guild, "certification-review");
  if (reviewChannel?.type === ChannelType.GuildText) {
    const recent = await reviewChannel.messages.fetch({ limit: 100 });
    if (!recent.some((message) => hasEmbedFooterMarker(message, marker))) {
      await reviewChannel.send({
        content: `⚠️ Manual access review needed for <@${discordId}>.`,
        embeds: [new EmbedBuilder()
          .setColor(0xd7ae54)
          .setTitle("Inactive Wiki account still has Agent access")
          .setDescription(`**${agentName}** is no longer active in the Wiki registry, but still has the manually managed Agent role. The bot did not remove that role.`)
          .addFields({ name: "Agent code", value: `\`${agentCode}\``, inline: true }, { name: "Required action", value: "An Admin, Office, or General Manager should review access manually." })
          .setTimestamp()
          .setFooter({ text: marker })],
        allowedMentions: { parse: [] },
      });
    }
  }
  console.warn(`Inactive Wiki link ${agentCode} (${discordId}) still has the manually managed Agent role; admin review required.`);
}

async function reconcileInactiveLinkedAgents(guild: Guild) {
  const agents = await loadAgents();
  const activeCodes = new Set(agents.filter((agent) => agent.active).map((agent) => agent.credentialHash.slice(0, 8).toLowerCase()));
  const snapshot = await readState();
  const certifiedRole = guild.roles.cache.find((role) => role.name === "EFP Certified");
  const agentRole = guild.roles.cache.find((role) => role.name === "Agent");
  for (const [discordId, snapshotLink] of Object.entries(snapshot.links)) {
    await withAgentAction(snapshotLink.agentCode, async () => {
      const latest = await readState();
      const link = latest.links[discordId];
      if (!link || link.agentCode !== snapshotLink.agentCode) return;
      const progress = latest.progress[link.agentCode];
      if (activeCodes.has(link.agentCode.toLowerCase())) {
        if (progress?.inactiveAgentRoleFlaggedAt) {
          await mutateState((fresh) => {
            const currentLink = fresh.links[discordId];
            if (!currentLink || currentLink.agentCode !== link.agentCode) return;
            const current = fresh.progress[link.agentCode];
            if (current) delete current.inactiveAgentRoleFlaggedAt;
          });
        }
        return;
      }

      const member = await guild.members.fetch(discordId).catch((error: unknown) => {
        if (isDiscordErrorCode(error, 10007)) return null;
        throw error;
      });
      const hadCertifiedRole = Boolean(member && certifiedRole && member.roles.cache.has(certifiedRole.id));
      if (member && certifiedRole && hadCertifiedRole) {
        await member.roles.remove(certifiedRole, "Connected EFP Wiki account is no longer active");
      }
      const hasManualAgentRole = Boolean(member && agentRole && member.roles.cache.has(agentRole.id));
      let flaggedAt = progress?.inactiveAgentRoleFlaggedAt;
      if (hasManualAgentRole && !flaggedAt) {
        await flagInactiveAgentRole(guild, discordId, link.agentCode, link.agentName);
        flaggedAt = new Date().toISOString();
      }
      await mutateState((fresh) => {
        const currentLink = fresh.links[discordId];
        if (!currentLink || currentLink.agentCode !== link.agentCode) return;
        const current = progressFor(fresh, link.agentCode);
        if ((hadCertifiedRole || current.certifiedAt) && !current.certificationRevokedAt) {
          current.certificationRevokedAt = new Date().toISOString();
          delete current.reviewMessageId;
          delete current.reviewRequestedAt;
          delete current.coachingAssignedAt;
          delete current.coachingAssignedBy;
        }
        if (flaggedAt) current.inactiveAgentRoleFlaggedAt = flaggedAt;
      });
    });
  }
  return activeCodes;
}

export async function reconcileCertificationFeed(client: Client, notify = true) {
  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  const feed = channels.find((channel) => channel?.type === ChannelType.GuildText && matchesDisplayName(channel.name, "wiki-test-results"));
  if (!feed || feed.type !== ChannelType.GuildText) throw new Error("wiki-test-results channel is not configured");
  const activeCodes = await reconcileInactiveLinkedAgents(guild);
  const webhookUrl = (await getWikiTestWebhookUrl()).replace(/\/$/, "");
  const feedState = await readState();
  const knownMessageIds = new Set(feedState.processedMessageIds);
  const fullBackfill = !feedState.feedBackfillComplete;
  const pendingMessages: Array<{ id: string; webhookId: string }> = [];
  let before: string | undefined;
  let reachedKnownBoundary = false;
  do {
    const page = await feed.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (page.size === 0) break;
    const newestToOldest = [...page.values()].sort((left, right) => right.createdTimestamp - left.createdTimestamp);
    for (const message of newestToOldest) {
      if (knownMessageIds.has(message.id)) {
        if (fullBackfill) continue;
        reachedKnownBoundary = true;
        break;
      }
      if (message.webhookId) pendingMessages.push({ id: message.id, webhookId: message.webhookId });
    }
    if (reachedKnownBoundary || page.size < 100) break;
    before = newestToOldest.at(-1)?.id;
  } while (before);

  const markProcessed = async (messageId: string) => {
    await mutateState((state) => {
      if (!state.processedMessageIds.includes(messageId)) state.processedMessageIds.push(messageId);
      state.processedMessageIds = state.processedMessageIds.slice(-1000);
    });
    knownMessageIds.add(messageId);
  };
  let processed = 0;
  for (const message of pendingMessages.reverse()) {
    const response = await fetch(`${webhookUrl}/messages/${message.id}`);
    if (response.status === 404) {
      await markProcessed(message.id);
      continue;
    }
    if (!response.ok) throw new Error(`Unable to read wiki webhook message ${message.id}: HTTP ${response.status}`);
    const raw = await response.json() as RawWebhookMessage;
    if (await processCertificationMessage(guild, feed.id, raw, notify)) processed++;
    else await markProcessed(message.id);
  }
  if (fullBackfill) {
    await mutateState((state) => {
      state.feedBackfillComplete = true;
    });
  }
  if (notify) await retryPendingCoachingAlerts(guild, feed.id, activeCodes);
  const state = await readState();
  for (const [agentCode, progress] of Object.entries(state.progress)) {
    if (!activeCodes.has(agentCode.toLowerCase())) continue;
    if (isCertificationApproved(progress) && !progress.announcedAt) {
      await withAgentAction(agentCode, () => sendGraduationAnnouncement(guild, agentCode));
    } else if (isCertificationEligible(progress) && !isCertificationApproved(progress)) {
      await maybeRequestCertificationReview(guild, agentCode);
    }
  }
  return processed;
}

function isOperationsMember(interaction: ChatInputCommandInteraction<"cached">) {
  return interaction.member.roles.cache.some((role) => OPERATIONS_ROLES.includes(role.name));
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
    const state = await readState();
    const link = state.links[target.id];
    if (!link) {
      await interaction.reply({ content: `${target} was not connected. No roles were changed.`, ephemeral: true });
      return;
    }
    const removed = await withAgentAction(link.agentCode, async () => {
      const latest = await readState();
      const currentLink = latest.links[target.id];
      if (!currentLink || currentLink.agentCode !== link.agentCode) return false;
      const member = await interaction.guild.members.fetch(target.id).catch((error: unknown) => {
        if (isDiscordErrorCode(error, 10007)) return null;
        throw error;
      });
      const certifiedRole = interaction.guild.roles.cache.find((candidate) => candidate.name === "EFP Certified");
      if (member && certifiedRole && member.roles.cache.has(certifiedRole.id)) {
        await member.roles.remove(certifiedRole, "Wiki connection removed by administrator");
      }
      return mutateState((fresh) => {
        const freshLink = fresh.links[target.id];
        if (!freshLink || freshLink.agentCode !== link.agentCode) return false;
        delete fresh.links[target.id];
        const progress = fresh.progress[link.agentCode];
        if (progress) {
          if (progress.certifiedAt) progress.certificationRevokedAt = new Date().toISOString();
          delete progress.reviewMessageId;
          delete progress.reviewRequestedAt;
          delete progress.coachingAssignedAt;
          delete progress.coachingAssignedBy;
        }
        return true;
      });
    });
    if (!removed) {
      await interaction.reply({ content: `${target}'s connection changed before unlink completed. No roles were changed by this request.`, ephemeral: true });
      return;
    }
    await interaction.reply({ content: `Removed ${target}'s EFP Wiki connection and EFP Certified role. Manually assigned Agent access was not changed.`, ephemeral: true });
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  const count = await reconcileCertificationFeed(client);
  await interaction.editReply(`Certification reconciliation complete. Reviewed ${count} recent result messages.`);
}
