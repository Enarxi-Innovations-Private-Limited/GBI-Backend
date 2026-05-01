import * as React from 'react';
import {
  Html,
  Body,
  Head,
  Heading,
  Container,
  Preview,
  Section,
  Text,
  Img,
} from '@react-email/components';

interface OtpEmailProps {
  otp: string;
  name?: string;
}

const baseUrl = 'https://gbiair.in';

export const OtpEmail = ({ otp, name }: OtpEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Your GBI Verification Code: {otp}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src={`${baseUrl}/gbiLogo.png`}
              width="100"
              alt="GBI Logo"
              style={logo}
            />
            <Text style={logoText}>GREENBREATHE INNOVATIONS</Text>
          </Section>

          <Heading style={h1}>Email Verification</Heading>

          <Text style={text}>Hello {name || 'there'},</Text>
          <Text style={text}>
            Please use the following secure verification code to verify your
            identity and access your dashboard.
          </Text>

          <Section style={codeBox}>
            <Text style={codeText}>{otp}</Text>
          </Section>

          <Text style={warningText}>
            This code will expire in{' '}
            <strong style={{ color: '#0f172a' }}>10 minutes</strong>.
          </Text>

          <Text style={mutedText}>
            If you didn't request this code, you can safely ignore this email.
            Someone may have typed your email by mistake.
          </Text>

          <Section style={footer}>
            <Text style={footerText}>
              Best regards,
              <br />
              <strong style={{ color: '#16A34A' }}>
                GreenBreathe Innovations Team
              </strong>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// --- Styles ---

const main = {
  backgroundColor: '#f1f5f9',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
  padding: '60px 0',
};

const container = {
  margin: '0 auto',
  padding: '40px',
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  border: '1px solid #e2e8f0',
  maxWidth: '500px',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
};

const header = {
  marginBottom: '32px',
  textAlign: 'center' as const,
};

const logo = {
  margin: '0 auto 12px',
};

const logoText = {
  fontSize: '15px',
  color: '#16A34A',
  fontWeight: '900',
  letterSpacing: '2px',
  margin: '0',
};

const h1 = {
  color: '#0f172a',
  fontSize: '28px',
  fontWeight: '700',
  textAlign: 'center' as const,
  margin: '0 0 24px',
};

const text = {
  color: '#475569',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 20px',
};

const codeBox = {
  backgroundColor: '#f8fafc',
  borderRadius: '12px',
  padding: '32px 24px',
  textAlign: 'center' as const,
  margin: '32px 0',
  border: '1px dashed #cbd5e1',
};

const codeText = {
  color: '#16A34A',
  fontSize: '40px',
  fontWeight: 'bold',
  letterSpacing: '12px',
  margin: '0',
};

const warningText = {
  color: '#64748b',
  fontSize: '14px',
  textAlign: 'center' as const,
  margin: '0 0 24px',
};

const mutedText = {
  color: '#94a3b8',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 32px',
};

const footer = {
  borderTop: '1px solid #e2e8f0',
  paddingTop: '32px',
};

const footerText = {
  color: '#64748b',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
};

export default OtpEmail;
