# Mock Studio log — Voice + text workbench

## Baseline — behavioral browser entrypoint

Measured against the live example at 1440×900, 768×900, and 390×844.

| Dimension | Score | Evidence |
| --- | ---: | --- |
| Hierarchy | 1/5 | Browser-default controls provided no focal flow or separation between conversation, artifacts, and commits. |
| Density | 1/5 | The composer was cramped into one line while nearly the entire canvas was unused. |
| Accessibility | 2/5 | Prompt buttons measured 22px high and the textarea 37px high. |
| Consistency | 1/5 | Default Times typography, transparent host, and no project token system. |
| Responsive | 2/5 | No document overflow, but the same desktop control row persisted at mobile widths. |
| Affordance | 2/5 | Both prompt buttons read the same textarea and produced the same visible outcome; speech input and speech output were conflated. |

## Round 1 — multimodal semantic workbench

Approved direction: one composer and Send action; microphone capture as a distinct input path; speech playback as an independent output preference; semantic artifact and Ignite runtime evidence visible together.

Reference grounding:

- [Manus composer](https://mobbin.com/screens/1b9d1b2a-8a31-4a24-97fb-ebf1e284154a) — one primary composer with adjacent microphone and send affordances.
- [Built for Mars: Contextualising dates](https://builtformars.com/ux-bites/contextualising-dates) — make a hidden distinction explicit at the point of action.
- General Ignite engineering principle — actor state stays authoritative while browser media and speech synthesis remain explicit adapters.

Measured in the live local harness at 1440×900, 1280×800, 768×900, and 390×844:

- Document horizontal overflow: 0px at every viewport.
- Document vertical overflow: 0px at every viewport; panels scroll internally.
- Visible interactive targets: at least 32px on desktop and 44px at 768/390.
- Browser runtime log: no errors.
- Designed states exercised: ready, listening, responding, artifact, and microphone permission.
- Interaction proof: speech capture → transcript → prompt fact → response → artifact commit; document/schema switch; speech playback toggle; mobile Chat/Artifact/Runtime navigation.

| Dimension | Score | Evidence |
| --- | ---: | --- |
| Hierarchy | 5/5 | Conversation intent leads into the semantic artifact; runtime evidence is visible but subordinate. |
| Density | 4/5 | Three purposeful desktop regions fit without page scroll; mobile exposes one task region at a time. |
| Accessibility | 4/5 | Token contrast is deliberately high, focus-visible states are explicit, reduced motion is honored, and measured targets pass; automated axe remains an implementation parity requirement. |
| Consistency | 5/5 | Every production-facing color is sourced from `tokens.css`; components share one spacing, radius, and typography system. |
| Responsive | 5/5 | Layout moves from three columns to single-panel mobile navigation with zero page overflow at all measured breakpoints. |
| Affordance | 5/5 | Text input, speech capture, speech output, actor progress, artifact state, schema inspection, and commit receipts have distinct controls and feedback. |

Round 1 established the visual direction. Round 2 and its artifact-proof correction supersede it as the approved production-port source.

## Round 2 — one component, authorized turn, three commits

Approved direction: make the example teach one literal `igniteCore(...)` component across headless, browser, terminal, and speech consumers; show the model proposing from `getSchema()` while the actor authorizes; render semantic artifacts rather than generated DOM; and keep browser-only controls out of the model-facing manifest.

Reference grounding:

- [Fabric document + assistant](https://mobbin.com/screens/21fb14d0-050a-44d7-92c0-620455db92af) — keep the authored artifact primary while assistance stays contextual.
- [Langdock chat + canvas](https://mobbin.com/screens/579fb137-50fa-42d0-9222-4970f35648d5) — maintain continuity between conversation and a structured working surface.
- [Replit agent actions + console](https://mobbin.com/screens/9d5d7187-c5ad-49ff-9555-2bc3c7c53a07) — expose consequential agent actions as inspectable evidence.
- [LangChain graph + trace](https://mobbin.com/screens/ed018d3a-df6a-4ae4-bd1a-905b80fc93d0) — use a causal trace to explain runtime behavior without turning the interface into a debugger.
- [Manus voice transcription](https://mobbin.com/screens/c19c77b7-6f0d-41a7-9555-b51b4c99bbed) and [Gemini listening](https://mobbin.com/screens/c46560e0-79a0-4471-aeda-1caa69abdf47) — distinguish temporary capture state from the authoritative conversation state.
- [Built for Mars: Canva can also do this](https://builtformars.com/ux-bites/canva-can-also-do-this) — teach the capability at the moment its evidence becomes useful.
- [Built for Mars: Try our demo mode](https://builtformars.com/ux-bites/try-our-demo-mode) — use tangible, populated example data instead of an empty capability tour.

Measured in the live local harness at 1440×900, 1280×800, 768×900, and 390×844 across `ready`, `listening`, `responding`, `artifact`, and `permission`:

- 20 viewport/state combinations passed with 0px horizontal and page overflow.
- Visible button, tab, link, and textarea targets are at least 32px desktop and 44px at 768/390.
- Mobile exposes exactly one task panel at a time; the fixed Chat/Artifact/Runtime navigation remains visible without colliding with the teaching footer.
- Replay advances the six-step causal trace; speech capture preserves actor `ready`, then the transcript enters through `submitPrompt` and commits revision 3.
- Document/Schema switching and spoken-summary playback produce explicit local state and runtime evidence.
- Browser runtime log contains no warnings or errors.

| Dimension | Score | Evidence |
| --- | ---: | --- |
| Hierarchy | 5/5 | The artifact remains the visual outcome while the right rail explains one component, authorization, and channel commits in causal order. |
| Density | 4/5 | The teaching rail is information-rich but chunked into four compact cards; mobile makes it independently scrollable. |
| Accessibility | 4/5 | Measured targets, semantic roles, focus-visible treatment, reduced motion, and modality labels pass the prototype gate; automated axe remains an implementation requirement. |
| Consistency | 5/5 | The new trace, schema proof, channel receipts, and policy rejection reuse the Round 1 token and component grammar. |
| Responsive | 5/5 | All 20 state/viewport combinations have zero page overflow and the mobile shell keeps its task navigation fixed. |
| Affordance | 5/5 | Proposal, authorization, revision storage, independent commits, replay, speech capture, and speech playback each have distinct evidence and controls. |

Teaching clarity improved materially: the UI now answers what Ignite owns, what the outer adapters own, what the model may propose, what the actor accepted, and what each projection committed.

### Round 2 correction — make the artifact the proof

Human review found that the causal rail claimed a revision without changing the center document, and supplied screenshots showing three concrete collisions: an oversized session-summary row, runtime cards clipping their final content, and the Mock Studio navigator covering the final proof card.

Corrections applied:

- Text Send and speech Use transcript now exercise the same deterministic revision fixture. Both append the prompt to the conversation, advance revision 2 to revision 3, add the adoption-plan semantic node to the center document and schema, and update the browser commit receipt.
- A live-proof banner above the artifact explains the action and expected result before the user sends anything.
- The conversation grid now declares all four rows explicitly; the summary is a compact three-column stat strip at every breakpoint.
- Runtime cards use max-content grid rows and internal panel scrolling, so actor facts, all six trace steps, all three channel commits, and the rejected-command proof remain intact.
- The prototype navigator occupies dedicated footer chrome on desktop and app-bar chrome on tablet/mobile instead of floating over product evidence.

Revalidation evidence:

- Text path: `Text prompt` → revision 3 → visible `plan` node → schema revision 3 → browser commit revision 3.
- Speech path: capture adapter keeps actor `ready`; transcript enters `submitPrompt`; revision 3 records `speech prompt · actor authorized` and opens the revised artifact.
- 25 state/viewport combinations passed at 1920×1080, 1440×900, 1280×800, 768×900, and 390×844.
- Every combination has 0px horizontal/page overflow, no clipped runtime card, no undersized visible control, compact summary height, and the prototype navigator contained by dedicated chrome.

The corrected prototype makes a narrower and more defensible claim: Ignite Element keeps the actor-owned semantic artifact authoritative while multiple input adapters and output consumers share one typed component contract. The Mock Studio fixture demonstrates the UX; the production example must prove the behavior through `igniteTest`, the headless runtime, and then the real projections.

### Human approval and implementation handoff

Approved on 2026-07-13: Round 2 plus the artifact-proof correction may move from Mock Studio into the production POC/MVP. The implementation starts empty, uses consumer-configured real MLX for the optional live path, keeps microphone transcription outside `igniteCore`, validates the full semantic-node contract, derives evidence from runtime facts, and treats the static adoption-plan content as prototype-only.

## Production POC/MVP implementation receipt — 2026-07-13

The implementation now includes a test-only production parity entrypoint. It
uses the real Ignite component and projection while allowing only `ready`,
`listening`, `responding`, `artifact`, and `permission` fixtures. Its
deterministic semantic artifact is explicitly labeled as parity-only and is not
production seed data.

Implementation verification passed:

- 10 Vitest files and 36 tests, including all five states through the
  `igniteTest` accessibility bridge.
- TypeScript typechecking and a Vite build containing both `index.html` and
  `parity.html`.
- Ten WCAG AA token-pair assertions and a non-shrinking 44px target contract
  for visible controls.
- No imperative `querySelector` guard in the parity entrypoint.

Final rendered-browser evidence lives at
`/private/tmp/ignite-voice-workbench-parity-20260713-final` with 25 PNGs and
`measurements.json`. All five states passed at 1920×1080, 1440×900, 1280×800,
768×900, and 390×844: no failures or browser logs, zero maximum horizontal
overflow, every visible target at least 44px, every proof selector visible, and
correct actor, voice, and active-panel state. The permission draft was preserved
exactly. This final directory supersedes all pre-fix captures.

## Gate 0 amendment — 2026-07-17

The Round 2 visual direction remains valid, but the older handoff text drifted
from the live implementation. Gate 0 corrects the architecture narrative only:

- the component blueprint is 19 public commands, not five;
- the session is a compound parent with `turn`, `voice`, and `speech` regions,
  not a ready/responding-only machine;
- `model-turn`, `voice-capture`, and `speech-delivery` are implemented child
  actors with correlated receipts and terminal outputs;
- the runtime already separates the full component blueprint from the narrower
  availability-scoped model manifest.

No new UI direction is introduced by this correction. The approved visual
baseline, token system, responsive behavior, and parity harness receipts remain
the retained design source. On 2026-07-17, the user approved beginning the
downstream chain after committing and properly closing out this Gate 0 branch,
so the architecture amendment is now the approved downstream contract.
