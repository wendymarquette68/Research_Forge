# Accessibility manual test script (WCAG 2.1 AA)

Use this before claiming ADA Title II conformance. Tick each box only when you actually did it.
Record the date, tester, browser, and screen reader used at the top of your run.

**Run:** ______  **Tester:** ______  **Browser/version:** ______  **Screen reader/version:** ______

Setup: `npm run dev:server` and `npm run dev:client` from the project root, then http://localhost:5173.
Test article: the Sörman article (link in PROGRESS.md). Unplug the mouse for sections 1–2.

## 1. Keyboard only

- [ ] First Tab shows **Skip to main content**, and Enter moves focus to the main area.
- [ ] Every button and field can be reached in a sensible order, with the dark outline (plus yellow halo on dark buttons) always easy to see.
- [ ] Complete the whole flow by keyboard alone: paste article → Start the critique → answer Q1 → Submit → Revise once → submit revision → Next question through Q5 → overall judgment → Download Word document.
- [ ] After each Submit, focus lands on the new feedback (not back at the top of the page) and I can keep tabbing from there.
- [ ] Moving to the next question puts focus on its heading; Finishing puts focus on the Critique summary heading.
- [ ] No keyboard trap anywhere; Shift+Tab goes backwards safely; the summary table can be reached and left.

## 2. Screen reader (NVDA on Windows first; VoiceOver/JAWS if available)

- [ ] Headings list (NVDA: Insert+F7) reads sensibly: one H1 "ResearchForge AI", then section headings, no jumps that confuse.
- [ ] Every form field announces its label (Article title, Authors, Full article text, Your answer, Your overall judgment).
- [ ] The word-count / 25-word hint is announced with its field, and a too-short or failed submit announces the error.
- [ ] Sending an answer announces that coach feedback arrived **and its rating**; the quote and its passage reference read out in order.
- [ ] Question progress announces "Question N of 5 — <label>", and the summary table announces its caption, column headers, and each row's first vs revised rating.
- [ ] Overall feedback, then "You can now download the Word document" are announced; after downloading, completion is announced.

## 3. Automated check

- [ ] axe DevTools (browser extension, free) on each screen — intake, a question before feedback, a question with feedback, summary before and after overall judgment: **0 critical, 0 serious**.
- [ ] Lighthouse Accessibility (DevTools, desktop + mobile): record scores here — intake ____ / question ____ / summary ____. Fix or explicitly accept anything below 100.

## 4. Zoom, reflow, and motion

- [ ] At 200% zoom (1280px wide) nothing is cut off and there is no sideways scrolling except the summary table region.
- [ ] At 400% / 320px wide the flow still works one-column; every button remains usable.
- [ ] With Windows "reduce motion" on (or browser reduced-motion emulation), nothing animates jarringly.

## 5. The Word document itself

- [ ] Open the downloaded .docx in Word. Navigation Pane (headings) shows: article title, the five questions, Overall judgment.
- [ ] Word's built-in Accessibility Checker (Review → Check Accessibility): no errors. Fix any warning or write down why it is accepted.
- [ ] With the screen reader, spot-read the document: title/authors, one question with first + revised answers and ratings, one quote with its passage reference, the overall judgment.
- [ ] Ratings and quotes are understandable as plain text (nothing depends on color alone).

## Sign-off

- [ ] All boxes above ticked, or every failure is logged below with an owner and a fix date.
- [ ] Only then update PROGRESS.md wording to claim conformance, naming the standard (WCAG 2.1 AA), testers, tools, and date.

Failures / accepted issues:

| # | Where | Problem | Owner | Fix by |
|---|---|---|---|---|
| 1 |  |  |  |  |
| 2 |  |  |  |  |
