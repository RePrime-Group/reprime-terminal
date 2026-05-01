import { Resend } from 'resend';
import { TERMINAL_LOGO_GOLD_PNG_BASE64 } from './assets/terminal-logo-gold';

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    _resend = new Resend(key);
  }
  return _resend;
}

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'terminal@reprimeterminal.com';
export const FROM_NAME = 'RePrime Terminal Beta';

// CID used to reference the logo from inside email templates: <Img src="cid:logo" />.
export const LOGO_CID = 'logo';

/**
 * Returns the inline-attachment descriptor for the brand logo so emails can
 * embed the PNG directly (no external URL fetch).
 *
 * The Resend SDK's `content` field is typed as `string | Buffer` but at
 * runtime the request body is just `JSON.stringify`'d — passing a Buffer
 * serializes as `{"type":"Buffer","data":[…]}` and corrupts the payload.
 * The API itself wants a base64 string, so we pass the checked-in base64
 * constant straight through.
 */
export function getLogoAttachment() {
  return {
    filename: 'terminal-logo-gold.png',
    content: TERMINAL_LOGO_GOLD_PNG_BASE64,
    contentId: LOGO_CID,
    contentType: 'image/png',
  };
}
