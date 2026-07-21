import { ChannelType, Client, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";
import { matchesDisplayName } from "./server-layout.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

try {
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  const welcome = channels.find((channel) => channel && matchesDisplayName(channel.name, "welcome"));
  const moderatorOnly = channels.find((channel) => channel && matchesDisplayName(channel.name, "moderator-only"));

  if (welcome?.type !== ChannelType.GuildText) throw new Error("Missing text channel: welcome");

  let invites = await guild.invites.fetch();
  let welcomeInvite = invites.find(
    (invite) => invite.channelId === welcome.id && invite.maxAge === 0 && invite.maxUses === 0 && !invite.temporary,
  );

  if (!welcomeInvite) {
    welcomeInvite = await welcome.createInvite({
      maxAge: 0,
      maxUses: 0,
      temporary: false,
      unique: true,
      reason: "Create the permanent EFP public invite in Start Here",
    });
  }

  invites = await guild.invites.fetch();
  const unsafeInvites = moderatorOnly
    ? invites.filter((invite) => invite.channelId === moderatorOnly.id)
    : invites.filter(() => false);
  for (const invite of unsafeInvites.values()) {
    await invite.delete("Do not route new EFP members into moderator-only");
  }

  console.log(`EFP public invite: https://discord.gg/${welcomeInvite.code}`);
  console.log(`Invite opens in: #${welcome.name}`);
  console.log(`Removed ${unsafeInvites.size} invite(s) that opened in #moderator-only.`);
} finally {
  client.destroy();
}
