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

function validateLayoutRoleReferences() {
  const declared = new Set<string>();
  for (const definition of serverLayout.roles) {
    if (declared.has(definition.name)) throw new Error(`Duplicate role definition: ${definition.name}`);
    declared.add(definition.name);
  }

  const referenced = new Set<string>();
  for (const category of serverLayout.categories) {
    for (const roleName of category.privateTo ?? []) referenced.add(roleName);
    for (const channel of category.channels) {
      for (const roleName of channel.privateTo ?? []) referenced.add(roleName);
      for (const roleName of channel.postAs ?? []) referenced.add(roleName);
    }
  }

  const missing = [...referenced].filter((roleName) => !declared.has(roleName));
  if (missing.length) {
    throw new Error(`Guild layout references roles that are not declared: ${missing.join(", ")}`);
  }
}

function desiredPermissionBits(permissions: bigint[] | undefined) {
  return (permissions ?? []).reduce((bits, permission) => bits | permission, 0n);
}

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
          ...(!definition.readOnly
            ? [
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.SendMessagesInThreads,
              PermissionFlagsBits.CreatePublicThreads,
              PermissionFlagsBits.CreatePrivateThreads,
              ...(definition.allowAttachments
                ? [PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks]
                : []),
              ]
            : []),
        ],
      });
    }
  }

  if (definition.readOnly) {
    const readOnlyDeny = [
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.SendMessagesInThreads,
      PermissionFlagsBits.CreatePublicThreads,
      PermissionFlagsBits.CreatePrivateThreads,
    ];
    const everyone = values.find((value) => value.id === guild.roles.everyone.id);
    if (everyone) everyone.deny = [...new Set([...(everyone.deny ?? []), ...readOnlyDeny])];
    else values.push({ id: guild.roles.everyone.id, deny: readOnlyDeny });

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

  if (definition.allowAttachments && !privateTo) {
    const everyone = values.find((value) => value.id === guild.roles.everyone.id);
    const permissions = [PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks];
    if (everyone) everyone.allow = [...(everyone.allow ?? []), ...permissions];
    else values.push({ id: guild.roles.everyone.id, allow: permissions });
  }

  return values;
}

export async function setupServer(guild: Guild): Promise<SetupSummary> {
  const summary: SetupSummary = { rolesCreated: 0, rolesUpdated: 0, categoriesCreated: 0, channelsCreated: 0, channelsUpdated: 0 };
  validateLayoutRoleReferences();
  await guild.roles.fetch();
  await guild.channels.fetch();

  const botMember = guild.members.me ?? await guild.members.fetchMe();
  const requiredBotPermissions = [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels];
  const missingBotPermissions = requiredBotPermissions.filter((permission) => !botMember.permissions.has(permission));
  if (missingBotPermissions.length) {
    throw new Error("Bot requires Manage Roles and Manage Channels before guild setup can run safely.");
  }

  const duplicateRequiredRoles = serverLayout.roles
    .map((definition) => definition.name)
    .filter((roleName) => guild.roles.cache.filter((role) => role.name === roleName).size > 1);
  if (duplicateRequiredRoles.length) {
    throw new Error(`Duplicate required roles must be resolved before setup: ${duplicateRequiredRoles.join(", ")}`);
  }

  const blockedReconciliation = serverLayout.roles.flatMap((definition) => {
    if (definition.preservePermissions) return [];
    const existing = guild.roles.cache.find((role) => role.name === definition.name);
    if (!existing || existing.permissions.bitfield === desiredPermissionBits(definition.permissions) || existing.editable) return [];
    return [definition.name];
  });
  if (blockedReconciliation.length) {
    throw new Error(
      `Move the bot role above these roles so setup can reconcile their permissions safely: ${blockedReconciliation.join(", ")}`,
    );
  }

  const createdRoleIds = new Set<string>();
  for (const definition of serverLayout.roles) {
    if (guild.roles.cache.some((role) => role.name === definition.name)) continue;
    const created = await guild.roles.create({
      name: definition.name,
      colors: { primaryColor: definition.color },
      hoist: definition.hoist ?? false,
      mentionable: definition.mentionable ?? false,
      permissions: definition.permissions,
      reason: "EFP server configuration",
    });
    createdRoleIds.add(created.id);
    summary.rolesCreated++;
  }
  await guild.roles.fetch();

  const missingRoles = serverLayout.roles
    .map((definition) => definition.name)
    .filter((roleName) => !guild.roles.cache.some((role) => role.name === roleName));
  if (missingRoles.length) throw new Error(`Required roles were not created: ${missingRoles.join(", ")}`);

  for (const definition of serverLayout.roles) {
    const existing = guild.roles.cache.find((role) => role.name === definition.name);
    if (!existing || createdRoleIds.has(existing.id) || !existing.editable) continue;
    await existing.edit({
      colors: { primaryColor: definition.color },
      hoist: definition.hoist ?? false,
      mentionable: definition.mentionable ?? false,
      ...(!definition.preservePermissions ? { permissions: definition.permissions ?? [] } : {}),
      reason: "EFP server configuration",
    });
    summary.rolesUpdated++;
  }

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
