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
  Link,
  Button,
} from '@react-email/components';

interface ForgotPasswordEmailProps {
  resetLink: string;
  name?: string;
}

export const ForgotPasswordEmail = ({
  resetLink,
  name,
}: ForgotPasswordEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Reset your GBI account password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>GREENBREATHE INNOVATIONS</Text>
          </Section>

          <Heading style={h1}>Password Reset Request</Heading>

          <Text style={text}>Hello {name || 'there'},</Text>
          <Text style={text}>
            We received a request to reset the password for your GBI account.
            Click the button below to choose a new password.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={resetLink}>
              Reset Password
            </Button>
          </Section>

          <Text style={mutedText}>
            If you did not request a password reset, please ignore this email or
            contact support if you have concerns. This link will expire shortly.
          </Text>

          <Text style={mutedText}>
            If the button above doesn't work, copy and paste this link into your
            browser:
            <br />
            <Link href={resetLink} style={link}>
              {resetLink}
            </Link>
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

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#22c55e',
  borderRadius: '8px',
  color: '#000000',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  padding: '16px 32px',
  textAlign: 'center' as const,
  display: 'inline-block',
  lineHeight: '100%',
};

const link = {
  color: '#22c55e',
  textDecoration: 'underline',
  fontSize: '14px',
};

const mutedText = {
  color: '#71717a',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 24px',
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

export default ForgotPasswordEmail;
