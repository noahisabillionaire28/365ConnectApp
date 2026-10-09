/**
 * Terms of Service — structured so the same text renders on /terms, inside
 * the sign-up and acceptance sheets, and in print. Edit the prose here; bump
 * LEGAL.termsVersion (and the server copy) when the change is material.
 */
import { LEGAL, type LegalDocument } from './config';

const C = LEGAL.entityName;
const EMAIL = LEGAL.contactEmail;

export const TERMS: LegalDocument = {
  title: 'Terms of Service',
  shortTitle: 'Terms',
  effectiveDate: LEGAL.termsVersion,
  intro: [
    `These Terms of Service (the "Terms") are a binding agreement between you and ${C} ("${C}," "we," "us," or "our") and govern your access to and use of the 365 Connect website, mobile and web applications, and related services (together, the "Platform"). Please read them carefully. They include an agreement to resolve disputes through binding individual arbitration, a waiver of class actions and jury trials (Section 25), a release (Section 24), and limits on our liability (Section 22).`,
    `By creating an account, tapping "I agree," or otherwise accessing or using the Platform, you accept these Terms and our Privacy Policy, which is incorporated by reference. If you do not agree, do not use the Platform.`,
  ],
  sections: [
    {
      id: 'acceptance',
      heading: '1. Acceptance and eligibility',
      paragraphs: [
        `You must be at least 18 years old and able to form a binding contract to use the Platform. The Platform is not directed to anyone under 18, and we do not knowingly allow minors to register. By using the Platform you represent that you meet these requirements and that you are not barred from using it under the laws of the United States or any other applicable jurisdiction.`,
        `If you use the Platform on behalf of a company, venue, agency, or other organization, you represent that you have authority to bind that organization to these Terms, and "you" includes both you and the organization. The Platform is offered for use in the United States; if you access it from elsewhere you do so on your own initiative and are responsible for compliance with local law.`,
      ],
    },
    {
      id: 'accounts',
      heading: '2. Your account',
      paragraphs: [
        `You must provide accurate, current, and complete information when you register and keep it up to date. You may hold one account per role unless we agree otherwise, and you may not create an account for someone else or transfer your account without our consent.`,
        `You are responsible for keeping your login credentials confidential and for everything that happens under your account, whether or not you authorized it. Tell us immediately at ${EMAIL} if you believe your account has been compromised. We may suspend or close any account that we reasonably believe is being used fraudulently, by the wrong person, or in violation of these Terms.`,
      ],
    },
    {
      id: 'roles',
      heading: '3. Roles and the nature of our relationship',
      paragraphs: [
        `The Platform is an online marketplace and communication tool that lets people who offer event-staffing work ("Workers") find and perform shifts offered by venues, hosts, planners, and other businesses ("Clients"), and by staffing agencies that post shifts, keep rosters, and assign or offer shifts to Workers ("Staffers"). Clients and Staffers are together called "Posters." Some accounts are administered by us ("Admins").`,
        `${C} is a technology provider only. We do not employ Workers, we do not provide staffing services, and we are not a staffing agency, employment agency, labor contractor, payroll provider, or payment agent. We are not a party to any engagement between a Worker and a Poster, we do not supervise, direct, or control the work performed, and we do not set wages, schedules, or working conditions, which are agreed between the Worker and the Poster.`,
        `Nothing in these Terms or in your use of the Platform creates an employment, agency, partnership, joint-venture, or franchise relationship between you and ${C}. Workers are independent contractors of the Poster who engages them or are otherwise self-employed, unless the Worker and the Poster agree to a different relationship between themselves. Each Poster is solely responsible for determining the correct classification of the Workers it engages under federal, state, and local law, and for all consequences of that determination.`,
      ],
    },
    {
      id: 'contractor-acknowledgment',
      heading: '4. Independent Contractor Acknowledgment',
      paragraphs: [
        `Both Workers and Posters acknowledge and agree to the following:`,
      ],
      bullets: [
        `${C} does not hire, fire, pay, schedule, train, supervise, discipline, or evaluate Workers, and does not control how, when, or where any shift is performed. Any ratings, match insights, or arrival indicators on the Platform are information shared between users, not supervision by us.`,
        `Workers are free to accept or decline any shift, to work for other businesses and through other platforms, and to set the terms on which they offer their services. Workers supply their own skills, licences, and, unless the Poster provides them, their own tools and attire.`,
        `The Poster who engages a Worker is the party responsible for paying the Worker, for complying with all wage-and-hour, tax-withholding, workers'-compensation, anti-discrimination, and workplace-safety laws that apply to that engagement, and for determining whether the Worker is properly treated as an independent contractor or as an employee of the Poster.`,
        `Workers are responsible for reporting and paying their own income and self-employment taxes and for carrying any insurance they consider appropriate. ${C} does not issue tax forms for amounts paid by Posters to Workers outside the Platform.`,
        `Neither Workers nor Posters are employees, agents, or representatives of ${C}, may not hold themselves out as such, and have no authority to bind us.`,
      ],
    },
    {
      id: 'poster-obligations',
      heading: '5. Poster obligations',
      paragraphs: [
        `If you post shifts, you agree that you will:`,
      ],
      bullets: [
        `Post only genuine, lawful work, and describe each shift accurately, including the role, date, time, location, dress code, duties, pay rate, and any requirements (such as a food-handler card or a responsible-beverage-service certificate).`,
        `Pay every Worker you engage the pay you advertised, at or above the applicable federal, state, and local minimum wage, and comply with all laws on overtime, meal and rest breaks, tips and gratuities, reporting-time pay, expense reimbursement, pay frequency, and wage statements.`,
        `Provide a safe worksite that complies with occupational-safety, fire, alcohol-service, food-safety, and permit requirements, and give Workers any site-specific safety information or equipment the law requires.`,
        `Carry the insurance required of you by law or by your venue, including workers'-compensation coverage where it applies to the Workers you engage, and general-liability coverage appropriate to your event.`,
        `Not discriminate against, harass, or retaliate against any Worker on the basis of race, color, religion, sex, sexual orientation, gender identity, national origin, age, disability, pregnancy, veteran status, or any other characteristic protected by law, and not use the Platform's filters or messaging to do so.`,
        `Review and approve or dispute each timesheet promptly (and in any case within the window shown in the app), make only good-faith, documented adjustments to hours, and pay approved amounts on time.`,
        `Hold any required business licences, event permits, and liquor licences, and verify any Worker credential that the law requires you, rather than the Worker, to verify.`,
      ],
    },
    {
      id: 'worker-obligations',
      heading: '6. Worker obligations',
      paragraphs: [
        `If you accept shifts, you agree that you will:`,
      ],
      bullets: [
        `Keep your profile accurate, including your name, photo, skills, certifications, and availability, and not misrepresent your experience, identity, or eligibility to work in the United States.`,
        `Hold and keep current every licence, permit, or certification that the shift or the law requires, and provide proof on request from the Poster.`,
        `Show up on time, ready to work, for every shift you have claimed or been assigned, follow the Poster's lawful and reasonable instructions, and conduct yourself professionally and safely.`,
        `Clock in and out honestly and only when you are actually at the worksite, and report hours truthfully.`,
        `Report and pay your own taxes, and maintain any insurance you consider appropriate for your work.`,
        `Not use another person's account, let anyone else work a shift under your name, or send a substitute without the Poster's approval through the Platform's swap feature.`,
      ],
    },
    {
      id: 'bookings',
      heading: '7. Bookings, cancellations, no-shows, call-outs and swaps',
      paragraphs: [
        `Posters may offer shifts to the public, to their roster, or to specific Workers, and may enable instant claim, applications, waitlists, and assignments. A booking is formed when a Poster accepts a Worker's application, a Worker claims an instantly claimable spot, or a Worker accepts an offer or assignment. Shift details, including pay, are set by the Poster; we display them but do not guarantee them.`,
        `The Platform provides tools to cancel a shift, withdraw from a booking, call out, request a swap, and manage waitlists. When a Worker withdraws, calls out, or is removed, the Worker's spot is released and may be offered to the waitlist or reopened at the Poster's choice. Repeated late cancellations, no-shows, or last-minute shift cancellations may lower a user's standing on the Platform, limit access to features such as instant claim, or lead to suspension.`,
        `Any compensation, cancellation fee, or other remedy for a late cancellation or no-show is a matter between the Worker and the Poster, subject to applicable law. ${C} does not owe or collect such amounts and does not adjudicate them, although we may provide records (such as timestamps and messages) to the parties on request.`,
        `A swap lets a booked Worker propose that another eligible Worker take their spot. Swaps take effect only when accepted through the Platform; informal substitutions are a breach of these Terms.`,
      ],
    },
    {
      id: 'timesheets',
      heading: '8. Clock-in location data and timesheets',
      paragraphs: [
        `To help Posters confirm attendance, the Platform may require a Worker to clock in and out from within a geofenced distance of the worksite. When you clock in or out we collect your device's precise location at that moment; we do not track your location continuously. If you decline location permission, you may still be able to request a manual clock-in that the Poster must approve.`,
        `Clock-in and clock-out times, breaks, and any manual entries form a timesheet. The Poster reviews the timesheet and may approve it, adjust hours with a reason, or dispute it. The Worker can see every adjustment and may raise a dispute in the app. The parties agree to use the Platform's dispute tools and to communicate in good faith to resolve differences.`,
        `${C} does not decide pay disputes and has no authority to order either party to pay or accept any amount. We may, at our discretion, facilitate a conversation, share the records we hold, flag a pattern of disputes, or limit a user's access to the Platform. Nothing we do in that role makes us a party to the engagement or responsible for any amount owed.`,
      ],
    },
    {
      id: 'payments',
      heading: '9. Payments, fees and taxes',
      paragraphs: [
        `Pay for shifts is owed by the Poster to the Worker. Depending on the features available to you, payment may be made outside the Platform and simply recorded in the app ("recorded as paid"), or processed through a third-party payment processor, currently Stripe, when that feature is enabled. When Stripe processes a payment, Stripe's terms and privacy policy apply to the payment itself, and you authorize the charges you initiate. We never store full card numbers.`,
        `${C} is not a payment agent, bank, money transmitter, or escrow service, and does not guarantee that any Poster will pay or that any Worker will be paid, unless we expressly state otherwise in writing for a specific feature. Where we do act as a limited payment collection agent for a specific feature, we will say so clearly in the app before you use it.`,
        `${C} currently charges no fees to Posters or Workers. We may in the future charge Posters, Workers, or both a service fee or subscription fee (for example, a Pro subscription) for using parts of the Platform. Fees are disclosed before you incur them, may change with notice, never apply to a shift posted or booked before the change, and are non-refundable except as required by law or as stated in our Refund & Cancellation Policy or at the point of purchase. Subscriptions renew automatically until cancelled in the app or through the app store you purchased from.`,
        `If a payment you make is charged back, reversed, or disputed with your bank, you remain liable for the amount owed and for any fees we incur, and we may suspend your account until the matter is resolved. You are responsible for all taxes that apply to amounts you pay or receive through or in connection with the Platform, including sales, use, income, and self-employment taxes. We may issue tax forms where the law requires us to for payments we process.`,
      ],
      links: [{ label: 'Refund & Cancellation Policy', page: 'refunds' }],
    },
    {
      id: 'ratings',
      heading: '10. Ratings and reviews',
      paragraphs: [
        `After a shift, Workers and Posters may rate and review each other. Reviews must be honest, based on your own experience, and free of harassment, discrimination, personal information about others, or threats. Ratings are the opinions of the users who leave them, not ours; we do not verify them and we are not responsible for their content.`,
        `We may remove or hide a review that violates these Terms or that we reasonably believe is fraudulent, retaliatory, or unrelated to the shift, but we are not obliged to review every rating and you should not rely on ratings alone when deciding whom to work with. You may not offer or accept anything of value in exchange for a review, or leave reviews from multiple accounts.`,
      ],
    },
    {
      id: 'content',
      heading: '11. Your content',
      paragraphs: [
        `"Content" means anything you post, upload, or send through the Platform, including profile text and photos, shift descriptions, posts, stories, comments, messages, attachments (images, video, audio, and PDF files), reviews, and timesheet notes. You own your Content. By providing it you grant ${C} a worldwide, non-exclusive, royalty-free, sublicensable licence to host, store, reproduce, adapt (for example, to resize or transcode), display, and distribute it as needed to operate, improve, promote, and secure the Platform, to the people you share it with, and as described in our Privacy Policy. This licence ends when you delete the Content or your account, except for Content that others have already received, copies in routine backups, and Content we must keep for legal reasons.`,
        `You represent that you have all rights needed to grant this licence and that your Content does not infringe anyone's rights or violate any law. You may not post Content that is unlawful, defamatory, obscene, sexually explicit, hateful, harassing, violent, deceptive, infringing, that discloses someone else's private information without permission, that contains malware, or that advertises unrelated goods or services. Posts and stories are visible to other signed-in users; do not share anything you would not want other members to see.`,
        `We do not pre-screen Content, but we may remove or restrict access to any Content at any time, with or without notice, if we believe it violates these Terms or creates risk for us or other users.`,
      ],
    },
    {
      id: 'prohibited',
      heading: '12. Prohibited conduct',
      paragraphs: [
        `In addition to the rules elsewhere in these Terms, you agree not to:`,
      ],
      bullets: [
        `Use the Platform for any unlawful purpose, or to post or perform work that is illegal or requires a licence you do not hold.`,
        `Harass, threaten, stalk, discriminate against, or defraud any other user, or contact a user for purposes unrelated to the Platform after they have asked you to stop or blocked you.`,
        `Submit false clock-in locations, falsify hours, create fake shifts, applications, ratings, or accounts, or manipulate waitlists, match insights, or ratings.`,
        `Scrape, crawl, copy, or harvest data from the Platform, use automated means to access it, or build a competing database of users or shifts.`,
        `Reverse engineer, decompile, probe, or interfere with the Platform's security, rate limits, or infrastructure, or access another user's account or data.`,
        `Send spam or unsolicited commercial messages, or use the Platform's messaging or push notifications to distribute unrelated advertising.`,
        `Record, photograph, or publish images of other users or worksites without consent where consent is required by law or by the Poster.`,
      ],
    },
    {
      id: 'off-platform',
      heading: '13. Off-platform dealings',
      paragraphs: [
        `Users may choose to work together outside the Platform. We do not restrict that, but anything that happens off the Platform, including payment, scheduling, and conduct, is entirely between the parties, is not covered by the Platform's records, timesheets, ratings, or dispute tools, and is at your own risk. ${C} has no responsibility for off-platform arrangements and will not mediate them.`,
      ],
    },
    {
      id: 'communications',
      heading: '14. Communications',
      paragraphs: [
        `By creating an account you agree to receive transactional and service communications from us and from the users you interact with through the Platform, including push notifications, in-app notifications, and email about bookings, shift changes, messages, timesheets, payments, security, and changes to these Terms. You can control push and email preferences in Settings, except for messages we must send for legal or security reasons. We do not send marketing SMS messages, and we will not send you text messages unless you expressly opt in to a texting feature in the future.`,
        `Communications between users through the Platform's chat are not private as to us: we store them, may review them in response to a report or a legal request, and may use automated tools to detect abuse, as described in the Privacy Policy.`,
      ],
    },
    {
      id: 'ip',
      heading: '15. Intellectual property',
      paragraphs: [
        `The Platform, including its software, design, text, graphics, logos, and the "365 Connect" name and marks, is owned by ${C} or its licensors and is protected by copyright, trademark, and other laws. Subject to these Terms, we grant you a limited, revocable, non-exclusive, non-transferable licence to use the Platform and to install the app on devices you own or control for your personal or internal business use. You may not copy, modify, distribute, sell, lease, or create derivative works from any part of the Platform, or use our marks without our written permission.`,
        `If you send us ideas, suggestions, or feedback, you grant us the right to use them without restriction or compensation. The app may include open-source components licensed under their own terms, which are available on request.`,
      ],
    },
    {
      id: 'third-party',
      heading: '16. Third-party services',
      paragraphs: [
        `The Platform depends on services operated by others, including hosting (Vercel), database, authentication, and file storage (Supabase), email delivery (Resend), payment processing (Stripe), push notifications and maps (Apple), map tiles (OpenStreetMap contributors and CARTO), address search (Nominatim, run by the OpenStreetMap Foundation), default shift photos (Unsplash), web fonts (Google), and an automated-matching processor (Anthropic). Your use of those services through the Platform is subject to their terms where they apply to you directly, such as Apple's app store terms or Stripe's terms for payments you make. We are not responsible for third-party services, for links to third-party websites, or for the acts of any venue, Poster, or Worker.`,
      ],
      links: [{ label: 'Cookie & Local Storage Policy', page: 'cookies' }],
    },
    {
      id: 'beta-ai',
      heading: '17. Beta features and automated matching',
      paragraphs: [
        `We may label some features as beta, preview, or early access. Those features may change, break, or be withdrawn at any time, and are provided without any warranty.`,
        `The Platform may show "match" scores, insights, or suggestions about which shifts or Workers might be a good fit. These are generated by rules and by an automated processor that receives non-identifying shift and work-history signals, as described in the Privacy Policy. They are informational only: they are not a recommendation, a guarantee that a shift exists or will be filled, an assessment of anyone's character or legal eligibility, or a decision by us. Every booking is decided by the Poster and the Worker, and you should use your own judgment.`,
      ],
    },
    {
      id: 'dmca',
      heading: '18. Copyright complaints (DMCA)',
      paragraphs: [
        `We respect intellectual-property rights and respond to notices that comply with the Digital Millennium Copyright Act. If you believe Content on the Platform infringes your copyright, send a notice to ${EMAIL} (or by mail to the address in Section 30) that includes: your physical or electronic signature; identification of the copyrighted work; identification of the material you claim is infringing and enough information for us to locate it; your contact details; a statement that you have a good-faith belief the use is not authorized by the copyright owner, its agent, or the law; and a statement, under penalty of perjury, that the notice is accurate and that you are the owner or authorized to act for the owner.`,
        `If we remove Content in response to a notice, we will try to notify the user who posted it, who may send a counter-notice meeting the requirements of 17 U.S.C. § 512(g). We terminate the accounts of repeat infringers in appropriate circumstances.`,
      ],
    },
    {
      id: 'termination',
      heading: '19. Suspension and termination',
      paragraphs: [
        `You may stop using the Platform at any time and may delete your account in Settings. Deletion is refused only while you have an upcoming booking or an open posted shift that other people are counting on; withdraw or cancel those first.`,
        `We may suspend, restrict, or terminate your access to all or part of the Platform at any time, with or without notice, if we reasonably believe you have violated these Terms, created risk or legal exposure for us or other users, failed to pay amounts owed, or if we discontinue the Platform. Where practical we will tell you why and give you a chance to respond. Sections that by their nature should survive (including Sections 3, 4, 9, 11, 13, 15, and 20 through 30) survive termination.`,
      ],
    },
    {
      id: 'disclaimers',
      heading: '20. Disclaimers',
      paragraphs: [
        `THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT, TO THE FULLEST EXTENT PERMITTED BY LAW.`,
        `WITHOUT LIMITING THE ABOVE, ${C.toUpperCase()} DOES NOT GUARANTEE THAT ANY SHIFT WILL BE AVAILABLE OR FILLED, THAT ANY WORKER WILL SHOW UP OR PERFORM, THAT ANY POSTER WILL PAY, THAT ANY WORKSITE IS SAFE, THAT ANY USER IS WHO THEY SAY THEY ARE, OR THAT ANY RATING, MATCH INSIGHT, LOCATION READING, OR TIMESHEET IS ACCURATE. WE DO NOT CONDUCT BACKGROUND CHECKS, IDENTITY VERIFICATION, DRUG TESTING, OR CREDENTIAL VERIFICATION OF ANY USER, AND WE MAKE NO REPRESENTATION ABOUT ANY USER'S SUITABILITY, LICENSURE, LEGAL ELIGIBILITY TO WORK, OR CONDUCT. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.`,
        `Some jurisdictions do not allow the exclusion of certain warranties, so some of the above may not apply to you.`,
      ],
    },
    {
      id: 'assumption-of-risk',
      heading: '21. Assumption of risk',
      paragraphs: [
        `Event-staffing work involves inherent risks, including physical labor, late hours, travel, alcohol service, crowded venues, and interactions with strangers. You acknowledge that ${C} does not control any worksite or any user, and you voluntarily assume all risks arising from meeting, working with, or engaging other users, from attending any worksite, and from relying on information other users provide, to the fullest extent permitted by law.`,
      ],
    },
    {
      id: 'liability',
      heading: '22. Limitation of liability',
      paragraphs: [
        `TO THE FULLEST EXTENT PERMITTED BY LAW, ${C.toUpperCase()} AND ITS OWNERS, OFFICERS, EMPLOYEES, CONTRACTORS, AND AGENTS (THE "${C.toUpperCase()} PARTIES") WILL NOT BE LIABLE TO YOU FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, WAGES, BUSINESS, GOODWILL, OR DATA, OR FOR PERSONAL INJURY OR PROPERTY DAMAGE ARISING FROM ANY SHIFT, WORKSITE, OR INTERACTION WITH ANOTHER USER, WHETHER BASED ON CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY, OR ANY OTHER THEORY, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.`,
        `TO THE FULLEST EXTENT PERMITTED BY LAW, THE TOTAL LIABILITY OF THE ${C.toUpperCase()} PARTIES FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE PLATFORM WILL NOT EXCEED THE GREATER OF (A) ONE HUNDRED U.S. DOLLARS ($100) OR (B) THE TOTAL FEES YOU PAID TO ${C.toUpperCase()} IN THE TWELVE (12) MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM. AMOUNTS PAID BY A POSTER TO A WORKER ARE NOT FEES PAID TO ${C.toUpperCase()}.`,
        `These limits do not apply to liability that cannot be limited by law, including liability for gross negligence, fraud, or willful misconduct where such limits are prohibited, and do not limit any non-waivable consumer rights you may have. Each provision of this Section is intended to be severable and to apply to the maximum extent permitted.`,
      ],
    },
    {
      id: 'indemnification',
      heading: '23. Indemnification',
      paragraphs: [
        `To the fullest extent permitted by law, you agree to defend, indemnify, and hold harmless the ${C} Parties from and against all claims, demands, losses, liabilities, damages, judgments, fines, penalties, costs, and expenses (including reasonable attorneys' fees) arising out of or relating to: (a) your use of the Platform or your Content; (b) your breach of these Terms or of any law or third-party right; (c) if you are a Poster, your engagement of any Worker, including claims that a Worker was misclassified or was your or our employee, wage-and-hour and tip claims, tax or withholding claims, workers'-compensation and unemployment-insurance claims, discrimination or harassment claims, and injuries, illness, or property damage occurring at or in connection with your worksite or event; (d) if you are a Worker, your performance of or failure to perform any shift, your conduct at a worksite, and your tax obligations; and (e) any dispute between you and another user.`,
        `We may assume the exclusive defense and control of any matter subject to indemnification, in which case you agree to cooperate with us. You may not settle any claim in a way that imposes obligations on us without our written consent.`,
      ],
    },
    {
      id: 'release',
      heading: '24. Release',
      paragraphs: [
        `Because ${C} is not a party to the dealings between Workers and Posters, if you have a dispute with one or more other users (including about work performed, pay, injuries, conduct, or Content), you release the ${C} Parties from all claims, demands, and damages of every kind, known and unknown, suspected and unsuspected, disclosed and undisclosed, arising out of or in any way connected with that dispute, to the fullest extent permitted by law.`,
        `IF YOU ARE A CALIFORNIA RESIDENT, YOU WAIVE CALIFORNIA CIVIL CODE § 1542, WHICH SAYS: "A GENERAL RELEASE DOES NOT EXTEND TO CLAIMS THAT THE CREDITOR OR RELEASING PARTY DOES NOT KNOW OR SUSPECT TO EXIST IN HIS OR HER FAVOR AT THE TIME OF EXECUTING THE RELEASE AND THAT, IF KNOWN BY HIM OR HER, WOULD HAVE MATERIALLY AFFECTED HIS OR HER SETTLEMENT WITH THE DEBTOR OR RELEASED PARTY." If you are a resident of another state, you waive any comparable statute to the extent permitted by law.`,
      ],
    },
    {
      id: 'disputes',
      heading: '25. Dispute resolution: informal resolution, binding arbitration, class action and jury waiver',
      paragraphs: [
        `PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT AND TO HAVE A JURY HEAR YOUR CLAIMS.`,
        `Informal resolution first. Before starting arbitration or any court proceeding, you and ${C} agree to try to resolve the dispute informally. The party raising the dispute must send the other a written notice describing the claim, the facts, and the relief sought. Send notice to us at ${EMAIL} or to the mailing address in Section 30; we will send notice to the email address on your account. The parties agree to confer in good faith (by phone or video if either asks) and may not begin arbitration or litigation until 30 days after the notice is received. Any statute of limitations is paused during this period.`,
        `Binding individual arbitration. If the dispute is not resolved within 30 days, any dispute, claim, or controversy arising out of or relating to these Terms, the Privacy Policy, or the Platform, including its formation, interpretation, enforceability, or scope and including claims against the ${C} Parties, will be resolved by final and binding arbitration administered by the American Arbitration Association ("AAA") under its Consumer Arbitration Rules (or, if the AAA is unavailable, by JAMS under its Streamlined Arbitration Rules), as modified by these Terms. The Federal Arbitration Act governs this agreement to arbitrate. The arbitrator, not a court, decides all questions of arbitrability, except that a court decides whether the class-action waiver below is enforceable. The arbitration will be conducted in the county where you live or by video conference, in English, before a single arbitrator who may award the same individual relief a court could. Each party bears its own fees and costs except that, for claims under $10,000, we will pay the AAA filing and arbitrator fees that exceed what you would have paid to file in court, unless the arbitrator finds the claim frivolous. Judgment on the award may be entered in any court with jurisdiction.`,
        `CLASS ACTION AND JURY WAIVER. YOU AND ${C.toUpperCase()} AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN AN INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, CONSOLIDATED, OR REPRESENTATIVE PROCEEDING. THE ARBITRATOR MAY NOT CONSOLIDATE MORE THAN ONE PERSON'S CLAIMS OR PRESIDE OVER ANY FORM OF CLASS OR REPRESENTATIVE PROCEEDING. TO THE FULLEST EXTENT PERMITTED BY LAW, YOU AND ${C.toUpperCase()} EACH WAIVE THE RIGHT TO A TRIAL BY JURY. If this class-action waiver is found unenforceable as to a particular claim or request for relief, then that claim or request (and only that claim or request) will be severed and decided in court, and the remaining claims will be arbitrated.`,
        `Small-claims carve-out. Either party may bring an individual claim in small-claims court in the county where you live or in ${LEGAL.venueCounty}, ${LEGAL.governingLaw}, if it qualifies, and either party may seek injunctive relief in court to protect intellectual-property rights or to stop unauthorized use of the Platform. Nothing in this Section prevents you from filing a complaint with a government agency.`,
        `30-day opt-out. You may opt out of this agreement to arbitrate by emailing ${EMAIL} within 30 days after you first accept these Terms, with the subject line "Arbitration opt-out," your full name, and the email address on your account. Opting out does not affect any other part of these Terms, and if you opt out, disputes will be resolved in the courts described in Section 26. If we materially change this Section in the future, you may reject the change by sending the same notice within 30 days after the change takes effect, in which case the prior version continues to apply to disputes between us.`,
      ],
    },
    {
      id: 'governing-law',
      heading: '26. Governing law and venue',
      paragraphs: [
        `These Terms and any dispute between you and ${C} are governed by the laws of the State of ${LEGAL.governingLaw} and the Federal Arbitration Act, without regard to conflict-of-laws rules, except where the law of your state of residence gives you non-waivable protections. For any matter that is not subject to arbitration, or if the agreement to arbitrate does not apply to you, you and ${C} consent to the exclusive jurisdiction and venue of the state and federal courts located in ${LEGAL.venueCounty}, ${LEGAL.governingLaw}, and waive any objection to that venue.`,
      ],
    },
    {
      id: 'changes',
      heading: '27. Changes to these Terms',
      paragraphs: [
        `We may update these Terms from time to time. When we make a material change we will post the new version with a new effective date, notify you by email or in-app notice, and ask you to accept the updated Terms the next time you open the app. Your continued use of the Platform after a change takes effect, or your in-app acceptance, means you accept the change. If you do not agree, you must stop using the Platform and may delete your account. Changes do not apply retroactively to disputes that arose before the change took effect.`,
      ],
    },
    {
      id: 'general',
      heading: '28. General terms',
      paragraphs: [
        `Entire agreement. These Terms, the Privacy Policy, and any feature-specific terms we present to you in the app make up the entire agreement between you and ${C} about the Platform and supersede any earlier agreements.`,
        `Severability. If any part of these Terms is found invalid or unenforceable, that part will be enforced to the maximum extent permitted and the rest will remain in full effect, except as stated in Section 25 for the class-action waiver.`,
        `Assignment. You may not assign or transfer these Terms or your account without our written consent. We may assign these Terms to an affiliate or to a successor in connection with a merger, acquisition, reorganization, or sale of assets, and these Terms bind and benefit the parties' permitted successors and assigns.`,
        `Force majeure. We are not liable for any delay or failure caused by events beyond our reasonable control, including natural disasters, epidemics, war, terrorism, labor disputes, government action, power or internet failures, or failures of third-party services.`,
        `No waiver; interpretation. Our failure to enforce any provision is not a waiver of our right to do so later. Headings are for convenience only. "Including" means "including without limitation." Notices to you may be sent to the email address on your account or shown in the app.`,
      ],
    },
    {
      id: 'apple',
      heading: '29. Additional terms for the iOS app',
      paragraphs: [
        `If you downloaded the app from Apple's App Store, you acknowledge that these Terms are between you and ${C} only, not Apple; that Apple has no obligation to furnish maintenance or support for the app; that Apple is not responsible for addressing any claims relating to the app or your use of it, including product-liability, consumer-protection, and intellectual-property claims; and that Apple and its subsidiaries are third-party beneficiaries of these Terms and may enforce them against you. Your use of the app must also comply with the App Store's usage rules.`,
      ],
    },
    {
      id: 'contact',
      heading: '30. Contact',
      paragraphs: [
        `Questions about these Terms, notices of dispute, arbitration opt-outs, and copyright notices can be sent to ${C} at ${EMAIL} or by mail to: ${LEGAL.mailingAddress}.`,
        `${C} is currently operated by an individual and a small team based in ${LEGAL.governingLaw}, United States. ${LEGAL.entityNote}.`,
      ],
    },
  ],
};
