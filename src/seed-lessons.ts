import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";
import { matchesDisplayName } from "./server-layout.js";

type Lesson = { slug: string; number: number; title: string; duration: string; audio: string; summary: string; narration: string };
type Course = { lessons: Lesson[] };
const WIKI_URL = "https://wiki.energyfreedomproject.site";
const coursePath = process.env.EFP_WIKI_COURSE_PATH || resolve(process.cwd(), "../efp-wiki/src/course.json");
const course = JSON.parse(await readFile(coursePath, "utf8")) as Course;
const channelNames = [
  "lesson-01-foundation", "lesson-02-psychology", "lesson-03-arcadia", "lesson-04-idt", "lesson-05-transitions",
  "lesson-06-lmi-validation", "lesson-07-bill-validation", "lesson-08-field-standards", "lesson-09-rebuttals",
];

function splitCopy(value: string, max = 1850): string[] {
  const paragraphs = value.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length <= max) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }
    if (current) chunks.push(current);
    if (paragraph.length <= max) current = paragraph;
    else {
      for (let index = 0; index < paragraph.length; index += max) chunks.push(paragraph.slice(index, index + max));
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
try {
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  let seeded = 0;
  for (const lesson of course.lessons) {
    const channelName = channelNames[lesson.number - 1];
    if (!channelName) throw new Error(`No Discord channel configured for lesson ${lesson.number}`);
    const channel = channels.find((candidate) => candidate?.type === ChannelType.GuildText && matchesDisplayName(candidate.name, channelName));
    if (!channel || channel.type !== ChannelType.GuildText) throw new Error(`Lesson channel not found: ${channelName}`);
    const marker = `EFP lesson seed • ${lesson.slug}`;
    const recent = await channel.messages.fetch({ limit: 100 });
    const prior = recent.filter((message) => message.author.id === client.user!.id && (
      message.content.startsWith(`**Lesson ${lesson.number} copy`) || message.embeds.some((embed) => embed.footer?.text === marker)
    ));
    for (const message of prior.values()) await message.delete();

    const intro = new EmbedBuilder()
      .setColor(0x18a363)
      .setTitle(`Lesson ${lesson.number}: ${lesson.title}`)
      .setDescription(`${lesson.summary}\n\n**Length:** ${lesson.duration}\n\nRead the complete lesson copy below, listen to the matching track, then open this lesson in the wiki and submit its test.`)
      .setFooter({ text: marker });
    await channel.send({ embeds: [intro] });
    const chunks = splitCopy(lesson.narration);
    for (let index = 0; index < chunks.length; index++) {
      await channel.send(`**Lesson ${lesson.number} copy • ${index + 1}/${chunks.length}**\n${chunks[index]}`);
    }
    const audioUrl = new URL(lesson.audio, WIKI_URL).toString();
    const testUrl = `${WIKI_URL}/?lesson=${encodeURIComponent(lesson.slug)}#lesson-test`;
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Listen to this lesson").setEmoji("🔊").setURL(audioUrl),
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Take this lesson's test").setEmoji("✅").setURL(testUrl),
    );
    const action = await channel.send({ content: `**Lesson ${lesson.number} action**\nListen first. Study the copy. Then complete the matching test.`, components: [buttons] });
    await action.pin("Pin lesson audio and test links");
    seeded++;
  }
  console.log(`Seeded complete copy, audio links, and test links for ${seeded} lessons.`);
} finally {
  client.destroy();
}
