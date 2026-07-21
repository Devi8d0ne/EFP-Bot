import { ChannelType } from "discord.js";

const MEMBER_ROLES = ["Admin", "Office", "General Manager", "Field Manager", "Agent"];

const CATEGORY_EMOJIS: Record<string, string> = {
  "START HERE": "👋",
  "RECRUITING CENTER": "🚀",
  "EFP TOWN SQUARE": "🏛️",
  "AGENT HUB": "🧭",
  "TRAINING & CERTIFICATION": "🎓",
  "SALES FLOOR": "⚡",
  "TICKETS & LIVE SUPPORT": "🎫",
  "LEADERSHIP OPERATIONS": "📈",
  "OFFICE OPERATIONS": "🏢",
  "APP DATA FEEDS": "📡",
  "TICKET ARCHIVE": "🗄️",
  "ADMIN OPERATIONS": "🔒",
};

export function displayCategoryName(name: string) {
  return CATEGORY_EMOJIS[name] ? `${CATEGORY_EMOJIS[name]}・${name}` : name;
}

export function displayChannelName(definition: ChannelDefinition) {
  const type = definition.type ?? ChannelType.GuildText;
  const emoji = type === ChannelType.GuildAnnouncement
    ? "📣"
    : type === ChannelType.GuildStageVoice
      ? "🎙️"
      : type === ChannelType.GuildVoice
        ? "🔊"
        : type === ChannelType.GuildForum
          ? "🎫"
          : definition.readOnly
            ? "📌"
            : "💬";
  return `${emoji}・${definition.name}`;
}

export function matchesDisplayName(actual: string, logical: string) {
  return actual === logical || actual.endsWith(`・${logical}`);
}

export type RoleDefinition = {
  name: string;
  color: number;
  hoist?: boolean;
  mentionable?: boolean;
};

export type ChannelDefinition = {
  name: string;
  type?: ChannelType.GuildText | ChannelType.GuildAnnouncement | ChannelType.GuildVoice | ChannelType.GuildStageVoice | ChannelType.GuildForum;
  topic?: string;
  readOnly?: boolean;
  privateTo?: string[];
  postAs?: string[];
  tags?: string[];
};

export type CategoryDefinition = {
  name: string;
  privateTo?: string[];
  channels: ChannelDefinition[];
};

// Declarative source of truth. Setup reuses matching resources and never deletes
// server content, so it is safe to run repeatedly as this layout evolves.
export const serverLayout: {
  roles: RoleDefinition[];
  categories: CategoryDefinition[];
} = {
  // Roles already exist in Discord and remain administrator-assigned.
  roles: [],
  categories: [
    {
      name: "START HERE",
      channels: [
        { name: "welcome", topic: "Start here: what EFP is and how this server works.", readOnly: true, postAs: ["Admin", "Field Manager"] },
        { name: "rules-and-standards", topic: "EFP conduct, security, and operating standards.", readOnly: true, postAs: ["Admin"] },
        { name: "announcements", type: ChannelType.GuildAnnouncement, topic: "Official EFP news and operational announcements.", readOnly: true, postAs: ["Admin", "General Manager"] },
        { name: "choose-your-path", topic: "Where agents, managers, office staff, and partners should go next.", readOnly: true, postAs: ["Admin", "Field Manager"] },
      ],
    },
    {
      name: "EFP TOWN SQUARE",
      privateTo: MEMBER_ROLES,
      channels: [
        { name: "town-square", topic: "The main commons for company-wide conversation." },
        { name: "wins-and-recognition", topic: "Celebrate closes, milestones, and great work." },
        { name: "watercooler", topic: "Off-topic and social conversation." },
        { name: "ideas-and-feedback", type: ChannelType.GuildForum, topic: "Propose and discuss improvements to EFP.", tags: ["Idea", "Feedback", "Planned", "Shipped"] },
      ],
    },
    {
      name: "RECRUITING CENTER",
      channels: [
        { name: "the-opportunity", topic: "Forward-facing EFP recruiting message: direct field sales, training, performance, and growth.", readOnly: true, postAs: ["Admin", "Office", "General Manager", "Field Manager"] },
        { name: "who-fits-here", topic: "What EFP looks for: coachable, reliable, confident, mobile, team-minded, and growth-focused people.", readOnly: true, postAs: ["Admin", "Office", "General Manager", "Field Manager"] },
        { name: "recruiting-links", topic: "Approved EFP application pages and personalized recruiter links to share externally.", readOnly: true, postAs: ["Admin", "Office", "General Manager", "Field Manager"] },
        { name: "efp-jobs", topic: "Interested in joining EFP? Review the opportunity and apply through the approved EFP recruiting page.", readOnly: true, postAs: ["Admin", "Office", "General Manager", "Field Manager"] },
        { name: "recruiting-playbook", topic: "Internal guidance for explaining the opportunity honestly, sharing the correct link, and setting clear expectations.", privateTo: MEMBER_ROLES, readOnly: true, postAs: ["Admin", "Office", "General Manager", "Field Manager"] },
        { name: "recruiting-ideas", type: ChannelType.GuildForum, topic: "Discuss recruiting campaigns, outreach ideas, and improvements without posting candidate personal information.", privateTo: MEMBER_ROLES, tags: ["Campaign", "Content", "Referral", "Event", "Idea"] },
      ],
    },
    {
      name: "AGENT HUB",
      privateTo: MEMBER_ROLES,
      channels: [
        { name: "agent-handbook", topic: "Processes, expectations, and the agent operating guide.", readOnly: true, postAs: ["Admin", "General Manager", "Field Manager"] },
        { name: "sales-playbook", topic: "Talk tracks, objections, discovery, and closing guidance.", readOnly: true, postAs: ["Admin", "General Manager", "Field Manager"] },
        { name: "resources-and-links", topic: "Approved tools, forms, references, and training links.", readOnly: true, postAs: ["Admin", "Field Manager"] },
        { name: "agent-questions", topic: "Ask the team questions and receive real-time help." },
        { name: "field-intelligence", topic: "Share market observations and useful lessons from the field." },
      ],
    },
    {
      name: "TRAINING & CERTIFICATION",
      privateTo: MEMBER_ROLES,
      channels: [
        { name: "certification-roadmap", topic: "Nine coached lessons, lesson tests, final certification, and coach sign-off.", readOnly: true, postAs: ["Admin", "General Manager", "Field Manager"] },
        { name: "field-process-and-reclosing", topic: "The seven-stage process, two closes, psychology, rebuttals, transitions, and referrals.", readOnly: true, postAs: ["Admin", "General Manager", "Field Manager"] },
        { name: "arcadia-community-solar", topic: "Arcadia qualification, approved language, enrollment, processing, activation, and support.", readOnly: true, postAs: ["Admin", "General Manager", "Field Manager"] },
        { name: "idt-offer-and-disclosures", topic: "IDT offer language, current disclosures, verification, and customer authorization.", readOnly: true, postAs: ["Admin", "General Manager", "Field Manager"] },
        { name: "document-validation", topic: "LMI proof and utility-bill validation standards. Never post customer documents here.", readOnly: true, postAs: ["Admin", "General Manager", "Field Manager"] },
        { name: "roleplay-and-coaching", topic: "Practice talks, receive corrections, and prepare for coach sign-off." },
        { name: "training-questions", topic: "Ask before you guess about campaign terms, instructions, or documents." },
      ],
    },
    {
      name: "SALES FLOOR",
      privateTo: MEMBER_ROLES,
      channels: [
        { name: "floor-chat", topic: "Live coordination while the sales floor is operating." },
        { name: "morning-huddle", topic: "Daily product focus, compliance reminder, roleplay, and territory plan." },
        { name: "midday-check", topic: "Field observations, direct corrections, and clean restarts." },
        { name: "end-of-day-review", topic: "Enrollment review, issue log, scorecard, and coaching notes." },
        { name: "weekly-leadership", topic: "Progress review, retraining assignments, recruiting, and leadership development." },
        { name: "meeting-agenda", topic: "Agendas, speaker order, and meeting preparation." },
        { name: "meeting-notes", topic: "Decisions, follow-ups, and meeting recaps.", readOnly: true, postAs: ["Admin", "General Manager", "Field Manager"] },
        { name: "Main Sales Floor", type: ChannelType.GuildVoice },
        { name: "EFP All Hands", type: ChannelType.GuildStageVoice },
        { name: "Speakers Room", type: ChannelType.GuildVoice, privateTo: ["Admin", "General Manager", "Field Manager"] },
        { name: "Breakout Room 1", type: ChannelType.GuildVoice },
        { name: "Breakout Room 2", type: ChannelType.GuildVoice },
      ],
    },
    {
      name: "TICKETS & LIVE SUPPORT",
      privateTo: MEMBER_ROLES,
      channels: [
        { name: "ticket-guide", topic: "How to submit a useful ticket and when to use live support.", readOnly: true, postAs: ["Admin", "Field Manager"] },
        { name: "arcadia-tickets", type: ChannelType.GuildForum, topic: "Submit and track Arcadia Community Solar questions and issues. Do not post customer documents or account numbers.", tags: ["Enrollment", "Qualification", "Activation", "Tech Support", "Resolved"] },
        { name: "idt-tickets", type: ChannelType.GuildForum, topic: "Submit and track IDT offer, disclosure, TPV, and enrollment questions. Do not post customer documents or account numbers.", tags: ["Offer", "Disclosure", "TPV", "Enrollment", "Resolved"] },
        { name: "office-questions", type: ChannelType.GuildForum, topic: "Agent office questions about badges, access, paperwork, and general administration. Send private commission or payroll details directly to Office/Admin.", tags: ["Badge", "Access", "Paperwork", "Commission", "Payroll", "General"] },
        { name: "live-support", topic: "Real-time operational questions for agents and team leads." },
        { name: "Support Huddle", type: ChannelType.GuildVoice },
      ],
    },
    {
      name: "ADMIN OPERATIONS",
      privateTo: ["Admin"],
      channels: [
        { name: "admin-command", topic: "Private administrative coordination and decisions." },
        { name: "undercover-comms", topic: "Restricted internal communication for sensitive operational matters." },
        { name: "leadership-briefing", topic: "Leadership updates, reports, and action items." },
        { name: "agent-data-review", topic: "Review incoming agent and operational data." },
        { name: "incident-log", topic: "Private record of operational and security incidents." },
        { name: "Admin War Room", type: ChannelType.GuildVoice },
      ],
    },
    {
      name: "LEADERSHIP OPERATIONS",
      privateTo: ["Admin", "General Manager", "Field Manager"],
      channels: [
        { name: "manager-briefing", topic: "Read-only leadership priorities, decisions, and weekly direction.", readOnly: true, postAs: ["Admin", "General Manager"] },
        { name: "field-coaching", topic: "Agent coaching plans, roleplay priorities, observations, and retraining assignments." },
        { name: "performance-review", topic: "Team scorecards, progress reviews, and leadership follow-through." },
        { name: "territory-and-staffing", topic: "Territory plans, field coverage, staffing, and daily deployment." },
        { name: "Leadership Room", type: ChannelType.GuildVoice },
      ],
    },
    {
      name: "OFFICE OPERATIONS",
      privateTo: ["Admin", "Office", "General Manager"],
      channels: [
        { name: "office-desk", topic: "Internal office coordination and administrative follow-through." },
        { name: "commissions-review", topic: "Restricted commission questions, corrections, and status review." },
        { name: "badges-and-access", topic: "Badge issuance, system access, onboarding paperwork, and equipment tracking." },
        { name: "candidate-review", topic: "Private applicant review and recruiting follow-up. Protect candidate personal information." },
        { name: "Office Room", type: ChannelType.GuildVoice },
      ],
    },
    {
      name: "TICKET ARCHIVE",
      privateTo: ["Admin", "Office", "General Manager", "Field Manager"],
      channels: [
        { name: "archive-guide", topic: "Closed office tickets are moved into this private category.", readOnly: true, postAs: ["Admin", "Office", "General Manager", "Field Manager"] },
      ],
    },
    {
      name: "APP DATA FEEDS",
      privateTo: ["Admin", "Office", "General Manager", "Field Manager"],
      channels: [
        { name: "wiki-test-results", topic: "Automated lesson, final-certification, and training results from the EFP wiki.", privateTo: ["Admin", "General Manager", "Field Manager"] },
        { name: "sales-tracker-feed", topic: "Automated end-of-day Community Solar, deregulation, and commission-estimate reports.", privateTo: ["Admin", "Office", "General Manager", "Field Manager"] },
        { name: "recruiting-site-feed", topic: "Automated candidate and recruiting-site submissions.", privateTo: ["Admin", "Office", "General Manager"] },
        { name: "integration-alerts", topic: "Delivery failures and health alerts from connected EFP applications.", privateTo: ["Admin"] },
      ],
    },
  ],
};

export const webhookFeeds = [
  { key: "wikiTest", channel: "wiki-test-results", name: "EFP Wiki Test Results" },
  { key: "salesTracker", channel: "sales-tracker-feed", name: "EFP Sales Tracker" },
  { key: "recruitingSites", channel: "recruiting-site-feed", name: "EFP Recruiting Sites" },
] as const;
