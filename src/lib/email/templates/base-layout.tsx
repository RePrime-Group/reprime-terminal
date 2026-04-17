import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Img,
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
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      {preview && <span style={{ display: 'none', maxHeight: 0, overflow: 'hidden' }}>{preview}</span>}
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Gold accent line */}
          <div style={{ height: '3px', background: 'linear-gradient(90deg, #BC9C45, #D4B96A, #BC9C45)' }} />

          {/* Header */}
          <Section style={headerStyle}>
            <table cellPadding="0" cellSpacing="0" width="100%" style={{ borderCollapse: 'collapse' }}>
              <tr>
                <td style={{ padding: '32px 40px' }}>
                  <table cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' }}>
                    <tr>
                      <td
                        style={{
                          width: '36px',
                          height: '36px',
                          backgroundColor: '#BC9C45',
                          borderRadius: '10px',
                          textAlign: 'center' as const,
                          verticalAlign: 'middle' as const,
                        }}
                      >
                        <span
                          style={{
                            color: '#FFFFFF',
                            fontSize: '18px',
                            fontWeight: 700,
                            fontStyle: 'italic',
                            fontFamily: 'Georgia, serif',
                          }}
                        >
                          R
                        </span>
                      </td>
                      <td style={{ paddingLeft: '14px' }}>
                        <span
                          style={{
                            color: '#FFFFFF',
                            fontSize: '15px',
                            fontWeight: 500,
                            letterSpacing: '4px',
                            fontFamily: 'Arial, sans-serif',
                          }}
                        >
                          REPRIME
                        </span>
                        <span
                          style={{
                            color: '#D4A843',
                            fontSize: '12px',
                            fontStyle: 'italic',
                            marginLeft: '8px',
                            fontFamily: 'Georgia, serif',
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
          </Section>

          {/* Content */}
          <Section style={contentStyle}>{children}</Section>

          {/* Footer */}
          <Section style={footerStyle}>
            <Hr style={{ borderColor: '#EEF0F4', margin: '0 0 24px 0' }} />
            <table cellPadding="0" cellSpacing="0" width="100%" style={{ borderCollapse: 'collapse' }}>
              <tr>
                <td>
                  <Text style={footerBrandStyle}>
                    REPRIME TERMINAL BETA
                  </Text>
                  <Text style={footerTextStyle}>
                    This communication is confidential and intended solely for the
                    individual to whom it is addressed. All investments involve risk.
                  </Text>
                  <Text style={footerTextStyle}>
                    &copy; {new Date().getFullYear()} RePrime Group, LLC. All rights reserved.
                  </Text>
                  <Text style={{ ...footerTextStyle, marginTop: '12px' }}>
                    <a href="https://reprimeterminal.com" style={{ color: '#BC9C45', textDecoration: 'none', fontSize: '11px' }}>
                      reprimeterminal.com
                    </a>
                  </Text>
                </td>
              </tr>
            </table>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: '#F2F4F8',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  margin: 0,
  padding: '40px 0',
};

const containerStyle: React.CSSProperties = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#FFFFFF',
  borderRadius: '16px',
  overflow: 'hidden',
  boxShadow: '0 4px 24px rgba(14, 52, 112, 0.08)',
};

const headerStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #07090F 0%, #0A1628 40%, #0E3470 100%)',
};

const contentStyle: React.CSSProperties = {
  padding: '40px 40px 32px',
};

const footerStyle: React.CSSProperties = {
  padding: '0 40px 36px',
};

const footerBrandStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '2px',
  color: '#9CA3AF',
  margin: '0 0 8px 0',
};

const footerTextStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#9CA3AF',
  lineHeight: '17px',
  margin: '0 0 4px 0',
};
