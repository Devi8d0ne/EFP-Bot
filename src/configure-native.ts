import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationRuleTriggerType,
  ChannelType,
  Client,
  GatewayIntentBits,
} from "discord.js";
import { config } from "./config.js";
import { matchesDisplayName } from "./server-layout.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
try {
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  const roles = await guild.roles.fetch();
  const byName = (name: string) => channels.find((channel) => channel && matchesDisplayName(channel.name, name));
  const welcome = byName("welcome");
  const rules = byName("rules-and-standards");
  const opportunity = byName("the-opportunity");
  const jobs = byName("efp-jobs");
  const incidentLog = byName("incident-log");
  const moderatorOnly = byName("moderator-only");
  const exemptRoles = ["Admin", "Office", "General Manager", "Field Manager"]
    .map((name) => roles.find((role) => role.name === name))
    .filter((role) => role !== undefined);

  await guild.edit({
    description: "Energy Freedom Project sales, training, recruiting, leadership, and field operations.",
    systemChannel: welcome?.id,
    rulesChannel: rules?.id,
    publicUpdatesChannel: incidentLog?.id,
    reason: "Configure the EFP native Discord experience",
  });
  if (rules?.type === ChannelType.GuildText) await guild.setRulesChannel(rules, "Use the populated EFP standards channel");
  if (moderatorOnly?.type === ChannelType.GuildText) await guild.setPublicUpdatesChannel(moderatorOnly, "Keep Community updates in the moderator channel");

  if (welcome && rules && opportunity && jobs) {
    await guild.editWelcomeScreen({
      enabled: true,
      description: "Learn what EFP is, review the standards, and explore the field sales opportunity.",
      welcomeChannels: [
        { channel: welcome.id, description: "Start here", emoji: "👋" },
        { channel: rules.id, description: "Read the EFP standards", emoji: "🛡️" },
        { channel: opportunity.id, description: "Explore the opportunity", emoji: "⚡" },
        { channel: jobs.id, description: "Apply for EFP jobs", emoji: "🚀" },
      ],
    });
  }

  if (incidentLog?.type === ChannelType.GuildText) {
    const existing = await guild.autoModerationRules.fetch();
    const ruleSpecs = [
      {
        name: "EFP Mention Spam Protection",
        triggerType: AutoModerationRuleTriggerType.MentionSpam,
        triggerMetadata: { mentionTotalLimit: 5, mentionRaidProtectionEnabled: true },
      },
      {
        name: "EFP Safety Language Filter",
        triggerType: AutoModerationRuleTriggerType.KeywordPreset,
        triggerMetadata: { presets: [AutoModerationRuleKeywordPresetType.Profanity, AutoModerationRuleKeywordPresetType.SexualContent, AutoModerationRuleKeywordPresetType.Slurs] },
      },
    ] as const;
    for (const spec of ruleSpecs) {
      const options = {
        eventType: AutoModerationRuleEventType.MessageSend,
        actions: [
          { type: AutoModerationActionType.BlockMessage, metadata: { customMessage: "This message conflicts with EFP server standards." } },
          { type: AutoModerationActionType.SendAlertMessage, metadata: { channel: incidentLog } },
        ],
        enabled: true,
        exemptRoles,
        reason: "EFP native moderation safeguards",
      };
      const current = existing.find((rule) => rule.name === spec.name);
      if (current) await current.edit({ ...options, triggerMetadata: spec.triggerMetadata });
      else await guild.autoModerationRules.create({ name: spec.name, triggerType: spec.triggerType, triggerMetadata: spec.triggerMetadata, ...options });
    }
  }
  console.log("Configured EFP welcome screen, server identity, and native AutoMod.");
} finally {
  client.destroy();
}
