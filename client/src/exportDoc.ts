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
    return [
      new Paragraph({
        children: [new TextRun({ text: `“${fb.quote}”`, italics: true })],
        spacing: { after: 60 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `${fb.quoteReference || 'Pasted article'} — verified word for word in the pasted article.`,
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
          text: 'No quote is shown: the coach\u2019s passage could not be verified word for word in the pasted article, so it was withheld.',
          italics: true,
        }),
      ],
      spacing: { after: 120 },
    }),
  ];
}

function attemptParagraphs(prefix: string, attempt: StoredAttempt) {
  return [
    heading(prefix, HeadingLevel.HEADING_3),
    labelled('Answer', attempt.answer),
    labelled('Rating', attempt.feedback.rating),
    labelled('What the learner got right', attempt.feedback.gotRight),
    ...quoteBlock(attempt),
    labelled('Follow-up question', attempt.feedback.followUp),
  ];
}

export function buildCritiqueDocument(input: ExportInput): Document {
  const children: Paragraph[] = [
    heading('ResearchForge AI — Critique', HeadingLevel.TITLE),
    heading(input.articleTitle || 'Untitled article', HeadingLevel.HEADING_1),
  ];
  if (input.articleAuthors) children.push(body(input.articleAuthors));
  children.push(
    body(
      'Research appraisal training. The learner wrote every answer below; the coach rated the reasoning and quoted the article. This is not medical advice.',
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

  return new Document({ sections: [{ children }] });
}

export async function buildCritiqueDocxBlob(input: ExportInput): Promise<Blob> {
  return Packer.toBlob(buildCritiqueDocument(input));
}

export function critiqueFilename(articleTitle: string): string {
  const slug = (articleTitle || 'article')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `researchforge-critique-${slug || 'article'}.docx`;
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
