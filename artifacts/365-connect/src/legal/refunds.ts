/**
 * Refund & Cancellation Policy — informational (not part of the acceptance
 * set). Rendered at /refunds and linked from the Terms' payments section, the
 * Pro screen and every place money is mentioned. Edit the prose here; bump
 * LEGAL.refundsVersion when the change is material.
 */
import { LEGAL, type LegalDocument } from './config';

const C = LEGAL.entityName;
const EMAIL = LEGAL.contactEmail;

export const REFUNDS: LegalDocument = {
  title: 'Refund & Cancellation Policy',
  shortTitle: 'Refunds & Cancellations',
  effectiveDate: LEGAL.refundsVersion,
  intro: [
    `This policy explains what happens with money on 365 Connect: the fees ${C} charges (none today), the Pro subscription if and when it can be bought, payments between posters and workers, and cancellations and no-shows. It supplements our Terms of Service; if the two conflict, this policy governs refunds and cancellations.`,
    `In short: ${C} currently charges nothing to workers or posters, is not the payer on any shift, and does not charge cancellation fees. Pay for a shift is owed by the poster to the worker, and any refund of that pay is between the two of them.`,
  ],
  sections: [
    {
      id: 'platform-fees',
      heading: '1. Platform fees',
      paragraphs: [
        `${C} currently charges no fees to workers or posters. Posting a shift, applying, booking, clocking in and out, timesheets, messaging, and recording a payment are all free, and we take no percentage of a worker's pay. The cost estimates you see when posting a shift are the pay you will owe the workers, with a platform fee of $0.`,
        `If we introduce a fee in the future (for example a service fee on a shift or a subscription), we will show the exact amount before you pay it, you will have to confirm it, and it will never be added to a shift that was posted or booked before the change. Existing bookings keep the terms they were made under.`,
      ],
    },
    {
      id: 'pro',
      heading: '2. Pro subscription',
      paragraphs: [
        `365 Connect Pro is not available to purchase yet. The Pro screen in the app shows the planned price and benefits so you know what is coming; no card is charged and nothing renews. If you see a Pro badge on a profile today, it was granted by us, not bought.`,
        `When Pro can be purchased, the following will apply:`,
      ],
      bullets: [
        `The price, billing period and what is included are shown before you buy, and you confirm the purchase yourself.`,
        `Pro renews automatically at the end of each billing period until you cancel. We will tell you the renewal price before any increase takes effect.`,
        `You can cancel at any time in Settings → Upgrade to Pro, or, for a purchase made through the Apple App Store, in your Apple ID subscription settings. Cancelling stops the next renewal; you keep Pro until the end of the period you already paid for.`,
        `First purchase: if you ask within 14 days of your first Pro purchase, we will refund it in full, no questions asked. Email ${EMAIL} from the address on your account.`,
        `Renewals: we do not refund a renewal once it has been charged, and we do not give partial refunds for the unused part of a billing period, except where the law requires it or Pro was unavailable for a significant part of the period because of a problem on our side.`,
        `App Store purchases: a subscription bought through Apple is billed and refunded by Apple under Apple's terms. Request those refunds at reportaproblem.apple.com; we cannot issue them ourselves.`,
      ],
    },
    {
      id: 'shift-pay',
      heading: '3. Payments between posters and workers',
      paragraphs: [
        `Pay for a shift is owed by the poster to the worker. ${C} is not the payer, employer, payment agent or escrow service for any shift (see Section 9 of the Terms). Today most pay is handed over outside the app and simply recorded as paid by the poster; a worker then sees it on their pay timeline. Because we never hold that money, we cannot refund or reverse it.`,
        `Disagreements about pay or hours are between the worker and the poster. The app gives you tools to sort them out: the poster approves a timesheet (and can adjust hours with a reason), the worker can confirm the hours or open a dispute from the shift page, and both sides can message each other. If you cannot agree, you may use any remedy available to you under the law; we may share the records we hold (clock-in and clock-out times, locations, approvals, messages) with either party on request, but we do not decide who is right and cannot order anyone to pay.`,
        `When card payments through Stripe are enabled: the poster pays the approved amount by card and Stripe processes it under Stripe's terms. A card payment can only be refunded by the party who received it, through Stripe; ask the poster first, and contact us at ${EMAIL} if you need the payment records. If a poster disputes a card payment with their bank (a chargeback) after a worker has been paid, the poster remains responsible for the pay they owe and their account may be suspended until it is resolved. We add no fee to card payments today; if Stripe's processing cost is ever passed on, it will be shown before you pay.`,
      ],
    },
    {
      id: 'cancellations',
      heading: '4. Cancellations and no-shows',
      paragraphs: [
        `${C} charges no cancellation fees, to anyone, for anything: cancelling a shift, withdrawing from a booking, calling out, declining a swap or removing a worker are all free in the app.`,
        `Posters and workers may make their own arrangements about late cancellations (for example a poster who promises a minimum call-out payment, or a worker who asks for one). Those arrangements are between the two of them, must comply with the law (including reporting-time pay rules where they apply), and we do not collect, hold or enforce them.`,
        `Reliability still matters. Repeated late cancellations or no-shows by a worker, and repeated last-minute shift cancellations by a poster, may lower your standing on the platform, limit features such as instant claim, and can lead to suspension under Section 19 of the Terms. We look at the pattern and the circumstances, and we will tell you before taking action where practical.`,
      ],
    },
    {
      id: 'request',
      heading: '5. How to request a refund',
      paragraphs: [
        `For anything ${C} charged you (there is nothing today; in future, Pro bought directly from us), email ${EMAIL} from the email address on your account with the subject "Refund request", the date of the charge and the reason. We reply within 10 business days and, where a refund is due, send it to the original payment method within a further 10 business days.`,
        `For pay owed by a poster, ask the poster through the app first; the shift's message thread and dispute tool are the quickest route. For a purchase made through Apple, use Apple's refund process. For a card payment made through Stripe, the refund is issued by the person who received it.`,
      ],
      links: [{ label: 'Payments, fees and taxes in the Terms of Service', page: 'terms' }],
    },
    {
      id: 'changes',
      heading: '6. Changes to this policy',
      paragraphs: [
        `We may update this policy as features change (for example when Pro or card payments go live). The effective date at the top tells you which version you are reading. A change never applies to a charge made before it took effect. Questions: ${EMAIL}.`,
      ],
    },
  ],
};
