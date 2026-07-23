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
    title: "Build a Sales Career in the Field",
    description: "Energy Freedom Project develops people through direct, face-to-face energy sales. You learn how to start conversations, explain eligible energy options clearly, handle objections professionally, and guide qualified customers through an accurate enrollment process.",
    fields: [
      { name: "What the work looks like", value: "Prepare with the team, work assigned territory, speak with customers at their homes, determine eligibility, explain the active offer and required disclosures, submit clean enrollments, and review the day with your coach." },
      { name: "What EFP provides", value: "Structured training • Product and compliance education • Roleplay and field coaching • Approved systems and sales materials • A team environment • A path toward coaching and leadership for people who earn it" },
      { name: "What EFP expects", value: "Reliable attendance, professional appearance, honest communication, respect for every customer, willingness to take direct coaching, accurate use of approved language, and consistent field activity." },
      { name: "Compensation—straight answer", value: "This is performance-based sales work, not guaranteed hourly income. Compensation, campaign availability, territory, and requirements vary by market and active program. Results depend on skill, activity, compliance, availability, and follow-through; earnings are never guaranteed." },
      { name: "Where it can lead", value: "A new agent can develop into a reliable producer, coach, field leader, recruiter, or market builder. Advancement follows demonstrated production, clean compliance, dependable leadership, and the ability to develop other people." },
    ],
    links: [{ label: "Explore the Opportunity", url: MAIN_RECRUITING }],
    color: GOLD,
    pin: true,
  },
  {
    channel: "who-fits-here",
    title: "Is Field Sales a Fit for You?",
    description: "Previous sales experience can help, but it is not the deciding factor. EFP is looking for people whose habits and attitude can survive a demanding, people-facing performance environment.",
    fields: [
      { name: "You may be a strong fit if you…", value: "Show up when you commit • Can start conversations with strangers • Stay composed after rejection • Listen and adjust quickly • Want pay connected to performance • Can work outdoors and remain active • Care about doing the job correctly" },
      { name: "You do not need", value: "A polished résumé, a college degree, years of sales experience, or a perfect personality. You do need dependable transportation or a reliable field plan, appropriate availability, and the ability to meet the requirements of the active market." },
      { name: "This probably is not for you if…", value: "You need guaranteed income, dislike direct public interaction, avoid accountability, resist coaching, want a remote desk role, or are uncomfortable hearing no repeatedly before earning a yes." },
      { name: "What we screen for", value: "Communication • Coachability • Reliability • Availability • Mobility • Professional judgment • Honest motivation • Ability to follow compliance requirements" },
      { name: "Our development path", value: "Apply → Interview → Market and role review → Training → Certification → Field coaching → Consistent production → Leadership consideration" },
    ],
    pin: true,
  },
  {
    channel: "recruiting-links",
    title: "Share the Right EFP Application",
    description: "Send candidates an approved EFP recruiting page so they receive accurate information and their application reaches the right contact. Do not replace the application with screenshots, copied claims, or an improvised job description.",
    fields: [
      { name: "Before sharing", value: "Tell the person this is direct field sales with performance-based compensation. Confirm that they are open to learning more, then send the approved link—never disguise the nature of the role to get an application." },
      { name: "Use your assigned link", value: "If EFP has given you a personalized recruiting page, use it so recruiter attribution and follow-up routing are preserved. Otherwise, use the main EFP page below." },
      { name: "After sharing", value: "Ask the candidate to complete the short application themselves. Do not collect or post their phone number, email, résumé, address, or other personal information in a Discord channel." },
    ],
    links: [
      { label: "Main EFP Page", url: MAIN_RECRUITING },
    ],
    pin: true,
  },
  {
    channel: "efp-jobs",
    title: "Ready to Talk? Start Here.",
    description: "Applying starts a conversation—it does not lock you into the role. Complete the short EFP application and a team contact will review your location, availability, interests, and preferred follow-up method.",
    fields: [
      { name: "1 — Review the role", value: "Understand that the core opportunity is direct, face-to-face field sales and that compensation is performance-based." },
      { name: "2 — Submit the application", value: "Provide accurate contact information, your city and state, relevant experience, area of interest, and the best time and method to reach you." },
      { name: "3 — Have a real conversation", value: "If there may be a fit, EFP will explain current market availability, campaign requirements, schedule expectations, training, compensation structure, and next steps." },
      { name: "Questions worth asking", value: "Which market is active? • What does a normal field day look like? • How is compensation calculated? • What must I complete before entering the field? • What expenses or equipment should I expect? • Who will coach me?" },
      { name: "No pressure", value: "Ask direct questions and decide after you understand the work. Availability is not guaranteed, and submitting an application does not guarantee placement." },
    ],
    links: [{ label: "Apply with EFP", url: MAIN_RECRUITING }],
    color: GOLD,
    pin: true,
  },
  {
    channel: "recruiting-playbook",
    title: "Recruit People Who Can Actually Succeed",
    description: "Good recruiting is accurate filtering, not collecting names. Set expectations early, identify a plausible fit, use the approved application path, and leave every candidate with a clear understanding of what happens next.",
    fields: [
      { name: "The 30-second explanation", value: "“EFP trains people for direct field sales in eligible energy markets. The work is face-to-face, compensation is based on performance, and training and coaching are provided. If you are open to active sales work, the application explains more and gets you to the right contact.”" },
      { name: "Qualify before sending a link", value: "Are they open to door-to-door or direct field sales? • Do they understand performance-based pay? • Can they reliably work the required market and schedule? • Are they willing to train, roleplay, and follow compliance? • What are they actually looking for?" },
      { name: "Set expectations", value: "Explain the nature of the work, active market, schedule, training process, compensation structure, and follow-up timing as accurately as you know them. If you do not know, say so and connect the candidate with someone who does." },
      { name: "Follow-up standard", value: "Confirm the link was received • Let the candidate complete their own application • Record the next action without posting private data • Follow up when promised • Close the loop respectfully if the role is unavailable or not a fit" },
      { name: "Never do this", value: "Promise earnings • Call the role hourly when it is not • Hide door-to-door work • Invent urgency or openings • Guarantee placement or advancement • Misrepresent EFP, a supplier, or a utility • Pressure someone who declined" },
      { name: "Protect candidate information", value: "Applications belong in the approved recruiting system. Never post a candidate’s name, phone, email, résumé, address, screening notes, or other personal details in recruiting channels or forums." },
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
    title: "Eleven-Lesson Certification Roadmap",
    description: "Read, listen, test, practice, and obtain coach sign-off before production.",
    fields: [
      { name: "Foundation", value: "1. Foundation and Field Process\n2. Psychology, Trust, and Reclosing\n3. Arcadia Community Solar" },
      { name: "Products and validation", value: "4. IDT Offer and Disclosures\n5. Transitions, Late Contentions, and Referrals\n6. LMI Document Validation\n7. Utility Bill Validation" },
      { name: "Field readiness", value: "8. Field Standards and Certification\n9. Rebuttal Frameworks and Reclosing" },
      { name: "Workplace protection", value: "10. Workplace Sexual Harassment Prevention\n11. Substance-Free and Fit-for-Duty Standards" },
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
  ...["Francis", "Dennis", "Dave", "Josiah"].map((team) => ({
    channel: `${team.toLowerCase()}-team-live-sales-drops`,
    title: `${team}'s Team | Live Sales Drops`,
    description: `Drop ${team}'s team wins when they happen. Post the completion screenshot with a short caption such as **1**, **Double**, or **9 to go** so the floor can celebrate and keep momentum visible.`,
    fields: [
      { name: "Keep it moving", value: "Post completed sales only. One sale update per message. React, celebrate, and keep the floor momentum visible." },
      { name: "Official totals", value: "This is the real-time hype channel. Submit the EFP Wiki sales tracker at end of day for the official Daily Wall Chart totals." },
    ],
    color: GOLD,
    pin: true,
  })),
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
