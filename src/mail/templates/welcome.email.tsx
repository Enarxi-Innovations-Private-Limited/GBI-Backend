import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Img,
} from '@react-email/components';

interface WelcomeEmailProps {
  name?: string;
}

const baseUrl = 'https://gbiair.in';

export const WelcomeEmail = ({ name }: WelcomeEmailProps) => {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return (
    <Html>
      <Head />
      <Preview>Welcome to GreenBreathe Innovations!</Preview>
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

          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            We're thrilled to have you here. GreenBreathe is dedicated to
            helping you monitor and improve your air quality through advanced
            real-time telemetry and detailed analytics.
          </Text>

          <Section style={featureSection}>
            <Text style={featureTitle}>With your new account, you can:</Text>
            <ul style={list}>
              <li style={listItem}>Add and monitor your Air Quality Devices</li>
              <li style={listItem}>Analyze historical telemetry data</li>
              <li style={listItem}>Generate detailed PDF and CSV reports</li>
              <li style={listItem}>Configure custom alerts and thresholds</li>
            </ul>
          </Section>

          <Text style={text}>
            If you have any questions, feel free to reach out to our support
            team at any time.
          </Text>

          <Section style={footerSection}>
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

export default WelcomeEmail;

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

const featureSection = {
  backgroundColor: '#f8fafc',
  borderRadius: '12px',
  padding: '24px',
  margin: '32px 0',
  border: '1px solid #e2e8f0',
};

const featureTitle = {
  color: '#0f172a',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 12px',
};

const list = {
  margin: '0',
  paddingLeft: '24px',
  color: '#475569',
};

const listItem = {
  marginBottom: '8px',
  fontSize: '15px',
};

const footerSection = {
  borderTop: '1px solid #e2e8f0',
  paddingTop: '32px',
  marginTop: '32px',
};

const footerText = {
  color: '#64748b',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
};
