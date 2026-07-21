import { resolve } from "node:path";
import { AttachmentBuilder, ChannelType, Client, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";
import { matchesDisplayName } from "./server-layout.js";

const audioRoot = resolve("..", "efp-wiki", "public", "training", "mp3");
const tracks = [
  { channel: "field-process-and-reclosing", file: "01-foundation-and-process.mp3", title: "Lesson 1 — Foundation and the Field Process" },
  { channel: "field-process-and-reclosing", file: "02-psychology-and-reclosing.mp3", title: "Lesson 2 — Psychology, Trust, and Reclosing" },
  { channel: "arcadia-community-solar", file: "03-arcadia-community-solar.mp3", title: "Lesson 3 — Arcadia Community Solar" },
  { channel: "idt-offer-and-disclosures", file: "04-idt-offer-and-disclosures.mp3", title: "Lesson 4 — IDT Offer and Disclosure Discipline" },
  { channel: "field-process-and-reclosing", file: "05-transitions-contentions-and-referrals.mp3", title: "Lesson 5 — Transitions, Late Contentions, and Referrals" },
  { channel: "document-validation", file: "06-lmi-document-validation.mp3", title: "Lesson 6 — LMI Document Validation" },
  { channel: "document-validation", file: "07-utility-bill-validation.mp3", title: "Lesson 7 — Utility Bill Validation" },
  { channel: "certification-roadmap", file: "08-field-standards-and-certification.mp3", title: "Lesson 8 — Field Standards and Certification" },
  { channel: "field-process-and-reclosing", file: "09-rebuttal-frameworks-and-reclosing.mp3", title: "Lesson 9 — Rebuttal Frameworks and Reclosing" },
] as const;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
try {
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  let uploaded = 0;
  for (const track of tracks) {
    const channel = channels.find((candidate) => candidate?.type === ChannelType.GuildText && matchesDisplayName(candidate.name, track.channel));
    if (!channel || channel.type !== ChannelType.GuildText) continue;
    const recent = await channel.messages.fetch({ limit: 100 });
    if (recent.some((message) => message.content.includes(track.title) && message.attachments.some((attachment) => attachment.name === track.file))) continue;
    await channel.send({
      content: `## 🎧 ${track.title}\nListen, return to the written reference above, then use the training questions or coaching channel to work through anything unclear.`,
      files: [new AttachmentBuilder(resolve(audioRoot, track.file), { name: track.file, description: track.title })],
    });
    uploaded++;
  }
  console.log(`Training audio complete: ${uploaded} MP3 tracks uploaded.`);
} finally {
  client.destroy();
}
