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
  Button,
  Link,
  Img,
} from '@react-email/components';

interface VerificationEmailProps {
  verificationLink: string;
  name?: string;
}

const baseUrl = 'https://gbiair.in';

export const VerificationEmail = ({
  verificationLink,
  name,
}: VerificationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Verify your GreenBreathe account</Preview>
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

          <Heading style={h1}>Welcome to GreenBreathe!</Heading>

          <Text style={text}>Hello {name || 'there'},</Text>
          <Text style={text}>
            We're excited to have you on board. Please verify your email address
            by clicking the securely generated link below.
          </Text>

          <Section style={btnContainer}>
            <Button style={button} href={verificationLink}>
              Verify Email Address
            </Button>
          </Section>

          <Text style={text}>
            Or copy and paste this link directly into your browser:
            <br />
            <Link href={verificationLink} style={link}>
              {verificationLink}
            </Link>
          </Text>

          <Text style={warningText}>
            This link will expire in{' '}
            <strong style={{ color: '#0f172a' }}>24 hours</strong>.
          </Text>

          <Text style={mutedText}>
            If you didn't create an account with us, you can safely ignore this
            email.
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

const btnContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#16A34A',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  padding: '16px 32px',
  display: 'inline-block',
  boxShadow: '0 4px 14px 0 rgba(22, 163, 74, 0.3)',
};

const link = {
  color: '#16A34A',
  textDecoration: 'underline',
  wordBreak: 'break-all' as const,
  fontSize: '14px',
  marginTop: '8px',
  display: 'block',
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

export default VerificationEmail;
