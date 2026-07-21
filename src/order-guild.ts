import { ChannelType, Client, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";
import { matchesDisplayName } from "./server-layout.js";

const order = [
  "START HERE",
  "RECRUITING CENTER",
  "EFP TOWN SQUARE",
  "AGENT HUB",
  "TRAINING & CERTIFICATION",
  "SALES FLOOR",
  "TICKETS & LIVE SUPPORT",
  "LEADERSHIP OPERATIONS",
  "OFFICE OPERATIONS",
  "APP DATA FEEDS",
  "TICKET ARCHIVE",
  "ADMIN OPERATIONS",
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
try {
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  const categories = channels.filter((channel) => channel?.type === ChannelType.GuildCategory);
  const unmanagedCount = categories.filter((category) => !order.some((name) => matchesDisplayName(category!.name, name))).size;
  await guild.channels.setPositions(
    order.flatMap((name, index) => {
      const category = categories.find((candidate) => candidate && matchesDisplayName(candidate.name, name));
      return category ? [{ channel: category.id, position: unmanagedCount + index }] : [];
    }),
  );
  console.log(`Category order applied. ADMIN OPERATIONS is last among ${order.length} managed categories.`);
} finally {
  client.destroy();
}
