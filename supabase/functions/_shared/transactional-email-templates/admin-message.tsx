/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Tabro'

interface AdminMessageProps {
  subject?: string
  body?: string
}

const AdminMessageEmail = ({ subject = '', body = '' }: AdminMessageProps) => {
  const paragraphs = (body || '').split(/\n\n+/)
  return (
    <Html lang="he" dir="rtl">
      <Head />
      <Preview>{subject || `הודעה מ-${SITE_NAME}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{subject || `הודעה מ-${SITE_NAME}`}</Heading>
          <Section style={card}>
            {paragraphs.map((p, i) => (
              <Text key={i} style={text}>{p}</Text>
            ))}
          </Section>
          <Text style={footer}>בברכה, צוות {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AdminMessageEmail,
  subject: (data: Record<string, any>) => (data?.subject as string) || `הודעה מ-${SITE_NAME}`,
  displayName: 'Admin direct message',
  previewData: { subject: 'בדיקה', body: 'שלום,\n\nזו הודעת בדיקה.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '600px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#3525cd', margin: '0 0 16px' }
const card = { backgroundColor: '#f8f9fb', borderRadius: '8px', padding: '16px 20px', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#1f2230', lineHeight: '1.6', margin: '0 0 12px', whiteSpace: 'pre-wrap' as const }
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
