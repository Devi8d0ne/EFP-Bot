import { ChannelType, Client, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";
import { matchesDisplayName } from "./server-layout.js";

const starters = [
  { channel: "ideas-and-feedback", title: "How to use Ideas & Feedback", body: "Start with the problem, who it affects, the proposed change, expected benefit, and any tradeoff. Search for an existing discussion before opening another." },
  { channel: "recruiting-ideas", title: "How to use Recruiting Ideas", body: "Share campaign, content, referral, and event ideas here. Use approved EFP claims and recruiting links. Never post applicant names, phone numbers, emails, or private application details." },
  { channel: "arcadia-tickets", title: "Read before posting an Arcadia ticket", body: "Choose the closest tag and describe the stage, expected result, actual result, and resource checked. Never upload bills, benefit documents, account numbers, names, addresses, or screenshots with customer data." },
  { channel: "idt-tickets", title: "Read before posting an IDT ticket", body: "Choose the closest tag and identify whether the question concerns offer language, disclosure, TPV, or enrollment. The current active disclosure controls. Never post customer data." },
  { channel: "office-questions", title: "How to use Office Questions", body: "Use this forum for badges, access, paperwork, and general administration. Commission and payroll matters may be sensitive; send personal amounts or private details directly to Office or Admin." },
] as const;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
try {
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  let created = 0;
  for (const starter of starters) {
    const forum = channels.find((channel) => channel?.type === ChannelType.GuildForum && matchesDisplayName(channel.name, starter.channel));
    if (!forum || forum.type !== ChannelType.GuildForum) continue;
    const active = await forum.threads.fetchActive();
    const archived = await forum.threads.fetchArchived({ limit: 100 });
    if ([...active.threads.values(), ...archived.threads.values()].some((thread) => thread.name === starter.title)) continue;
    await forum.threads.create({ name: starter.title, message: { content: starter.body }, reason: "Seed EFP native forum guidance" });
    created++;
  }
  console.log(`Forum guidance complete: ${created} starter posts created.`);
} finally {
  client.destroy();
}
