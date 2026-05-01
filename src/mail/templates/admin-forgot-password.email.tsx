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
  Img,
} from '@react-email/components';

interface AdminForgotPasswordEmailProps {
  otp: string;
  resetLink: string;
  name?: string;
}

const baseUrl = 'https://gbiair.in';

export const AdminForgotPasswordEmail = ({
  otp,
  resetLink,
  name,
}: AdminForgotPasswordEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Admin Account: Reset your GBI password</Preview>
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
            <Text style={adminBadge}>ADMIN PORTAL</Text>
          </Section>

          <Heading style={h1}>Admin Password Reset</Heading>

          <Text style={text}>Hello {name || 'Admin'},</Text>
          <Text style={text}>
            A password reset was requested for your GBI Admin account. 
            Please use the following verification code to securely reset your password.
          </Text>

          <Section style={codeBox}>
            <Text style={codeText}>{otp}</Text>
          </Section>

          <Text style={mutedText}>
            If you did not request this reset, please notify the security team immediately.
            This code will expire in 10 minutes.
          </Text>

          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} GreenBreathe Innovations. All rights reserved.
            </Text>
            <Link href="https://gbiair.in" style={footerLink}>
              Visit GBI Portal
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default AdminForgotPasswordEmail;

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '40px auto',
  padding: '40px 20px',
  borderRadius: '12px',
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

const adminBadge = {
  fontSize: '10px',
  color: '#64748b',
  fontWeight: '700',
  letterSpacing: '1px',
  marginTop: '4px',
  textTransform: 'uppercase' as const,
};

const h1 = {
  color: '#0f172a',
  fontSize: '28px',
  fontWeight: '700',
  textAlign: 'center' as const,
  margin: '30px 0',
};

const text = {
  color: '#334155',
  fontSize: '16px',
  lineHeight: '24px',
  textAlign: 'left' as const,
  marginBottom: '16px',
};

const codeBox = {
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  border: '2px dashed #cbd5e1',
  padding: '24px',
  margin: '32px 0',
  textAlign: 'center' as const,
};

const codeText = {
  fontSize: '36px',
  fontWeight: '700',
  color: '#16A34A',
  letterSpacing: '8px',
  margin: '0',
};

const mutedText = {
  color: '#64748b',
  fontSize: '14px',
  lineHeight: '20px',
  textAlign: 'center' as const,
  marginTop: '24px',
  fontStyle: 'italic',
};

const footer = {
  marginTop: '48px',
  paddingTop: '24px',
  borderTop: '1px solid #e2e8f0',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#94a3b8',
  fontSize: '12px',
  margin: '0 0 8px',
};

const footerLink = {
  color: '#16A34A',
  fontSize: '12px',
  fontWeight: '600',
  textDecoration: 'none',
};
