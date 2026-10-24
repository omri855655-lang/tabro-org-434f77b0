# Nutrition journal

The nutrition workspace combines the existing account health profile with a
device-local reviewed meal journal and a daily summary. Nothing is added to the
journal until the user confirms the meal. Photo analysis is an estimate, not a
measurement; users can correct portions and nutrients before or after saving.

## Calculation and Safety

- `nutritionPlan.ts` implements the simplified Mifflin-St Jeor equation from
  <https://pubmed.ncbi.nlm.nih.gov/2305711/>. An approximate activity multiplier
  (1.2 to 1.9) produces a maintenance estimate, rounded to 50 kcal.
- Maintenance is the default. Optional gradual loss/gain adjusts by up to
  250 kcal. App guardrails do not allow a target below 1,500 kcal or estimated
  resting needs. These guardrails are product choices, not clinical guidance.
- Automatic estimates require explicit adult eligibility confirmation. There
  is no automatic target for minors, pregnancy/breastfeeding, eating disorders,
  medical nutrition needs, out-of-range inputs or an underweight loss goal.
  Food logging still works without a target. See also the scope disclaimer at
  <https://www.niddk.nih.gov/bwp>.
- Exercise calories are not automatically added. A negative balance is shown
  neutrally as above-estimate, never as an instruction to skip or compensate.
- Historical-day summaries use the currently saved profile and goal, not
  historical target snapshots. Totals include only logged meals.

## Persistence and Privacy

- A personal daily calorie goal can be saved or cleared to return to automatic
  estimates. The same eligibility and profile checks apply; custom goals must
  be integer values from 1,500 to 5,000 and no lower than estimated resting
  needs. These limits are application guardrails, not individual medical advice.
- A sticky today-only summary remains visible across nutrition and sleep tabs;
  the journal below can still browse historical days independently.
- The available-food form sends ingredients to the existing coach alongside the
  selected day's context. Suggestions never create meal records automatically.
- Health XML import now includes active energy (kcal/kJ) and exercise minutes.
  Source totals use the largest single source per day to avoid double counting,
  which can undercount disjoint sources. Activity does not increase food targets.

- Existing `health_profiles` and its RLS remain unchanged.
- Meals use the existing `tabro-meals:<userId>` browser key. The old 100-row
  truncation was removed. Capacity failures are reported without clearing data.
- Goal/eligibility uses `tabro-nutrition-plan:<userId>`. These preferences and
  meals do not sync across devices. They are browser storage, not encrypted
  medical storage. Do not store patient records on shared devices.
- Account switches remount the workspace. Browser storage events refresh
  other tabs; writes first read the latest stored journal.
- Profile loading errors disable saving, preventing an empty fallback profile
  from overwriting an existing account profile.
- Images are sent for AI analysis only after the Analyze action and are not
  persisted in the journal. Coach questions send a whitelisted profile, selected
  goal and the selected day's meals, never ethnicity or the full meal history.
- `nutrition-coach` and `sleep-coach` remain authenticated branches of
  `task-ai-helper`. The server validates conversation roles and recomputes the
  target instead of accepting a client-provided allowance. The prompt limits
  the assistant to education, not diagnosis or treatment.

## Verification

Run the app tests with `node --experimental-strip-types --test tests/*.test.mjs`.
`tests/nutritionPlan.test.mjs` covers equation arithmetic, safe bounds, selected
local-day totals, updates/deletion, invalid history, language completeness,
coach context validation and function-copy parity.

The development-only UI fixture `/tests/fixtures/nutritionTracker.html` uses a
fake adult profile and a separate local test namespace. It makes no AI or
account requests. A confirmed eligible 30-year-old, 180 cm, 80 kg male profile
with moderate activity estimates 2,750 kcal. Saving 500 kcal leaves 2,250;
editing it to 600 leaves 2,150; deleting restores 2,750. Past-day entries must
not affect today's totals. Also check desktop, 390 px, Hebrew, English and Arabic.

The independent-hosting branch uses direct AI and requires its own configured
provider key and backend deployment. Do not invoke the paid Lovable agent to
deploy these changes. Keep the function-local `nutritionPlan.ts` identical to the app
copy; only `supabase/functions/` is bundled during edge deployment.

Actual photo estimation and native Apple Health integration require additional
end-to-end checks. No native watch connection is implied by the calorie journal.
