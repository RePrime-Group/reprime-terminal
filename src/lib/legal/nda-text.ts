// Source of truth for the RePrime confidentiality agreement text.
// Changes here are legal-impacting — review with Gideon before editing.

export const NDA_TITLE = 'CONFIDENTIALITY AGREEMENT';

export const NDA_DISCLOSING_PARTY = {
  entity: 'RePrime Group LLC',
  signerName: 'Gideon Menahem Gratsiani',
  signerTitle: 'Founder & Co-CEO',
} as const;

export interface NDATemplateInput {
  /** Effective date (e.g. "April 27, 2026"). Auto-filled from current date. */
  date: string;
  /** Receiving party legal name from the signature input. May be empty before user types. */
  receivingPartyName?: string;
}

/**
 * Renders the NDA body as plain text paragraphs. Paragraphs are split on
 * blank lines; consumers should render each paragraph as a <p>.
 *
 * The body intentionally inlines `date` and `receivingPartyName` so the
 * preamble updates live as the user types in the signature form.
 */
export function getNDABody({ date, receivingPartyName }: NDATemplateInput): string {
  const receivingParty = receivingPartyName?.trim() || '[Your full legal name]';

  return `This CONFIDENTIALITY AGREEMENT (the "Agreement") is entered into this ${date} by and between RePrime Group LLC, an Iowa limited liability company (hereinafter "Disclosing Party"), and ${receivingParty} (hereinafter "Receiving Party"; and collectively, the "Parties").

WHEREAS, the Parties are engaged in preliminary discussions regarding a potential business relationship or a possible business transaction (the "Purpose" or the "Potential Transaction"), and in connection with these discussions, Disclosing Party may disclose to the other Party certain confidential and sensitive information related to Disclosing Party's business operations, technology, products, assets, financial and business relationships, including but not limited to its unique commercial real estate investment techniques and methodologies developed and implemented; and

WHEREAS, the Parties agree that in consideration of the mutual promises herein, the terms of this Agreement shall apply in relation to any Confidential Information (as defined below) disclosed by Disclosing Party to the Receiving Party, and to induce such disclosure, the Receiving Party desires to undertake certain obligations of confidentiality and nondisclosure as set forth herein.

WHEREAS, the Receiving Party may share some of the information disclosed by the Disclosing Party, subject to the provisions of this Agreement, with certain of its legal representatives, shareholders, employees, officers, directors, attorneys, accountants and consultants, investor bankers (collectively, "Representatives").

NOW, THEREFORE, in consideration of the mutual undertakings and promises herein, the parties hereto hereby agree as follows:

1. Confidential Information. "Confidential Information" includes all non-public, confidential, or proprietary information that has commercial value or utility in the Disclosing Party's business, directly or indirectly, whether communicated orally, in writing, electronically, or in any other form, before or after the effective date hereof. This includes, without limitation, methodologies, deal structures, project pipelines, financial models, and marketing materials. Receiving Party shall treat all such information as strictly confidential and proprietary.

2. Exclusions. Confidential Information does not include information that: (a) was already known to the Receiving Party prior to disclosure and such prior knowledge can be demonstrated by the Receiving Party by dated, written records; (b) which at the time of disclosure by the Disclosing Party is or becomes publicly available other than through a breach of any obligation under this Agreement caused by an act or omission on the part of the Receiving Party; (c) is received from a third party without breach of any obligation; or (d) is independently developed by or for the Receiving Party without reference to Disclosing Party's information.

3. Confidentiality Obligations. In consideration of the willingness of the Disclosing Party to disclose its Confidential Information, and in recognition of the confidential nature thereof, at any time after the date of each disclosure of the Confidential Information, the Receiving Party agrees that the Receiving Party: (i) shall treat all the Confidential Information disclosed to it as strictly confidential; (ii) shall not exploit or make any use of it, whether or not for consideration, other than for the Purpose only; (iii) shall not disclose or permit access to the Confidential Information to any person or entity except to its representatives on a need-to-know basis for the purpose, and (iv) shall not reverse engineer, disassemble or decompile any samples, prototypes, software or other tangible objects provided by the Disclosing Party hereunder except with the express written authorization from the Disclosing Party. Notwithstanding the above: (i) the Receiving Party may disclose Confidential Information to its Representatives, for the Purpose only and on a need-to-know basis, provided that prior to disclosing any Confidential Information to such Representatives, the Receiving Party shall have ensured that they are aware of the provisions of this Agreement and are bound by non-use and non-disclosure terms substantially similar to those contained in this Agreement; and (ii) the Receiving Party may disclose the Confidential Information which is required or compelled by court order or applicable law or stock exchange rules to be disclosed, provided that Receiving Party provides all reasonable prior notice to the Disclosing Party to allow it to seek protective or other court orders, and only to those parties required or compelled to by the court order. The Receiving Party agrees to be liable for any breach of this Agreement by its Representatives. The Receiving Party shall ensure such representatives are bound by confidentiality obligations at least as protective as those set forth herein.

4. Use Restriction. The Receiving Party agrees to use the Confidential Information solely to evaluate the Potential Transaction and not for any other purpose, including competitive or commercial purposes.

5. Compelled Disclosure. In the event the Receiving Party is required by law or legal process to disclose any Confidential Information, Receiving Party shall give prompt notice to Disclosing Party and cooperate in seeking protective measures.

6. Return or Destruction. All Confidential Information is provided 'as is' and shall remain the sole property of the Disclosing Party. It is agreed that all documents and other materials which embody the Confidential Information will be returned to the Disclosing Party or destroyed immediately upon the request of the Disclosing Party, and no copies, extracts or other reproductions shall be retained by the Receiving Party or the Representatives. The Receiving Party shall promptly confirm in writing of the destruction and/or the return of all of the Confidential Information provided that the confidentiality undertakings hereunder shall remain in effect following such destruction and/or return.

7. No License or Obligation. It is understood and agreed that the disclosure of the Confidential Information by the Disclosing Party shall not grant the Receiving Party any express, implied or other license or rights to patents, intellectual property rights or assets, trade secrets or know-how of the Disclosing Party or its suppliers, whether or not patentable, nor shall it constitute or be deemed to create a partnership, joint venture or other undertaking. The Parties agree and acknowledge that the Disclosing Party shall remain the sole and exclusive owner of any and all Confidential Information disclosed to the Receiving Party. Without derogating from the generality of the above, the Receiving Party agrees that it shall not remove or otherwise alter any of the Disclosing Party's trademarks or service marks, serial numbers, logos, copyrights, notices or other proprietary notices or indicia, if any, fixed or attached to the Confidential Information or any part thereof. None of the Confidential Information which may be disclosed by the Disclosing Party shall constitute any representation, warranty, assurance, guarantee or inducement by the Disclosing Party of any kind, and, in particular, with respect to the non-infringement of any intellectual property rights, or other rights of third parties or the Disclosing Party.

8. Remedies. Since a breach by either Party of any of the promises or obligations contained herein may result in irreparable and continuing damage to the other Party for which there may be no adequate remedy at law, the Receiving Party agrees that money damages will not be a sufficient remedy for any breach of this Agreement by the Receiving Party or its Representatives, and the Disclosing Party shall be entitled, in addition to money damages, to specific performance and injunctive relief and any other appropriate equitable remedies for any such breach. Such remedies shall not be deemed to be the exclusive remedies for a breach of this Agreement but shall be in addition to all other remedies available at law or in equity.

9. Term. The obligations under this Agreement shall survive for a period of two (2) years commencing on the date hereof. The foregoing notwithstanding, the obligations of confidentiality hereunder with respect to all Confidential Information shall survive the termination or expiration of this Agreement for any reason, shall be binding upon the Receiving Party, the Representatives and its affiliates or successors and shall continue for five (5) years following the date hereof.

10. Governing Law. This Agreement shall be governed by the laws of the State of Florida, without regard to conflict of law rules.

11. Entire Agreement. This Agreement constitutes the entire understanding between the parties and may not be modified except in writing signed by both parties.`;
}

export function formatNDADate(d: Date = new Date()): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
