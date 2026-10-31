import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import type { StoredAttempt } from './session';

export type ExportQuestion = {
  label: string;
  question: string;
  attempts: StoredAttempt[];
};

export type ExportInput = {
  articleTitle: string;
  articleAuthors: string;
  articleDoi?: string;
  questions: ExportQuestion[];
  overall: StoredAttempt | null;
  overallQuestion: string;
};

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } });
}

function body(text: string) {
  return new Paragraph({
    children: [new TextRun({ text })],
    spacing: { after: 120 },
  });
}

function labelled(label: string, text: string) {
  return new Paragraph({
    children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun({ text })],
    spacing: { after: 120 },
  });
}

function quoteBlock(attempt: StoredAttempt) {
  const fb = attempt.feedback;
  if (fb.quoteVerified && fb.quote) {
    const role = fb.quoteRole === 'supports'
      ? 'From the article — this passage supports the learner’s answer:'
      : fb.quoteRole === 'challenges'
        ? 'From the article — this passage challenges the learner’s answer:'
        : 'From the article — the passage the learner’s answer connects to:';
    return [
      new Paragraph({
        children: [new TextRun({ text: role, bold: true })],
        spacing: { after: 60 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `“${fb.quote}”` })],
        spacing: { after: 60 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `${fb.quoteReference || 'Your article'} — verified word for word in your article.`,
            size: 18,
            color: '666666',
          }),
        ],
        spacing: { after: 120 },
      }),
    ];
  }
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: 'No quote is shown: the coach\u2019s passage could not be verified word for word in your article, so it was withheld.',
        }),
      ],
      spacing: { after: 120 },
    }),
  ];
}

function attemptParagraphs(prefix: string, attempt: StoredAttempt) {
  const paragraphs = [
    heading(prefix, HeadingLevel.HEADING_3),
    labelled('Answer', attempt.answer),
    labelled('Rating', attempt.feedback.rating),
    labelled('What the learner got right', attempt.feedback.gotRight),
    ...quoteBlock(attempt),
  ];
  // For Emerging or Developing, the plain-language key idea comes before the follow-up.
  if (attempt.feedback.conceptNote && attempt.feedback.rating !== 'Proficient') {
    paragraphs.push(labelled('Key idea', attempt.feedback.conceptNote));
  }
  paragraphs.push(labelled('Follow-up question', attempt.feedback.followUp));
  return paragraphs;
}

export function buildCritiqueDocument(input: ExportInput): Document {
  const children: Paragraph[] = [
    heading('ResearchForge AI — Critique', HeadingLevel.TITLE),
    heading(input.articleTitle || 'Untitled article', HeadingLevel.HEADING_1),
  ];
  if (input.articleAuthors) children.push(body(input.articleAuthors));
  if (input.articleDoi) children.push(body(`DOI: ${input.articleDoi}`));
  children.push(
    body(
      'The learner wrote every answer below; the coach rated the reasoning and quoted the article.',
    ),
  );

  input.questions.forEach((q, i) => {
    children.push(heading(`${i + 1}. ${q.label}`, HeadingLevel.HEADING_2));
    children.push(labelled('Question', q.question));
    if (!q.attempts.length) {
      children.push(body('No answer submitted.'));
      return;
    }
    children.push(...attemptParagraphs('First answer', q.attempts[0]));
    if (q.attempts[1]) children.push(...attemptParagraphs('Revised answer', q.attempts[1]));
  });

  children.push(heading('Overall judgment', HeadingLevel.HEADING_2));
  children.push(labelled('Question', input.overallQuestion));
  if (input.overall) {
    children.push(...attemptParagraphs('Overall judgment', input.overall));
  } else {
    children.push(body('No overall judgment submitted.'));
  }

  return new Document({
    title: `ResearchForge critique — ${input.articleTitle || 'Untitled article'}`,
    subject: 'Research appraisal critique with coach ratings and verified article quotes',
    creator: 'ResearchForge AI',
    description: 'The learner wrote every answer; the coach rated the reasoning and quoted the article.',
    sections: [{ children }],
  });
}

export async function buildCritiqueDocxBlob(input: ExportInput): Promise<Blob> {
  return Packer.toBlob(buildCritiqueDocument(input));
}

/**
 * Clean copy for handing in: title, authors, DOI, then each question with
 * the student's latest answer and its rating, and the overall judgment.
 * No coach text of any kind — no got-right notes, quotes, Key ideas, or
 * follow-up questions.
 */
export function buildResponsesDocument(input: ExportInput): Document {
  const children: Paragraph[] = [
    heading('ResearchForge AI — Responses', HeadingLevel.TITLE),
    heading(input.articleTitle || 'Untitled article', HeadingLevel.HEADING_1),
  ];
  if (input.articleAuthors) children.push(body(input.articleAuthors));
  if (input.articleDoi) children.push(body(`DOI: ${input.articleDoi}`));

  input.questions.forEach((q, i) => {
    children.push(heading(`${i + 1}. ${q.label}`, HeadingLevel.HEADING_2));
    children.push(labelled('Question', q.question));
    const latest = q.attempts[q.attempts.length - 1];
    if (!latest) {
      children.push(body('No answer submitted.'));
      return;
    }
    children.push(labelled('Answer', latest.answer));
    children.push(labelled('Rating', latest.feedback.rating));
  });

  children.push(heading('Overall judgment', HeadingLevel.HEADING_2));
  children.push(labelled('Question', input.overallQuestion));
  if (input.overall) {
    children.push(labelled('Answer', input.overall.answer));
    children.push(labelled('Rating', input.overall.feedback.rating));
  } else {
    children.push(body('No overall judgment submitted.'));
  }

  return new Document({
    title: `ResearchForge responses — ${input.articleTitle || 'Untitled article'}`,
    subject: 'Research appraisal responses with ratings',
    creator: 'ResearchForge AI',
    description: 'Student responses to the five critique questions and the overall judgment, with ratings.',
    sections: [{ children }],
  });
}

export async function buildResponsesDocxBlob(input: ExportInput): Promise<Blob> {
  return Packer.toBlob(buildResponsesDocument(input));
}

function slugify(articleTitle: string): string {
  return (articleTitle || 'article')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'article';
}

export function critiqueFilename(articleTitle: string): string {
  return `researchforge-critique-${slugify(articleTitle)}.docx`;
}

export function responsesFilename(articleTitle: string): string {
  return `researchforge-responses-${slugify(articleTitle)}.docx`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
