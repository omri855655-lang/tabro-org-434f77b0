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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="he" dir="rtl">
    <Head />
    <Preview>ברוכים הבאים ל-Tabro! אשרו את כתובת המייל שלכם</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt="Tabro" width="80" height="80" style={logo} />
        <Heading style={h1}>ברוכים הבאים ל-Tabro! 🚀</Heading>
        <Text style={text}>
          תודה שנרשמת ל-
          <Link href={siteUrl} style={link}><strong>Tabro</strong></Link>!
        </Text>
        <Text style={text}>
          אנא אשרו את כתובת המייל שלכם ({recipient}) על ידי לחיצה על הכפתור:
        </Text>
        <Button style={button} href={confirmationUrl}>
          אישור כתובת מייל
        </Button>
        <Text style={footer}>
          אם לא נרשמתם ל-Tabro, ניתן להתעלם ממייל זה.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Rubik', 'Heebo', Arial, sans-serif" }
const container = { padding: '30px 25px', textAlign: 'center' as const }
const logo = { margin: '0 auto 20px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#3B4C8A', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 25px' }
const link = { color: '#3B4C8A', textDecoration: 'underline' }
const button = { backgroundColor: '#3B4C8A', color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
