import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
} from "discord.js";
import { config } from "./config.js";
import { matchesDisplayName } from "./server-layout.js";

const WIKI_URL = "https://wiki.energyfreedomproject.site/";
const entries = [
  { channel: "agent-handbook", title: "Agent Handbook", copy: "Use this channel for approved agent guidance and operating announcements. The complete EFP learning library, course progression, and current reference material live in the wiki." },
  { channel: "sales-playbook", title: "Sales Playbook", copy: "Use this channel for current team-wide sales guidance and manager updates. Study the full field process and supporting material in the EFP wiki before asking for coaching here." },
  { channel: "resources-and-links", title: "EFP Resource Library", copy: "This channel highlights approved tools and important links. Use the EFP wiki as the central starting point for training resources and current reference material." },
  { channel: "certification-roadmap", title: "Training and Certification", copy: "Begin certification in the EFP wiki, complete the assigned learning path, and return to Discord for coaching, questions, practice, and manager follow-up." },
  { channel: "field-process-and-reclosing", title: "Field Process", copy: "This channel supports discussion and reinforcement of the EFP field process. Read or listen to the complete training material in the wiki, then use Discord for live team application." },
  { channel: "arcadia-community-solar", title: "Arcadia Community Solar", copy: "Use this channel for current team guidance and approved Arcadia discussion. Refer to the EFP wiki for the complete training module before using the ticket forum for a specific question." },
  { channel: "idt-offer-and-disclosures", title: "IDT Training", copy: "Use this channel for current team guidance and approved IDT discussion. Refer to the EFP wiki for the complete training module before using the ticket forum for a specific question." },
  { channel: "document-validation", title: "Document Validation", copy: "Use the EFP wiki for the full training reference. Discord is for general guidance only—never upload customer documents, account information, identification, or other sensitive records." },
  { channel: "roleplay-and-coaching", title: "Prepare, Practice, Improve", copy: "Review the assigned wiki material before roleplay. Use this channel to schedule practice, receive coaching, and work on the next specific behavior." },
  { channel: "training-questions", title: "Training Questions", copy: "Check the EFP wiki first. If the answer is still unclear, ask one focused question here without including customer or applicant information." },
] as const;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
try {
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  const officeQuestions = channels.find((candidate) => candidate?.type === ChannelType.GuildForum && matchesDisplayName(candidate.name, "office-questions"));
  let created = 0;
  let updated = 0;
  for (const entry of entries) {
    const channel = channels.find((candidate) => candidate?.type === ChannelType.GuildText && matchesDisplayName(candidate.name, entry.channel));
    if (!channel || channel.type !== ChannelType.GuildText) continue;
    const marker = `EFP wiki link • ${entry.channel}`;
    const embed = new EmbedBuilder()
      .setColor(0x18a363)
      .setTitle(entry.title)
      .setDescription(entry.copy)
      .addFields({
        name: "Need wiki access?",
        value: `Check with your General Manager or open an access ticket in ${officeQuestions ?? "the Office Questions forum"}.`,
      })
      .setFooter({ text: marker });
    const components = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Open EFP Wiki").setEmoji("📚").setURL(WIKI_URL),
      ),
    ];
    const messages = await channel.messages.fetch({ limit: 50 });
    const existing = messages.find((message) => message.author.id === client.user!.id && message.embeds.some((item) => item.footer?.text === marker));
    const message = existing
      ? await existing.edit({ embeds: [embed], components })
      : await channel.send({ embeds: [embed], components });
    if (existing) updated++;
    else created++;
    if (!message.pinned) await message.pin("Pin EFP wiki reference");
  }
  console.log(`Wiki link blocks complete: ${created} created, ${updated} updated.`);
} finally {
  client.destroy();
}
