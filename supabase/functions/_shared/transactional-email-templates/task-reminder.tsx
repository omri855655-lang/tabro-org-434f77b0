/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const LOGO_URL = 'https://isnhgyycowmnlxtmbmwm.supabase.co/storage/v1/object/public/email-assets/tabro-logo.png'
const SITE_NAME = 'Tabro'

interface TaskReminderProps {
  urgentCount?: number
  overdueCount?: number
  dueTodayCount?: number
  dueTomorrowCount?: number
  recurringCount?: number
  summaryHtml?: string
}

const TaskReminderEmail = ({
  urgentCount = 0,
  overdueCount = 0,
  dueTodayCount = 0,
  dueTomorrowCount = 0,
  recurringCount = 0,
}: TaskReminderProps) => (
  <Html lang="he" dir="rtl">
    <Head />
    <Preview>סיכום משימות יומי מ-{SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt={SITE_NAME} width="80" height="80" style={logo} />
        <Heading style={h1}>🔔 סיכום משימות יומי</Heading>
        <Text style={text}>שלום, הנה סיכום המשימות שדורשות את תשומת ליבך:</Text>

        {urgentCount > 0 && (
          <Section style={urgentSection}>
            <Text style={sectionTitle}>🔥 {urgentCount} משימות דחופות</Text>
          </Section>
        )}

        {overdueCount > 0 && (
          <Section style={overdueSection}>
            <Text style={sectionTitle}>⚠️ {overdueCount} משימות בחריגה</Text>
          </Section>
        )}

        {dueTodayCount > 0 && (
          <Section style={todaySection}>
            <Text style={sectionTitle}>📅 {dueTodayCount} משימות מגיעות היום</Text>
          </Section>
        )}

        {dueTomorrowCount > 0 && (
          <Section style={tomorrowSection}>
            <Text style={sectionTitle}>📆 {dueTomorrowCount} משימות מגיעות מחר</Text>
          </Section>
        )}

        {recurringCount > 0 && (
          <Section style={recurringSection}>
            <Text style={sectionTitle}>🔄 {recurringCount} משימות קבועות להיום</Text>
          </Section>
        )}

        <Button style={button} href="https://tabro.org/personal">
          פתח את Tabro
        </Button>

        <Text style={footer}>בהצלחה! 💪 — צוות {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TaskReminderEmail,
  subject: '🔔 סיכום משימות יומי - Tabro',
  displayName: 'תזכורת משימות יומית',
  previewData: {
    urgentCount: 2,
    overdueCount: 1,
    dueTodayCount: 3,
    dueTomorrowCount: 2,
    recurringCount: 4,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Rubik', 'Heebo', Arial, sans-serif" }
const container = { padding: '30px 25px', textAlign: 'center' as const }
const logo = { margin: '0 auto 20px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#3B4C8A', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 25px' }

const sectionBase = { padding: '12px 16px', borderRadius: '8px', margin: '8px 0', textAlign: 'right' as const }
const urgentSection = { ...sectionBase, backgroundColor: '#fef2f2', borderRight: '4px solid #ef4444' }
const overdueSection = { ...sectionBase, backgroundColor: '#fff7ed', borderRight: '4px solid #f97316' }
const todaySection = { ...sectionBase, backgroundColor: '#fefce8', borderRight: '4px solid #eab308' }
const tomorrowSection = { ...sectionBase, backgroundColor: '#eff6ff', borderRight: '4px solid #3b82f6' }
const recurringSection = { ...sectionBase, backgroundColor: '#faf5ff', borderRight: '4px solid #a855f7' }
const sectionTitle = { fontSize: '15px', fontWeight: 'bold' as const, color: '#333', margin: '0' }

const button = { backgroundColor: '#3B4C8A', color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
