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
} from '@react-email/components';

interface VerificationEmailProps {
  verificationLink: string;
  name?: string;
}

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
            <strong style={{ color: '#ffffff' }}>24 hours</strong>.
          </Text>

          <Text style={mutedText}>
            If you didn't create an account with us, you can safely ignore this
            email.
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

const btnContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#22c55e',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  padding: '16px 32px',
  display: 'inline-block',
  boxShadow: '0 4px 14px 0 rgba(34, 197, 94, 0.39)',
};

const link = {
  color: '#22c55e',
  textDecoration: 'underline',
  wordBreak: 'break-all' as const,
  fontSize: '14px',
  marginTop: '8px',
  display: 'block',
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

export default VerificationEmail;
