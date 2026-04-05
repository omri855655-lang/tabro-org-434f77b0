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
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

const LOGO_URL = 'https://isnhgyycowmnlxtmbmwm.supabase.co/storage/v1/object/public/email-assets/tabro-logo.png'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="he" dir="rtl">
    <Head />
    <Preview>איפוס סיסמה ל-Tabro</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt="Tabro" width="80" height="80" style={logo} />
        <Heading style={h1}>איפוס סיסמה</Heading>
        <Text style={text}>קיבלנו בקשה לאיפוס הסיסמה שלך ב-Tabro. לחצו על הכפתור למטה כדי לבחור סיסמה חדשה.</Text>
        <Button style={button} href={confirmationUrl}>איפוס סיסמה</Button>
        <Text style={footer}>אם לא ביקשתם לאפס סיסמה, ניתן להתעלם ממייל זה.</Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Rubik', 'Heebo', Arial, sans-serif" }
const container = { padding: '30px 25px', textAlign: 'center' as const }
const logo = { margin: '0 auto 20px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#3B4C8A', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 25px' }
const button = { backgroundColor: '#E8A838', color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
