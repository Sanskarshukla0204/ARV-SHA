import { formatINR } from './format';
import type { StoreSettings } from './settings';
import { SITE } from './site';

// Text for the legal pages. It describes what the store really does, and the figures come from the admin settings so
// the pages never disagree with the checkout. Have a lawyer review it before launch (see README).

export interface Block {
  h: string;
  p?: string[];
  ul?: string[];
}

const days = (n: number) => `${n} business ${n === 1 ? 'day' : 'days'}`;

export function legalContent(slug: string, s: StoreSettings): Block[] | null {
  const b = s.business;
  const sh = s.shipping;
  const po = s.policies;
  const name = SITE.name;
  const seller = b.legalName || name;
  const contact = [b.supportEmail && `email ${b.supportEmail}`, b.supportPhone && `phone ${b.supportPhone}`].filter(Boolean).join(' or ') || 'the contact form on our Support page';
  const grievance = b.grievanceName
    ? `${b.grievanceName}${b.grievanceEmail ? `, ${b.grievanceEmail}` : ''}${b.grievancePhone ? `, ${b.grievancePhone}` : ''}`
    : 'the contact details on our Support page';
  const shipFee = sh.freeAbovePaise === null ? `${formatINR(sh.flatPaise)} per order` : `${formatINR(sh.flatPaise)} per order, free on orders of ${formatINR(sh.freeAbovePaise)} or more`;

  switch (slug) {
    case 'privacy-policy':
      return [
        { h: 'Who we are', p: [`${name} is operated by ${seller}${b.address ? `, ${b.address}` : ''}. We are the data fiduciary for the personal data described here. This policy follows the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.`] },
        {
          h: 'What we collect',
          ul: [
            'Account data: your name, date of birth, email address, mobile number and a customer ID. If you register with a password we store only an Argon2id hash of it. Nobody at the store can read your password.',
            'Truecaller login: if you use it, Truecaller confirms your name and verified mobile number to us. We do not receive your contacts.',
            'Order data: items, delivery address, contact details, payment status and Razorpay reference numbers. We never receive or store your card, UPI PIN or netbanking details. Those go straight to Razorpay.',
            'Security data: the IP address and browser type for sign-ups, logins and active sessions, so we can detect abuse and show you where you are logged in.',
            'Support data: what you write to us and the details you give.',
            'Bag data: the items in your bag, linked to your account or to a cookie on your device.',
          ],
        },
        {
          h: 'Why we use it',
          ul: [
            'To create your account, log you in and keep it secure.',
            'To take payment, deliver your order, handle returns and refunds and answer your questions.',
            'To send service emails such as verification, password reset, order confirmation and shipping updates.',
            'To keep records the law requires, such as tax and accounting records.',
            'To send marketing email only if you opted in. You can opt out in Account settings at any time.',
          ],
        },
        {
          h: 'Who receives it',
          p: ['We share data only with service providers that help us run the store, and only what each needs:'],
          ul: [
            'Neon: hosts our database in a managed Postgres service.',
            'Vercel: hosts the website and stores product images.',
            'Razorpay: processes payments and refunds.',
            'Resend: delivers our emails.',
            'Cloudflare Turnstile: checks that a form is submitted by a person. It receives your IP address and browser signals.',
            'Truecaller: only if you choose Truecaller login.',
            'An SMS provider: only if mobile verification is switched on, to send you a code.',
            'Courier partners: your name, address and mobile number so they can deliver.',
            'India Post PIN code service: receives only the PIN code you type, to check it matches the state.',
            'Have I Been Pwned: receives the first five characters of a one-way hash of a new password, so we can reject passwords found in known breaches. Your password is never sent.',
          ],
        },
        { h: 'We do not sell your data', p: ['We do not sell your personal data and we do not use it for advertising profiles. We currently run no analytics or advertising trackers.'] },
        {
          h: 'How long we keep it',
          ul: [
            'Account data: until you delete your account.',
            'Order records: eight years, because tax and company law require it. After you delete your account these records are no longer linked to a profile.',
            'Login and security records: 180 days, then deleted.',
            'Sign-in sessions: removed a few days after they expire or are revoked.',
            'Support messages: up to three years.',
          ],
        },
        {
          h: 'Your rights',
          p: ['You can ask to see, correct, update or delete your personal data, withdraw consent and nominate someone to exercise your rights if you die or cannot act for yourself.'],
          ul: [
            'You can correct your details and addresses and delete your account yourself in Account settings.',
            `For anything else, contact ${contact}. We reply within 30 days.`,
            'If we have not resolved your complaint you can complain to the Data Protection Board of India.',
          ],
        },
        { h: 'Security', p: ['We protect data with encryption in transit, hashed passwords, limits on login attempts, signed sessions and restricted access to our systems. See the Security Policy for detail. No system is perfectly secure, and we will tell affected people and the authorities if a breach occurs, as the law requires.'] },
        { h: 'Children', p: ['The store is for people aged 18 or older. We do not knowingly collect data from children. If you believe a child has registered, contact us and we will delete the account.'] },
        { h: 'Grievance officer', p: [`Complaints about your data or an order can be sent to ${grievance}. We acknowledge a complaint within 48 hours and resolve it within one month.`] },
        { h: 'Changes', p: ['If we change this policy in a way that matters we will update the date on this page and, where the law requires, ask for your consent again.'] },
      ];

    case 'cookie-policy':
      return [
        { h: 'What cookies are', p: ['Cookies are small files a website stores in your browser. We use as few as possible, and each has a defined job.'] },
        {
          h: 'Cookies we set',
          ul: [
            'Session cookie (arv_session): keeps you logged in. It holds a random identifier and nothing about you. Strictly necessary. Removed when your session ends, at most 30 days.',
            'Bag cookie (arv_cart): remembers your bag before you log in. Strictly necessary. Kept for up to 30 days.',
            'Consent cookie (arv_consent): remembers the choices you make on the Cookie Preferences page. Kept for one year.',
          ],
        },
        {
          h: 'Cookies from other companies',
          ul: [
            'Cloudflare Turnstile: loads on sign-up, login and contact forms to stop automated abuse.',
            'Razorpay: loads when you pay. Razorpay sets its own cookies to process the payment and prevent fraud. See Razorpay\'s privacy policy.',
          ],
        },
        { h: 'Analytics and advertising', p: ['We do not currently use analytics or advertising cookies. If we add them, they will stay off until you allow them on the Cookie Preferences page.'] },
        { h: 'Your choices', p: ['Strictly necessary cookies cannot be switched off because the store would not work. You can also delete cookies in your browser settings, but you will then be logged out and your bag cookie will be lost.'] },
      ];

    case 'data-processing-agreement':
      return [
        { h: 'Purpose', p: [`This agreement explains how ${seller} handles personal data on your behalf, and how it uses service providers. It applies if you are a business customer, for example when you order for a company, and also states the standards we hold our providers to.`] },
        { h: 'Roles', p: [`For data about our own customers we are the data fiduciary. Where a business customer gives us personal data of its staff or recipients, for example delivery addresses, we process it only to complete that order and only on the customer's instructions.`] },
        {
          h: 'What we promise',
          ul: [
            'We process personal data only for the purposes in our Privacy Policy and your instructions.',
            'Everyone with access is bound by confidentiality.',
            'We use the security measures in our Security Policy.',
            'We help you answer requests from people exercising their rights.',
            'We tell you without undue delay if we learn of a breach affecting your data.',
            'We delete or return data when the relationship ends, unless the law requires us to keep it.',
          ],
        },
        { h: 'Service providers', p: ['We use the providers named in the Privacy Policy (database, hosting, payments, email, bot protection, login and delivery). Each is bound by terms that require appropriate security and limit their use of the data. We remain responsible for them. We will update the Privacy Policy before adding a new provider that receives personal data.'] },
        { h: 'Location of data', p: ['Our providers may process data in India or other countries where they operate. We transfer data only to places the Government of India has not restricted.'] },
        { h: 'Contact', p: [`Questions about this agreement go to ${contact}.`] },
      ];

    case 'terms-of-service':
      return [
        { h: 'About these terms', p: [`These terms govern your use of ${name} and the orders you place. The store is operated by ${seller}${b.address ? `, ${b.address}` : ''}${b.gstin ? `, GSTIN ${b.gstin}` : ''}. By creating an account or placing an order you accept them.`] },
        { h: 'Eligibility', p: ['You must be at least 18 years old and able to enter into a contract under Indian law. We deliver only within India.'] },
        { h: 'Your account', ul: ['Give accurate details and keep them current.', 'Keep your password private. Tell us at once if you think someone else has used your account.', 'You are responsible for activity under your account until you tell us it is compromised.', 'We may suspend an account that breaks these terms or the Acceptable Use Policy.'] },
        { h: 'Products and prices', p: ['We show prices in Indian rupees, inclusive of applicable taxes, with shipping added at checkout. Colours on screen may differ slightly from the real item. If we find a pricing or stock error on an order, we will tell you and you may cancel for a full refund or accept a corrected order.'] },
        { h: 'Orders and payment', ul: ['An order is accepted when payment is confirmed and you receive our confirmation email.', 'Payment is processed by Razorpay. We never see your card details.', `Unpaid orders are released after ${30} minutes so the stock can go to others.`, `The maximum value of a single order is ${formatINR(s.checkout.maxOrderPaise)}.`, 'We may cancel an order we cannot fulfil, and will refund any payment in full.'] },
        { h: 'Delivery, returns and refunds', p: ['These are covered by the Shipping Policy, Return and Exchange Policy, Refund Policy and Cancellation Policy, which form part of these terms.'] },
        { h: 'Our content', p: ['The text, images, logo and design of the store belong to us or our licensors. You may use them to browse and buy, but you may not copy or reuse them for other purposes without written permission.'] },
        { h: 'Limits on liability', p: ['We are responsible for what the law makes us responsible for, including for goods that are defective or not as described. Beyond that, our liability for any claim is limited to the amount you paid for the order concerned. We are not liable for loss we could not reasonably foresee, or for delays caused by events outside our control.'] },
        { h: 'Governing law', p: ['These terms are governed by the laws of India. Courts in the city of our registered address have jurisdiction, without taking away any right you have as a consumer to go to another forum.'] },
        { h: 'Changes', p: ['We may update these terms. The version in force when you place an order applies to that order.'] },
        { h: 'Contact', p: [`${contact}. Grievance officer: ${grievance}.`] },
      ];

    case 'shipping-policy':
      return [
        { h: 'Where we deliver', p: ['We deliver to addresses across India with a valid PIN code. We check the PIN against the state you enter to avoid delivery to a wrong address.'] },
        { h: 'Cost', p: [`Shipping is ${shipFee}. The fee is shown in your bag and again at checkout before you pay.`] },
        { h: 'How long it takes', ul: [`We hand your order to the courier within ${days(sh.dispatchDays)} of payment.`, `Delivery then usually takes ${sh.deliveryMinDays} to ${sh.deliveryMaxDays} business days, depending on where you live.`, 'Remote areas, public holidays and weather can add time.'] },
        { h: 'Tracking', p: ['When your order ships we add the courier and tracking number to the order page and email you.'] },
        { h: 'Delivery attempts', p: ['The courier will contact you on the mobile number you gave. If delivery fails because you are unreachable or the address is wrong, the parcel may be returned to us. We will contact you to arrange a second delivery, and may ask you to pay the extra shipping.'] },
        { h: 'Damaged or missing parcels', p: [`Check the parcel when you receive it. If it is damaged, or does not arrive within ${sh.deliveryMaxDays + 5} business days of dispatch, contact us with your order number and we will investigate with the courier and replace or refund.`] },
      ];

    case 'return-exchange-policy':
      return [
        { h: 'Time limit', p: [`You can request a return or exchange within ${po.returnWindowDays} days of delivery.`] },
        { h: 'What can be returned', ul: ['Items that are unworn, unwashed and unaltered, with all tags and original packaging.', 'Items that arrived damaged, defective or different from what you ordered. These are accepted even if worn briefly in trying, and we pay the return shipping.'] },
        { h: 'What cannot be returned', ul: ['Innerwear, socks and other hygiene items once the seal is opened.', 'Items marked final sale on the product page before you bought them.', 'Items damaged after delivery, washed, altered or missing tags.'] },
        { h: 'How to return or exchange', ul: ['Open Support and choose Return or exchange. Give your order number, the item and the reason.', 'We reply with the next steps. Do not send an item back before we confirm.', 'For an exchange, tell us the size or colour you want. If it is out of stock we will refund you instead.', 'We inspect the item when it reaches us.'] },
        { h: 'Return shipping', p: ['If the item is faulty, wrong or damaged, we pay. For a change of mind, the cost of returning the item is yours and is deducted from the refund unless we say otherwise.'] },
        { h: 'Refunds', p: [`Approved returns are refunded as described in the Refund Policy, within ${days(po.refundDays)} of us receiving the item.`] },
      ];

    case 'refund-policy':
      return [
        { h: 'When we refund', ul: ['You cancel an order before it ships.', 'We cancel an order, for example because an item is out of stock.', 'A return is approved after inspection.', 'You paid twice for the same order.', 'An order was damaged or lost in transit.'] },
        { h: 'How we refund', p: ['Refunds go to the original payment method through Razorpay. We cannot refund to a different card, account or UPI ID.'] },
        { h: 'How long it takes', ul: [`Cancelled orders: we start the refund straight away.`, `Returns: within ${days(po.refundDays)} of us receiving and checking the item.`, 'After we start a refund your bank or card issuer usually takes 5 to 7 business days to show it. UPI and wallets can be faster.'] },
        { h: 'What we refund', p: ['The price of the returned items, and shipping if the order is cancelled in full or the return is for a fault. Where only part of an order is returned, the shipping you paid is not refunded unless the item was faulty.'] },
        { h: 'Failed payments', p: ['If money left your account but the order was not confirmed, the amount is returned automatically by the bank, usually within 5 to 7 business days. If it is not, contact us with the payment reference.'] },
        { h: 'Where to see it', p: ['Your order page shows the payment status, and shows when a refund has been issued.'] },
      ];

    case 'cancellation-policy':
      return [
        { h: 'Cancel by yourself', p: [po.cancelBeforeDispatch ? 'You can cancel an order from its page in My orders until it is handed to the courier.' : 'You can cancel an order from its page in My orders while it is awaiting confirmation. After that, contact us.'] },
        { h: 'After dispatch', p: ['Once the courier has your parcel the order can no longer be cancelled. You can refuse delivery or use the Return and Exchange Policy once it arrives.'] },
        { h: 'Payment', ul: ['If you cancel an unpaid order, nothing is charged.', 'If you cancel a paid order, we refund the full amount to the original payment method. See the Refund Policy for timing.'] },
        { h: 'Unpaid orders', p: ['An order that is not paid within 30 minutes is cancelled automatically and the stock is released. If your payment arrives after that, it is matched and refunded or the order is restored where stock allows.'] },
        { h: 'Cancellations by us', p: ['We may cancel an order for stock errors, pricing errors, an address we cannot deliver to, or suspected fraud. We will tell you and refund any payment in full.'] },
      ];

    case 'acceptable-use-policy':
      return [
        { h: 'The rule', p: ['Use the store only to browse, buy and contact us. Do not harm the store, other customers or anyone else.'] },
        { h: 'You must not', ul: ['Use another person\'s account, identity, phone number or payment method without permission.', 'Register with a temporary or disposable email address, or create accounts to abuse offers.', 'Try to break into, probe, overload or scrape the website, or bypass rate limits or bot checks.', 'Upload or send malicious code, or content that is unlawful, abusive or infringes someone\'s rights.', 'Place orders you intend to dispute without cause, or abuse returns and refunds.', 'Resell our images, text or data, or copy the site.'] },
        { h: 'What we may do', p: ['If we see this behaviour we may limit, suspend or close your account, cancel orders and refund payments, and report it to the authorities where the law allows.'] },
        { h: 'Report abuse', p: [`Tell us at ${contact}. To report a security flaw, follow the Responsible Disclosure page.`] },
      ];

    case 'community-guidelines':
      return [
        { h: 'Be respectful', p: ['The store has no public reviews or comment boards, so these guidelines apply to what you send us: support messages, emails and calls.'] },
        { h: 'We ask you to', ul: ['Be honest about your order and the problem.', 'Treat our staff and couriers with courtesy.', 'Keep personal data such as card numbers and passwords out of messages. We will never ask for them.'] },
        { h: 'We will not accept', ul: ['Abuse, threats or discrimination of any kind.', 'Repeated or misleading claims.', 'Messages that include other people\'s personal data without their consent.'] },
        { h: 'What happens', p: ['We may stop replying to messages that break these rules and may close the account involved. We always respond to genuine problems with an order.'] },
      ];

    case 'disclaimer':
      return [
        { h: 'Product information', p: ['We try to describe and photograph every item accurately. Screens vary, so a colour may look slightly different in person. Size charts are a guide, and fit can differ by style and person. Measurements may vary by a small margin.'] },
        { h: 'Availability', p: ['Stock changes quickly. An item in your bag is not reserved until you place the order. We reserve stock for you while you complete payment.'] },
        { h: 'Website availability', p: ['We aim to keep the store running but cannot promise it will always be available or free from errors. We may pause it for maintenance.'] },
        { h: 'Links', p: ['Our site may link to other websites, for example our studio\'s Instagram page. We do not control them and are not responsible for their content.'] },
        { h: 'Your rights', p: ['Nothing here limits your rights as a consumer under Indian law, including the right to receive goods that match their description.'] },
      ];

    case 'accessibility-statement':
      return [
        { h: 'Our goal', p: [`We want everyone to be able to use ${name}. We build to the Web Content Accessibility Guidelines (WCAG) 2.2 level AA as far as we can.`] },
        { h: 'What we do', ul: ['Every page can be used with a keyboard, with a visible focus outline.', 'Pages use headings, landmarks and labels so screen readers can navigate them.', 'Text and controls meet colour contrast requirements.', 'Form errors are described in text and linked to the field.', 'Motion is limited and respects the reduced motion setting of your device.', 'Text can be enlarged to 200 percent without losing content.'] },
        { h: 'Known gaps', ul: ['The Cloudflare Turnstile check and the Razorpay payment window are provided by other companies. We cannot fully control their accessibility, and we offer help by email if you cannot complete them.', 'Some product photos have short descriptions. We are improving them.'] },
        { h: 'Tell us about a problem', p: [`If something is hard to use, tell us at ${contact}. Say which page and what device or assistive technology you use. We reply within five business days and aim to fix problems promptly.`] },
      ];

    case 'security-policy':
      return [
        { h: 'Passwords', p: ['Passwords are hashed with Argon2id, a memory-hard algorithm, with a unique salt for each account. We cannot read them. New passwords are checked against known breaches without sending the password anywhere.'] },
        { h: 'Sign-in protection', ul: ['Limits on login and reset attempts per account and per network.', 'Bot checks on sign-up, login and contact forms.', 'Session tokens are random, stored only as hashes on our side, and sent in secure cookies that scripts cannot read.', 'You can see and sign out your devices in Account settings.', 'Disposable email addresses are rejected at sign-up.'] },
        { h: 'Payments', p: ['Payments run on Razorpay\'s hosted checkout. We never receive card or UPI credentials. Every payment is confirmed by checking Razorpay\'s signature on our server, so an order cannot be marked paid from your browser.'] },
        { h: 'Our systems', ul: ['All traffic is encrypted with HTTPS.', 'Every request is validated on the server. We do not trust what the browser sends.', 'Strict browser security headers and a content security policy limit what a page can load.', 'The admin area is not linked from the site, requires a password and a second factor, and keeps an audit log.', 'Uploaded images are re-encoded so they cannot carry hidden code.', 'Database access is limited and uses parameterised queries.'] },
        { h: 'What you can do', ul: ['Use a unique password.', 'Log out on shared devices.', 'We never ask for your password, OTP or card details by email, phone or message.'] },
        { h: 'Breaches', p: ['If a breach affecting your data occurs we will tell you and the authorities as the law requires.'] },
        { h: 'Report a problem', p: ['See Responsible Disclosure.'] },
      ];

    case 'responsible-disclosure':
      return [
        { h: 'Reporting a vulnerability', p: [`If you find a security problem in ${name}, please tell us before you tell anyone else. Send the details to ${b.supportEmail || 'the email on our Support page'} with the subject "Security report".`] },
        { h: 'What to include', ul: ['A description of the issue and where it is.', 'Steps to reproduce it.', 'The impact you think it has.', 'Your contact details, if you want a reply.'] },
        { h: 'What we ask', ul: ['Give us reasonable time to fix the issue before you publish it.', 'Do not access, change or delete other people\'s data. Use your own test account.', 'Do not run denial of service attacks, spam or social engineering against our staff or customers.', 'Do not test payments with real money beyond what you need to show the problem.'] },
        { h: 'What we promise', ul: ['We reply within five business days.', 'We will not take legal action against you for good-faith research that follows this page.', 'We will keep you informed and, if you like, thank you once the issue is fixed.'] },
        { h: 'Out of scope', p: ['Reports of missing best-practice headers with no demonstrated impact, issues in third-party services such as Razorpay or Cloudflare (report those to the provider), and automated scanner output without a working proof.'] },
        { h: 'Rewards', p: ['We do not run a paid bounty programme.'] },
      ];
  }
  return null;
}
