import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Img,
  Text,
  Hr,
  Font,
} from '@react-email/components';
import * as React from 'react';

interface BaseLayoutProps {
  children: React.ReactNode;
  preview?: string;
}

export default function BaseLayout({ children, preview }: BaseLayoutProps) {
  return (
    <Html>
      <Head>
        <Font
          fontFamily="Poppins"
          fallbackFontFamily="Arial"
          webFont={{
            url: 'https://fonts.gstatic.com/s/poppins/v21/pxiEyp8kv8JHgFVrJJfecg.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      {preview && <span style={{ display: 'none' }}>{preview}</span>}
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            <table cellPadding="0" cellSpacing="0" width="100%">
              <tr>
                <td style={{ padding: '28px 32px' }}>
                  <table cellPadding="0" cellSpacing="0">
                    <tr>
                      <td
                        style={{
                          width: '32px',
                          height: '32px',
                          backgroundColor: '#BC9C45',
                          borderRadius: '8px',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                        }}
                      >
                        <span
                          style={{
                            color: '#FFFFFF',
                            fontSize: '16px',
                            fontWeight: 700,
                            fontStyle: 'italic',
                            fontFamily: '"Playfair Display", Georgia, serif',
                          }}
                        >
                          R
                        </span>
                      </td>
                      <td style={{ paddingLeft: '12px' }}>
                        <span
                          style={{
                            color: '#FFFFFF',
                            fontSize: '14px',
                            fontWeight: 500,
                            letterSpacing: '4px',
                            textTransform: 'uppercase' as const,
                          }}
                        >
                          REPRIME
                        </span>
                        <span
                          style={{
                            color: '#BC9C45',
                            fontSize: '11px',
                            fontStyle: 'italic',
                            marginLeft: '6px',
                          }}
                        >
                          Terminal
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            {/* Gold accent line */}
            <div
              style={{
                height: '2px',
                background: 'linear-gradient(90deg, transparent, #BC9C45, transparent)',
              }}
            />
          </Section>

          {/* Content */}
          <Section style={contentStyle}>{children}</Section>

          {/* Footer */}
          <Section style={footerStyle}>
            <Hr style={{ borderColor: '#EEF0F4', margin: '0 0 20px 0' }} />
            <Text style={footerTextStyle}>
              This email was sent by RePrime Terminal. This communication is
              confidential and intended solely for the use of the individual to
              whom it is addressed.
            </Text>
            <Text style={footerTextStyle}>
              &copy; {new Date().getFullYear()} RePrime Group. All rights
              reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: '#F2F4F8',
  fontFamily: '"Poppins", Arial, sans-serif',
  margin: 0,
  padding: '40px 0',
};

const containerStyle: React.CSSProperties = {
  maxWidth: '580px',
  margin: '0 auto',
  backgroundColor: '#FFFFFF',
  borderRadius: '16px',
  overflow: 'hidden',
  boxShadow: '0 4px 24px rgba(14, 52, 112, 0.06)',
};

const headerStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #07090F 0%, #0A1628 30%, #0E3470 100%)',
};

const contentStyle: React.CSSProperties = {
  padding: '32px',
};

const footerStyle: React.CSSProperties = {
  padding: '0 32px 32px',
};

const footerTextStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#9CA3AF',
  lineHeight: '16px',
  margin: '0 0 4px 0',
};
