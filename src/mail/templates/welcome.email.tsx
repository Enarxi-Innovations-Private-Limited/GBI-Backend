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
} from '@react-email/components';

interface WelcomeEmailProps {
  name?: string;
}

export const WelcomeEmail = ({ name }: WelcomeEmailProps) => {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return (
    <Html>
      <Head />
      <Preview>Welcome to GreenBreathe!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to GreenBreathe!</Heading>

          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            We're thrilled to have you here. GreenBreathe is dedicated to
            helping you monitor and improve your air quality.
          </Text>

          <Section style={featureSection}>
            <Text style={featureTitle}>With your new account, you can:</Text>
            <ul style={list}>
              <li style={listItem}>Add and monitor your Air Quality Devices</li>
              <li style={listItem}>Analyze historical telemetry data</li>
              <li style={listItem}>Generate detailed PDF reports</li>
            </ul>
          </Section>

          <Text style={text}>
            If you have any questions, feel free to reach out to our support
            team at any time.
          </Text>

          <Text style={footer}>
            Best regards,
            <br />
            <strong>GreenBreathe Innovations Team</strong>
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default WelcomeEmail;

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  borderRadius: '8px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '40px',
  margin: '0 0 20px',
  padding: '0 24px',
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '24px',
  padding: '0 24px',
  margin: '16px 0',
};

const featureSection = {
  padding: '0 24px',
  margin: '24px 0',
};

const featureTitle = {
  color: '#333',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 12px',
};

const list = {
  margin: '0',
  paddingLeft: '24px',
  color: '#555',
};

const listItem = {
  marginBottom: '8px',
  fontSize: '15px',
};

const footer = {
  color: '#666',
  fontSize: '14px',
  lineHeight: '24px',
  padding: '0 24px',
  margin: '32px 0 0',
};
