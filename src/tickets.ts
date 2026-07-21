import { ChannelType, Guild, PermissionFlagsBits, type ChatInputCommandInteraction, type TextChannel } from "discord.js";

const STAFF_ROLES = ["Admin", "Office", "General Manager"];
const TICKET_MARKER = "EFP_OFFICE_TICKET";

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 35) || "agent";
}

export async function openTicket(interaction: ChatInputCommandInteraction<"cached">) {
  const guild = interaction.guild;
  await guild.roles.fetch();
  await guild.channels.fetch();
  const category = guild.channels.cache.find((channel) => channel.type === ChannelType.GuildCategory && channel.name === "TICKETS & LIVE SUPPORT");
  if (!category) throw new Error("Ticket category is not configured. Run setup:guild first.");

  const existing = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildText && channel.topic?.startsWith(`${TICKET_MARKER}|${interaction.user.id}|`),
  );
  if (existing) {
    await interaction.reply({ content: `You already have an open office ticket: ${existing}`, ephemeral: true });
    return;
  }

  const type = interaction.options.getString("type", true);
  const subject = interaction.options.getString("subject", true);
  const details = interaction.options.getString("details", true);
  const permissionOverwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];
  for (const name of STAFF_ROLES) {
    const role = guild.roles.cache.find((candidate) => candidate.name === name);
    if (role) permissionOverwrites.push({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  }

  const channel = await guild.channels.create({
    name: `ticket-${type}-${safeName(interaction.user.username)}`,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `${TICKET_MARKER}|${interaction.user.id}|${type}|${subject}`.slice(0, 1024),
    permissionOverwrites,
    reason: `Private ${type} office ticket opened by ${interaction.user.tag}`,
  });
  await channel.send({
    content: `## ${type.toUpperCase()} — ${subject}\nOpened by ${interaction.user}\n\n${details}\n\nA member of the office team will respond here. Do not post customer account numbers, identity documents, or other unnecessary sensitive information.`,
    allowedMentions: { users: [interaction.user.id] },
  });
  await interaction.reply({ content: `Your private ticket is ready: ${channel}`, ephemeral: true });
}

export async function closeTicket(interaction: ChatInputCommandInteraction<"cached">) {
  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildText || !channel.topic?.startsWith(`${TICKET_MARKER}|`)) {
    await interaction.reply({ content: "Use this command inside an EFP office ticket.", ephemeral: true });
    return;
  }
  const [, ownerId] = channel.topic.split("|");
  if (!ownerId) throw new Error("Ticket owner metadata is missing.");
  const isStaff = interaction.member.roles.cache.some((role) => STAFF_ROLES.includes(role.name));
  if (interaction.user.id !== ownerId && !isStaff) {
    await interaction.reply({ content: "Only the ticket owner or office staff can close this ticket.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  await channel.permissionOverwrites.edit(ownerId, { SendMessages: false });
  const archive = interaction.guild.channels.cache.find((candidate) => candidate.type === ChannelType.GuildCategory && candidate.name === "TICKET ARCHIVE");
  await channel.edit({ name: `closed-${channel.name}`.slice(0, 100), parent: archive?.id, reason: `Ticket closed by ${interaction.user.tag}` });
  await channel.send(`Ticket closed by ${interaction.user}.`);
  await interaction.editReply("Ticket closed and moved to the private archive.");
}
