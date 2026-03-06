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
} from '@react-email/components';

interface OtpEmailProps {
  otp: string;
  name?: string;
}

export const OtpEmail = ({ otp, name }: OtpEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Your GBI Verification Code: {otp}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
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
            <strong style={{ color: '#ffffff' }}>10 minutes</strong>.
          </Text>

          <Text style={mutedText}>
            If you didn't request this code, you can safely ignore this email.
            Someone may have typed your email by mistake.
          </Text>

          <Section style={footer}>
            <Text style={footerText}>
              Best regards,
              <br />
              <strong style={{ color: '#22c55e' }}>
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
  backgroundColor: '#050505',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
  padding: '60px 0',
};

const container = {
  margin: '0 auto',
  padding: '40px',
  backgroundColor: '#121212',
  borderRadius: '16px',
  border: '1px solid #27272a',
  maxWidth: '500px',
  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
};

const header = {
  marginBottom: '30px',
  textAlign: 'center' as const,
};

const logoText = {
  fontSize: '14px',
  color: '#22c55e',
  fontWeight: 'bold',
  letterSpacing: '2px',
};

const h1 = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: '700',
  textAlign: 'center' as const,
  margin: '0 0 20px',
};

const text = {
  color: '#d4d4d8',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 20px',
};

const codeBox = {
  background: 'linear-gradient(145deg, #18181b, #27272a)',
  borderRadius: '12px',
  padding: '24px',
  textAlign: 'center' as const,
  margin: '32px 0',
  border: '1px solid #3f3f46',
  boxShadow: '0 0 20px rgba(34, 197, 94, 0.1)',
};

const codeText = {
  color: '#22c55e',
  fontSize: '32px',
  fontWeight: 'bold',
  letterSpacing: '8px',
  margin: '0',
};

const warningText = {
  color: '#a1a1aa',
  fontSize: '14px',
  textAlign: 'center' as const,
  margin: '0 0 24px',
};

const mutedText = {
  color: '#71717a',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 32px',
};

const footer = {
  borderTop: '1px solid #27272a',
  paddingTop: '32px',
};

const footerText = {
  color: '#a1a1aa',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
};

export default OtpEmail;
