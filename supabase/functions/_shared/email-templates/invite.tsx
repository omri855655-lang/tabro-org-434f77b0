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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="he" dir="rtl">
    <Head />
    <Preview>הוזמנת להצטרף ל-Tabro</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt="Tabro" width="80" height="80" style={logo} />
        <Heading style={h1}>הוזמנת להצטרף! 🎉</Heading>
        <Text style={text}>
          הוזמנת להצטרף ל-<Link href={siteUrl} style={link}><strong>Tabro</strong></Link>. לחצו על הכפתור למטה כדי לקבל את ההזמנה וליצור חשבון.
        </Text>
        <Button style={button} href={confirmationUrl}>קבלת הזמנה</Button>
        <Text style={footer}>אם לא ציפיתם להזמנה זו, ניתן להתעלם ממייל זה.</Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Rubik', 'Heebo', Arial, sans-serif" }
const container = { padding: '30px 25px', textAlign: 'center' as const }
const logo = { margin: '0 auto 20px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#3B4C8A', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 25px' }
const link = { color: '#3B4C8A', textDecoration: 'underline' }
const button = { backgroundColor: '#3B4C8A', color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
