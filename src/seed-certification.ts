import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder, GatewayIntentBits } from "discord.js";
import { CONNECT_BUTTON_ID, PROGRESS_BUTTON_ID } from "./certification.js";
import { config } from "./config.js";
import { matchesDisplayName } from "./server-layout.js";

const marker = "EFP certification control panel";
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
try {
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  const channel = channels.find((candidate) => candidate?.type === ChannelType.GuildText && matchesDisplayName(candidate.name, "certification-roadmap"));
  if (!channel || channel.type !== ChannelType.GuildText) throw new Error("certification-roadmap channel not found");
  const embed = new EmbedBuilder()
    .setColor(0xe6a817)
    .setTitle("Connect. Learn. Certify.")
    .setDescription("Connect your Discord profile to your EFP Wiki account once. Lesson results will then follow your Discord profile automatically, and passing the final certification grants the gold **EFP Certified** role.")
    .addFields(
      { name: "1 • Connect privately", value: "Enter the same email and ZIP used by the EFP Wiki. Credentials are verified, then immediately discarded." },
      { name: "2 • Complete training", value: "Pass all nine lesson tests and use **My Progress** whenever you want a private status check." },
      { name: "3 • Get certified", value: "Pass the final assessment to receive the role and graduate on the Certification Wall." },
    )
    .setFooter({ text: marker });
  const components = [new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(CONNECT_BUTTON_ID).setStyle(ButtonStyle.Primary).setEmoji("🔗").setLabel("Connect Wiki"),
    new ButtonBuilder().setCustomId(PROGRESS_BUTTON_ID).setStyle(ButtonStyle.Secondary).setEmoji("📊").setLabel("My Progress"),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setEmoji("🎓").setLabel("Open Training").setURL("https://wiki.energyfreedomproject.site/"),
  )];
  const messages = await channel.messages.fetch({ limit: 50 });
  const existing = messages.find((message) => message.author.id === client.user!.id && message.embeds.some((embed) => embed.footer?.text === marker));
  const message = existing ? await existing.edit({ embeds: [embed], components }) : await channel.send({ embeds: [embed], components });
  if (!message.pinned) await message.pin("Pin EFP certification controls");
  console.log(existing ? "Updated certification control panel." : "Created certification control panel.");
} finally {
  client.destroy();
}
