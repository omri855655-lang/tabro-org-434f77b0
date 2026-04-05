/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

const LOGO_URL = 'https://isnhgyycowmnlxtmbmwm.supabase.co/storage/v1/object/public/email-assets/tabro-logo.png'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ siteName, email, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <Html lang="he" dir="rtl">
    <Head />
    <Preview>אישור שינוי כתובת מייל ב-Tabro</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt="Tabro" width="80" height="80" style={logo} />
        <Heading style={h1}>אישור שינוי כתובת מייל</Heading>
        <Text style={text}>
          ביקשתם לשנות את כתובת המייל ב-Tabro מ-
          <Link href={`mailto:${email}`} style={link}>{email}</Link>
          {' '}ל-
          <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>
        <Button style={button} href={confirmationUrl}>אישור שינוי מייל</Button>
        <Text style={footer}>אם לא ביקשתם שינוי זה, אנא אבטחו את החשבון שלכם מיד.</Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Rubik', 'Heebo', Arial, sans-serif" }
const container = { padding: '30px 25px', textAlign: 'center' as const }
const logo = { margin: '0 auto 20px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#3B4C8A', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 25px' }
const link = { color: '#3B4C8A', textDecoration: 'underline' }
const button = { backgroundColor: '#E8A838', color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
