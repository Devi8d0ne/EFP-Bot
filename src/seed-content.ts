import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  type TextChannel,
} from "discord.js";
import { config } from "./config.js";
import { matchesDisplayName } from "./server-layout.js";

const GREEN = 0x18a363;
const GOLD = 0xd7ae54;
const MAIN_RECRUITING = "https://www.energyfreedomproject.site/";

type Seed = {
  channel: string;
  title: string;
  description: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  links?: Array<{ label: string; url: string }>;
  color?: number;
  pin?: boolean;
};

const seeds: Seed[] = [
  {
    channel: "welcome",
    title: "Welcome to Energy Freedom Project",
    description: "EFP helps eligible households understand energy programs through a clear, respectful, and accurate field experience. Explore the recruiting lobby to learn what we do. Operational access begins only after an administrator assigns your role.",
    fields: [
      { name: "Our standard", value: "Train hard. Sell clean. Finish together." },
      { name: "New here?", value: "Read the rules, review the opportunity, and use the approved application page if EFP looks like a fit." },
    ],
    pin: true,
  },
  {
    channel: "rules-and-standards",
    title: "EFP Rules and Field Standards",
    description: "Integrity, clarity, service, discipline, and ownership guide every decision.",
    fields: [
      { name: "Customer protection", value: "Never imply you work for the utility, present an optional program as mandatory, manufacture urgency, coach verification answers, or continue after consent is withdrawn." },
      { name: "Data protection", value: "Never post utility account numbers, customer bills, benefit documents, identification, payroll details, or candidate personal information in public channels." },
      { name: "Professional conduct", value: "Respect every door, take coaching immediately, report technical issues, and finish each day clean." },
    ],
    color: GOLD,
    pin: true,
  },
  {
    channel: "choose-your-path",
    title: "Choose Your Path",
    description: "Visitors can explore recruiting information. Assigned agents gain the Town Square, training, sales floor, and support areas. Office and leadership roles unlock their private operating spaces.",
    fields: [
      { name: "Prospective agents", value: "Start in **Recruiting Center** → `the-opportunity`, `who-fits-here`, and `efp-jobs`." },
      { name: "Active agents", value: "Start in **Agent Hub**, then follow **Training & Certification** and the daily **Sales Floor** rhythm." },
      { name: "Need access?", value: "An administrator must assign every role. Access is never self-assigned." },
    ],
    pin: true,
  },
  {
    channel: "the-opportunity",
    title: "Stop Settling. Start Selling.",
    description: "EFP recruits people who want active work, clear expectations, and a chance to earn through performance. The work centers on direct customer conversations, energy options in eligible markets, consistent field activity, and growth through coaching.",
    fields: [
      { name: "What you get", value: "Training and support, upward mobility, a team environment, and a practical path for people willing to move." },
      { name: "Straight talk", value: "Compensation is performance-based. Results vary by market, campaign, availability, skill, compliance, and individual follow-through. Earnings are not guaranteed." },
    ],
    links: [{ label: "Explore EFP", url: MAIN_RECRUITING }],
    color: GOLD,
    pin: true,
  },
  {
    channel: "who-fits-here",
    title: "Who Fits at EFP",
    description: "We look for closers, learners, and future leaders—not polished resumes.",
    fields: [
      { name: "Core traits", value: "Coachable • Reliable • Confident • Mobile • Team-minded • Growth-focused" },
      { name: "Strong candidates", value: "Confident communicators, door-to-door candidates, field sales people, and future leaders who can take coaching without excuses." },
      { name: "The path", value: "Identify → Invite → Screen → Train → Certify → Coach → Develop leaders" },
    ],
    pin: true,
  },
  {
    channel: "recruiting-links",
    title: "Approved Recruiting Links",
    description: "Share only approved EFP pages. Personalized pages preserve the recruiter attribution and application path.",
    links: [
      { label: "Main EFP Page", url: MAIN_RECRUITING },
    ],
    pin: true,
  },
  {
    channel: "efp-jobs",
    title: "Apply for EFP Jobs",
    description: "Review the opportunity, send the short application, and choose your preferred follow-up method. EFP will explain market availability, expectations, training, schedule, and compensation before you decide.",
    links: [{ label: "Apply with EFP", url: MAIN_RECRUITING }],
    color: GOLD,
    pin: true,
  },
  {
    channel: "recruiting-playbook",
    title: "Recruiting Playbook",
    description: "Recruit with the truth. Explain the work accurately, share the correct attributed link, set realistic expectations, and protect candidate information.",
    fields: [
      { name: "Do", value: "Explain direct field sales, performance-based compensation, training, compliance, market availability, and the follow-up process." },
      { name: "Do not", value: "Promise income, hide the nature of the work, post applicant details in chat, or represent availability as guaranteed." },
    ],
    pin: true,
  },
  {
    channel: "agent-handbook",
    title: "Agent Operating Standard",
    description: "Run the seven stages: Opening → Early contentions → Body → Late contentions → Transition or button-up → Referral → Clean exit.",
    fields: [
      { name: "Two closes", value: "First: obtain the correct utility bill for qualification. Second: complete an accurate, informed enrollment." },
      { name: "Decision rule", value: "A clear no is more valuable than a confused yes. Trust and compliance are the standard, not obstacles." },
    ],
    pin: true,
  },
  {
    channel: "sales-playbook",
    title: "Sales Playbook",
    description: "Use rehash → answer → reclose. Reflect the real concern, give the shortest complete answer, then return to the next appropriate step.",
    fields: [
      { name: "Before qualification", value: "The reclose normally returns to getting the bill." },
      { name: "After qualification", value: "Return to the remaining enrollment step or active disclosure. Never skip verification or material terms." },
      { name: "Red lines", value: "No arguments, shame, information dumps, manufactured urgency, unsupported claims, or pressure after consent is withdrawn." },
    ],
    pin: true,
  },
  {
    channel: "certification-roadmap",
    title: "Nine-Lesson Certification Roadmap",
    description: "Read, listen, test, practice, and obtain coach sign-off before production.",
    fields: [
      { name: "Foundation", value: "1. Foundation and Field Process\n2. Psychology, Trust, and Reclosing\n3. Arcadia Community Solar" },
      { name: "Products and validation", value: "4. IDT Offer and Disclosures\n5. Transitions, Late Contentions, and Referrals\n6. LMI Document Validation\n7. Utility Bill Validation" },
      { name: "Field readiness", value: "8. Field Standards and Certification\n9. Rebuttal Frameworks and Reclosing" },
    ],
    pin: true,
  },
  {
    channel: "arcadia-community-solar",
    title: "Arcadia Community Solar",
    description: "Qualify first. Verify the utility account and accepted benefit documentation through the approved flow. Keep submission, processing, and activation separate.",
    fields: [
      { name: "Be precise", value: "Arcadia is not the utility. Ameren continues delivering electricity. Never guarantee activation before review." },
      { name: "Support", value: "Use the Arcadia ticket forum for process questions. Never upload customer bills or benefit documents to Discord." },
    ],
    pin: true,
  },
  {
    channel: "idt-offer-and-disclosures",
    title: "IDT Offer and Disclosure Discipline",
    description: "Campaign terms can change. Use the current active disclosure as the authority for rates, terms, incentives, and effective dates.",
    fields: [
      { name: "Be precise", value: "Identify IDT accurately, verify qualification, distinguish submission from the effective date, and never imply IDT is the utility." },
      { name: "Support", value: "Use the IDT ticket forum for offer, disclosure, TPV, or enrollment questions." },
    ],
    pin: true,
  },
  {
    channel: "document-validation",
    title: "Document Validation and Privacy",
    description: "Use only approved systems for customer documents. Discord is not an enrollment record, document store, or place to troubleshoot using real account data.",
    fields: [
      { name: "Never post", value: "Utility bills, account numbers, benefit documents, identification, signatures, verification answers, or screenshots containing customer data." },
      { name: "When something does not line up", value: "Pause the process and ask training leadership using a hypothetical or redacted description." },
    ],
    color: GOLD,
    pin: true,
  },
  {
    channel: "ticket-guide",
    title: "Native Support Workflow",
    description: "Use the Arcadia or IDT forum and select the closest tag. Search before creating a new post, explain the issue without customer data, and mark the post resolved when complete.",
    fields: [
      { name: "Office questions", value: "Use the Office Questions forum for badges, access, paperwork, and general administration. Send private commission or payroll details directly to Office/Admin." },
      { name: "Urgent live issue", value: "Use `live-support` or the Support Huddle during operating hours." },
    ],
    pin: true,
  },
  {
    channel: "morning-huddle",
    title: "Daily Sales Rhythm",
    description: "Morning: product focus, one compliance reminder, roleplay, and territory plan. Midday: field observation and clean correction. End of day: enrollment review, issue log, scorecard, and coaching notes. Weekly: progress, retraining, and leadership development.",
    pin: true,
  },
  {
    channel: "town-square",
    title: "Crew Life Town Square",
    description: "One crew. One standard. Use this commons for company conversation, useful questions, shared lessons, and team alignment.",
    fields: [
      { name: "The promise", value: "Train hard. Sell clean. Finish together." },
      { name: "Crew mindset", value: "Responsibility is responding to your ability. When you can solve, teach, correct, protect, or help, take ownership of the next useful action." },
      { name: "P⁶", value: "Proper Preparation Prevents Piss-Poor Performance: Purpose • Knowledge • Practice • Tools • Plan • Standard" },
    ],
    color: GOLD,
    pin: true,
  },
  {
    channel: "wins-and-recognition",
    title: "Recognize the Right Wins",
    description: "Celebrate clean enrollments, certification milestones, strong coaching, useful referrals, consistent activity, and teammates who protected the customer or improved the system.",
    fields: [{ name: "Good recognition includes", value: "Who earned it • What they did • Why it reflects the EFP standard • What others can learn" }],
    pin: true,
  },
  {
    channel: "resources-and-links",
    title: "Approved Field Resources",
    description: "Use current approved systems and official program information. Never paste login credentials or customer records into Discord.",
    fields: [
      { name: "Arcadia / Perch", value: "Perch support is the approved route for Community Solar field questions and support tickets." },
      { name: "Verification", value: "Use the approved TPV and enrollment systems. The current disclosure—not memory—is the authority for changing campaign terms." },
      { name: "Official program information", value: "Use Illinois Shines and current supplier materials when program language or eligibility needs confirmation." },
    ],
    links: [
      { label: "Perch Support", url: "https://go.perchenergy.com/support" },
      { label: "Illinois Shines", url: "https://illinoisshines.com/" },
    ],
    pin: true,
  },
  {
    channel: "field-process-and-reclosing",
    title: "Field Process Quick Reference",
    description: "Opening → Early contentions → Body → Late contentions → Transition or button-up → Referral → Clean exit.",
    fields: [
      { name: "Rehash", value: "Reflect the customer’s actual concern accurately and restore control." },
      { name: "Answer", value: "Give the shortest complete, approved response. Do not answer questions that were not asked." },
      { name: "Reclose", value: "Return to the next appropriate step—bill before qualification, remaining enrollment/disclosure step afterward." },
      { name: "Clean stop", value: "If consent is withdrawn, a term is unclear, or the system blocks enrollment, stop and correct the cause." },
    ],
    pin: true,
  },
  {
    channel: "roleplay-and-coaching",
    title: "How EFP Coaches",
    description: "Practice the exact correction, restart the talk when needed, and treat feedback as part of becoming field-ready.",
    fields: [
      { name: "Roleplay loop", value: "Set the scenario → Run the talk → Stop at the miss → Explain one correction → Restart clean → Repeat under pressure" },
      { name: "Coach the behavior", value: "Pace, distance, hands visible, accuracy, listening, transition timing, disclosure discipline, and the correct reclose." },
      { name: "Agent standard", value: "Take coaching immediately. Do not defend a bad repetition—replace it with a clean one." },
    ],
    pin: true,
  },
  {
    channel: "training-questions",
    title: "Ask Before You Guess",
    description: "When campaign terms, field instructions, customer documents, or system results do not line up, pause and ask training leadership.",
    fields: [
      { name: "Good question", value: "State the product, stage in the process, expected result, actual result, and the approved material you checked." },
      { name: "Protect the customer", value: "Use a hypothetical or fully redacted description. Never upload a real bill, ID, benefit proof, signature, or account number." },
    ],
    color: GOLD,
    pin: true,
  },
  {
    channel: "agent-questions",
    title: "Agent Questions",
    description: "Use this channel for general process and team questions. Product-specific cases belong in the Arcadia or IDT forums so answers remain searchable.",
    fields: [{ name: "Before posting", value: "Search first • Remove customer data • State what you already checked • Ask one clear question" }],
    pin: true,
  },
  {
    channel: "field-intelligence",
    title: "Field Intelligence Standard",
    description: "Share patterns that can improve the crew: recurring contentions, neighborhood conditions, operational friction, successful clean language, and system behavior.",
    fields: [{ name: "Useful format", value: "Observation → Frequency → Product/market → What was tried → Result → Recommended next test" }],
    pin: true,
  },
  {
    channel: "midday-check",
    title: "Midday Check",
    description: "Reset while there is still time to improve the day.",
    fields: [
      { name: "Check", value: "Activity • First-close rate • Qualification quality • Current contention • System issues • Territory condition" },
      { name: "Correct", value: "Choose one behavior, demonstrate it, repeat it cleanly, and return to the field with a measurable objective." },
    ],
    pin: true,
  },
  {
    channel: "end-of-day-review",
    title: "Finish the Day Clean",
    description: "Review enrollments, report technical issues, record coaching notes, and leave one specific objective for the next field day.",
    fields: [
      { name: "Closeout", value: "Enrollment review • Issue log • Scorecard • Coaching note • Follow-up owner • Tomorrow’s objective" },
      { name: "Never carry forward", value: "Unreported system errors, unresolved document questions, unclear customer status, or unassigned follow-up." },
    ],
    pin: true,
  },
  {
    channel: "weekly-leadership",
    title: "Weekly Leadership Review",
    description: "Progress review, retraining assignments, recruiting health, agent retention, field readiness, and leadership development.",
    fields: [
      { name: "Model", value: "Run the process, language, schedule, and compliance standard you expect." },
      { name: "Select", value: "Choose for coachability, communication, honesty, resilience, and respect for direction." },
      { name: "Develop and multiply", value: "Roleplay, observe, correct, certify, then teach reliable producers to coach without lowering standards." },
    ],
    pin: true,
  },
  {
    channel: "meeting-agenda",
    title: "Meeting Agenda Template",
    description: "Post agendas before the meeting so speakers arrive prepared and the floor knows the outcome expected.",
    fields: [
      { name: "Template", value: "Purpose • Decisions needed • Product/compliance update • Scorecard • Coaching focus • Speaker order • Owners and deadlines" },
      { name: "Stage flow", value: "Host opens → Speakers present → Floor questions → Decisions repeated → Owners confirmed → Notes posted" },
    ],
    pin: true,
  },
  {
    channel: "live-support",
    title: "Live Support Rules",
    description: "Use this channel for time-sensitive operational guidance when the approved flow, system, or field instruction is blocking clean work.",
    fields: [
      { name: "Include", value: "Arcadia or IDT • Current stage • Error or question • What approved resource you checked" },
      { name: "Exclude", value: "Names, addresses, phone numbers, account numbers, documents, screenshots, verification answers, and signatures" },
    ],
    color: GOLD,
    pin: true,
  },
  {
    channel: "manager-briefing",
    title: "Leadership Operating System",
    description: "Build people, not just a list. Head count creates value only when people are trained, active, compliant, retained, and becoming productive leaders.",
    fields: [
      { name: "Weekly lens", value: "Production • Compliance • Certification • Coaching • Retention • Recruiting • Territory • Systems" },
      { name: "Leadership principle", value: "Your network is your net worth when it is built through trust, follow-through, useful coaching, and people who would choose to work with you again." },
    ],
    color: GOLD,
    pin: true,
  },
  {
    channel: "office-desk",
    title: "Office Operations Desk",
    description: "Coordinate badges, access, paperwork, applicant follow-up, commission review, and administrative ownership here.",
    fields: [{ name: "Every item needs", value: "Owner • Status • Missing information • Next action • Due date • Resolution note" }],
    pin: true,
  },
];

function row(links: Seed["links"]) {
  if (!links?.length) return undefined;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    links.map((link) => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(link.label).setURL(link.url)),
  );
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
try {
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  let created = 0;
  let updated = 0;

  for (const seed of seeds) {
    const channel = channels.find((candidate) => candidate?.type === ChannelType.GuildText || candidate?.type === ChannelType.GuildAnnouncement ? matchesDisplayName(candidate.name, seed.channel) : false);
    if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) continue;
    const marker = `EFP managed content • ${seed.channel}`;
    const embed = new EmbedBuilder()
      .setColor(seed.color ?? GREEN)
      .setTitle(seed.title)
      .setDescription(seed.description)
      .setFooter({ text: marker });
    if (seed.fields) embed.addFields(seed.fields);
    const components = row(seed.links);
    const messages = await (channel as TextChannel).messages.fetch({ limit: 50 });
    const existing = messages.find((message) => message.author.id === client.user!.id && message.embeds.some((item) => item.footer?.text === marker));
    const payload = { embeds: [embed], components: components ? [components] : [] };
    const message = existing ? await existing.edit(payload) : await (channel as TextChannel).send(payload);
    if (existing) updated++;
    else created++;
    if (seed.pin && !message.pinned) await message.pin("Pin EFP reference content");
  }
  console.log(`Seed content complete: ${created} created, ${updated} updated.`);
} finally {
  client.destroy();
}
