# ResearchForge AI — instructions for testers

Thank you for testing. This takes about 20–30 minutes. Your feedback will be used to fix problems before students use the app.

## What you are testing

ResearchForge AI coaches students to judge the strength of one scholarly article. It never writes the answer for them.

Your job is to use it like a student would, then tell us what broke, confused you, or felt wrong. There are no wrong comments — if something puzzled you, that is a finding.

## You will need

- A computer with Chrome or Edge.
- The test article (below). Do **not** use a real student's work, patient information, or an unpublished manuscript.
- Optional but very welcome: keyboard-only testing (unplug/ignore the mouse) or a screen reader (NVDA is free on Windows).

## Getting in

Wendy will give you one of these — ask her which:

- **A link** to the running app (starts with `http://`), **or**
- **Start it yourself:** from the project folder run `npm run dev:server` in one terminal and `npm run dev:client` in a second terminal, then open http://localhost:5173.

If the page says "Back end not reachable," stop and tell Wendy. Do not try to fix servers or settings.

**Test article:** Sörman et al. (2025), "Virtual patient simulation strengthens confidence in clinical conversations among undergraduated nursing students," *BMC Medical Education*. Open access:
https://link.springer.com/article/10.1186/s12909-025-08413-y

Copy the article text from the page (or ask Wendy for the text file) so you can paste it into the app.

## Please do these tasks, in order

1. **Start.** Paste the article text, add the title and authors, choose **Start the critique**. Note how long it takes and whether waiting was clear.
2. **Question 1, short answer first.** Type a very short answer (under 25 words) and try to submit. What happens? Is the reason clear?
3. **Question 1, real answer.** Write at least 25 words judging the research question and background, submit, and read the coach feedback. Check: is there a rating, a "what you got right," a quoted passage, and a follow-up question? Does the quote match the article word for word (spot-check it)?
4. **Revise once.** Choose **Revise once**, improve your answer, submit. Then try to revise the same question again — you should not be able to.
5. **Questions 2–5.** Answer each one (at least 25 words). You may write plain, imperfect answers — you are testing the coach, not yourself. Watch for feedback that is unfair, repeats itself, gives away a model answer, or quotes something not in the article.
6. **Reload.** Halfway through (for example on Question 3), refresh the browser page (F5). Your earlier work should still be there. Tell us if anything vanished.
7. **Overall judgment.** After Question 5, write the overall judgment (trust and use, at least 25 words) and submit.
8. **Download.** Choose **Download Word document**, open the file in Word, and check it contains: the article title/authors, all five questions with your first and revised answers and ratings, the quotes, and your overall judgment.
9. **If you can:** repeat part of the flow with **keyboard only** (Tab/Shift+Tab/Enter), and/or read the feedback with a screen reader. Extra credit: browser zoom at 200%.

Please also just explore. Confusing wording, dead ends, anything that feels slow, and anything you expected to find but could not — write it down.

## How to report each problem

One report per problem. Copy this block:

```
Screen/step: (e.g. Question 2, after Submit)
Device & browser: (e.g. Windows laptop, Chrome)
Assistive tech, if any: (e.g. none / keyboard only / NVDA)
What I did: (1–3 short steps)
What I expected:
What actually happened:
How bad is it? (Blocker / Annoying / Minor — see below)
Screenshot attached? (yes/no — please attach one for every Blocker or Annoying problem if you can; a phone photo of the screen is fine)
```

Severity guide:

- **Blocker** — I could not continue, lost my work, got an answer the coach should not give (e.g. it wrote the appraisal for me), or a quote that is not in the article.
- **Annoying** — I finished, but it was confusing, slow, unfair, or hard to see/hear/use.
- **Minor** — typos, wording, spacing, anything that just looks off.

Send reports to Wendy (email or the shared doc she names). Please include a screenshot whenever you can — it is the fastest way for us to see exactly what you saw. If a screenshot is not possible, copy the exact wording of any message you saw.

## Ground rules

- This is research-appraisal training, **not medical advice** — flag anything that reads like clinical guidance.
- The AI must **coach, never write the student's answer**. If it hands over a ready-made appraisal, that is always a Blocker.
- Every quote must exist **word for word** in the pasted article. A near-miss quote is a Blocker.
- Do not paste real student work, unpublished research, or anything confidential into the app.

Thank you — be picky. Finding it now is the whole point.
