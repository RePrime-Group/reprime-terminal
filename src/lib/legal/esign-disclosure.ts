// Source of truth for the E-Sign Act consent disclosure shown at account creation.
// Satisfies the consumer-disclosure requirements of the federal E-Sign Act
// (15 U.S.C. §7001) and UETA before any electronic-signature flow (e.g. the NDA).
// Changes here are legal-impacting — review with Gideon before editing.

export const ESIGN_DISCLOSURE_TITLE =
  'Consent to Use Electronic Records and Signatures';

/**
 * Renders the disclosure body as plain-text paragraphs. Paragraphs are split
 * on blank lines; consumers should render each paragraph as a <p>.
 *
 * NOTE: This is a standard E-Sign consent disclosure provided as a starting
 * point. Have legal review and adjust (paper-copy fees, retention period,
 * support contact) before relying on it in production.
 */
export const ESIGN_DISCLOSURE_BODY = `By checking the consent box, you agree that RePrime Group LLC may provide you with disclosures, agreements, notices, and other records ("Records") electronically, and that you may sign such Records using an electronic signature, instead of on paper.

Scope of consent. Your consent applies to all Records associated with your RePrime Terminal account, including but not limited to confidentiality agreements (NDAs), subscription and offering documents, account notices, and any other records we are required by law to provide to you.

Right to paper copies. You have the right to receive a paper copy of any Record. To request one, contact us using the details below. We may charge a reasonable fee for paper copies, which will be disclosed to you before the fee is applied.

Withdrawing your consent. You may withdraw your consent to receive Records electronically at any time by contacting us using the details below. If you withdraw consent, we may suspend or close your account, as electronic delivery is required to use RePrime Terminal. Withdrawal is effective only after we have had a reasonable opportunity to act on it and does not affect the legal validity of Records provided before withdrawal takes effect.

Keeping your contact information current. To ensure you receive Records, you must keep your email address current. You can update it from your account settings or by contacting us. It is your responsibility to notify us of any change to your email address.

Hardware and software requirements. To access and retain Records electronically, you will need: a current web browser that supports 128-bit encryption; a valid email account; a device capable of viewing and storing PDF documents; and sufficient storage space or a printer to save or print Records. By consenting, you confirm that you are able to access Records in these formats.

Your consent. By checking the consent box, you confirm that you have read this disclosure, that you are able to access electronic Records as described above, and that you consent to conduct business with RePrime electronically and to use electronic signatures.

Contact. To request paper copies, update your contact information, or withdraw consent, contact RePrime at the support address listed on our website.`;
