import {
  ChannelType,
  Guild,
  PermissionFlagsBits,
  type CategoryChannel,
  type GuildBasedChannel,
} from "discord.js";
import { displayCategoryName, displayChannelName, matchesDisplayName, serverLayout, type ChannelDefinition } from "./server-layout.js";

export type SetupSummary = {
  rolesCreated: number;
  rolesUpdated: number;
  categoriesCreated: number;
  channelsCreated: number;
  channelsUpdated: number;
};

function overwrites(guild: Guild, definition: ChannelDefinition, categoryPrivateTo?: string[]) {
  const privateTo = definition.privateTo ?? categoryPrivateTo;
  const values: Array<{ id: string; allow?: bigint[]; deny?: bigint[] }> = [];

  if (privateTo) {
    values.push({ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] });
    for (const roleName of privateTo) {
      const role = guild.roles.cache.find((candidate) => candidate.name === roleName);
      if (!role) throw new Error(`Role not found while configuring permissions: ${roleName}`);
      values.push({
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.SendMessagesInThreads,
          ...(!definition.readOnly ? [PermissionFlagsBits.SendMessages] : []),
        ],
      });
    }
  }

  if (definition.readOnly) {
    const everyone = values.find((value) => value.id === guild.roles.everyone.id);
    if (everyone) everyone.deny = [...(everyone.deny ?? []), PermissionFlagsBits.SendMessages];
    else values.push({ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] });

    for (const roleName of definition.postAs ?? []) {
      const role = guild.roles.cache.find((candidate) => candidate.name === roleName);
      if (!role) throw new Error(`Role not found while configuring posting permissions: ${roleName}`);
      const existing = values.find((value) => value.id === role.id);
      if (existing) existing.allow = [...(existing.allow ?? []), PermissionFlagsBits.SendMessages];
      else values.push({ id: role.id, allow: [PermissionFlagsBits.SendMessages] });
    }
  }

  if (definition.allowReactions) {
    if (privateTo) {
      for (const roleName of privateTo) {
        const role = guild.roles.cache.find((candidate) => candidate.name === roleName);
        if (!role) throw new Error(`Role not found while configuring reactions: ${roleName}`);
        const existing = values.find((value) => value.id === role.id);
        if (existing) existing.allow = [...(existing.allow ?? []), PermissionFlagsBits.AddReactions];
        else values.push({ id: role.id, allow: [PermissionFlagsBits.AddReactions] });
      }
    } else {
      const everyone = values.find((value) => value.id === guild.roles.everyone.id);
      if (everyone) everyone.allow = [...(everyone.allow ?? []), PermissionFlagsBits.AddReactions];
      else values.push({ id: guild.roles.everyone.id, allow: [PermissionFlagsBits.AddReactions] });
    }
  }

  return values;
}

export async function setupServer(guild: Guild): Promise<SetupSummary> {
  const summary: SetupSummary = { rolesCreated: 0, rolesUpdated: 0, categoriesCreated: 0, channelsCreated: 0, channelsUpdated: 0 };
  await guild.roles.fetch();
  await guild.channels.fetch();

  // EFP is invitation-only. Removing this from @everyone ensures ordinary
  // members cannot create invite links; server administrators still bypass it.
  const restrictedUntilRole = [
    PermissionFlagsBits.CreateInstantInvite,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.SendMessagesInThreads,
    PermissionFlagsBits.CreatePublicThreads,
    PermissionFlagsBits.CreatePrivateThreads,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
    PermissionFlagsBits.RequestToSpeak,
    PermissionFlagsBits.Stream,
    PermissionFlagsBits.SendVoiceMessages,
  ];
  if (restrictedUntilRole.some((permission) => guild.roles.everyone.permissions.has(permission))) {
    await guild.roles.everyone.setPermissions(
      guild.roles.everyone.permissions.remove(...restrictedUntilRole),
      "EFP read-only recruiting lobby until administrator role assignment",
    );
  }

  for (const definition of serverLayout.roles) {
    const existing = guild.roles.cache.find((role) => role.name === definition.name);
    const values = { color: definition.color, hoist: definition.hoist ?? false, mentionable: definition.mentionable ?? false, reason: "EFP server configuration" };
    if (existing) {
      await existing.edit(values);
      summary.rolesUpdated++;
    } else {
      await guild.roles.create({ name: definition.name, ...values });
      summary.rolesCreated++;
    }
  }

  for (const categoryDefinition of serverLayout.categories) {
    const categoryPermissionOverwrites = overwrites(
      guild,
      { name: categoryDefinition.name, privateTo: categoryDefinition.privateTo },
    );
    let category = guild.channels.cache.find(
      (channel): channel is CategoryChannel => channel.type === ChannelType.GuildCategory && matchesDisplayName(channel.name, categoryDefinition.name),
    );
    if (!category) {
      category = await guild.channels.create({
        name: displayCategoryName(categoryDefinition.name),
        type: ChannelType.GuildCategory,
        permissionOverwrites: categoryPermissionOverwrites,
        reason: "EFP server configuration",
      });
      summary.categoriesCreated++;
    } else {
      await category.edit({
        name: displayCategoryName(categoryDefinition.name),
        permissionOverwrites: categoryPermissionOverwrites,
        reason: "EFP category access configuration",
      });
    }

    for (const definition of categoryDefinition.channels) {
      const type = definition.type ?? ChannelType.GuildText;
      const existing = guild.channels.cache.find((channel: GuildBasedChannel) => channel.type === type && matchesDisplayName(channel.name, definition.name) && channel.parentId === category.id);
      const permissionOverwrites = overwrites(guild, definition, categoryDefinition.privateTo);
      const availableTags = definition.tags?.map((name) => ({ name, moderated: false }));

      if (existing && "edit" in existing) {
        await existing.edit({ name: displayChannelName(definition), parent: category.id, topic: definition.topic, permissionOverwrites, ...(type === ChannelType.GuildForum ? { availableTags } : {}), reason: "EFP server configuration" });
        summary.channelsUpdated++;
      } else {
        await guild.channels.create({ name: displayChannelName(definition), type, parent: category.id, topic: definition.topic, permissionOverwrites, ...(type === ChannelType.GuildForum ? { availableTags } : {}), reason: "EFP server configuration" });
        summary.channelsCreated++;
      }
    }
  }
  return summary;
}
