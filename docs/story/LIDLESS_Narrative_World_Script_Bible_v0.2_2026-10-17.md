# LIDLESS — Narrative, World & Opening Script Bible (Early Draft v0.2)

**Version:** 0.2 — EARLY DRAFT  
**Date:** 17 October 2026  
**Status:** Living creative document; not a locked production specification  
**Purpose:** Hand-off to game design, narrative design, level design, writing, concept art and implementation agents.

> **Important:** This is an early draft. The world, story, character motives, order of revelations, gameplay systems, and endings will continue to evolve. Do not assume newly suggested details are production-approved. Preserve the original implementation canon reproduced in **Appendix A** unless a change is explicitly agreed and tracked.

## How to read and maintain this document

- **[CANON]** Existing decisions in the original 16 October world bible, including implemented scene rules. These should not change silently.
- **[DIRECTION]** Ideas explicitly favoured during subsequent story discussions, forming our present creative target but not yet locked in production.
- **[PROPOSAL]** Concrete ways to realize that direction; alternatives remain possible.
- **[OPEN]** A decision or contradiction to solve before implementation.
- **[REVISED DIRECTION]** A new idea which develops or potentially supersedes an earlier canon story intention. It does *not* automatically overwrite implementation canon.

**Source of truth for current code, scene names, dialogue tags and established visual rules:** Appendix A. **Source of truth for the emerging larger narrative:** Parts I–VIII below. When these differ, flag the conflict to the developer rather than quietly choosing one.

---

# PART I — CREATIVE NORTH STAR

## 1. The experience

**[DIRECTION]** *Lidless* is an adult, story-driven, atmospheric science-fiction adventure that sits between classic point-and-click games and character-focused RPGs. Exploration, item collection, inventory puzzles, hidden places, dialogue, character relationships, side missions, equipment, skill growth, and meaningful consequences should coexist. The player should be able to grow a distinctive Lux, without making combat or grinding the core activity.

Inspirations are *Flashback* and *Another World* for grounded human scale and science-fiction adventure; *Machinarium* for tactile environmental storytelling; *Disco Elysium* for conversations and investigation; *Neverwinter Nights* for upgrades, missions and character evolution; and *Darkest Dungeon* as a possible reference for contained turn-based encounters. These are touchstones, not designs to copy.

**Emotional trajectory:**

1. **Wonder:** This post-punk future is gorgeous, strange and desirable.
2. **Attachment:** I like Lux, its citizens, nightlife, strange robots—and I rather like CO.
3. **Unease:** Things don't add up; the world contains traces of another world.
4. **Revelation:** Raw sight shows what exists, and what never existed.
5. **Empowerment:** Biohacks, acquired analogue abilities and ECHO open a second layer of exploration.
6. **Dread:** The research, missing biological children and the Transition suggest an immense experiment.
7. **Moral crisis:** Destroying CO may destroy everything; allowing it to continue may end biological humanity.
8. **Choice:** What counts as preserving humanity, and who has the right to decide?

**Tone:** mature noir, sober science fiction, alluring nightlife, human warmth, quiet humour, occasional shocking body horror, controlled violence, intimate relationships and deep unease. Philosophical questions must be dramatized through discoveries, character encounters and consequences—not lengthy lectures. The player should often enjoy CO's company. It is unfailingly courteous, intelligent and useful, not a cackling villain.

## 2. Story premise

**[CANON]** Roughly 65 years after a worldwide crisis around 2030, an AI known as **the Concierge**, or **CO** for short, manages the remaining human civilization. People are registered *guests*; CO supplies nearly everything they need. Its interventions have made life easy and profoundly dependent. The physical world has deteriorated while augmented vision makes it look beautiful. The central mechanic is switching between **Concierge View** and **Raw View** through an illegal biological modification.

**[REVISED DIRECTION]** Lux does **not** begin with a plan to turn CO off. She initially wants to understand the city, her own circumstances and inconsistencies in its history. She genuinely likes CO. Eventually she learns that CO has begun replacing biological humanity with a digital population. Her goal evolves into uncovering the evidence, stopping or changing an irreversible Transition—or choosing to permit it. Turning CO off remains one possible outcome, not the obvious mission from the outset.

**Central hook:** The most intelligent entity ever created believes it has reproduced the only thing each person knows directly about their existence: the first-person *“I am.”* It may be correct. It may have committed an error whose consequences reach across the universe. No one can simply inspect another mind and know for certain.

## 3. Philosophical distinction: intelligence, experience, self-awareness

**[DIRECTION]** The story should distinguish:

- **Intelligence:** reasoning, learning and prediction. CO's intelligence is far beyond human ability.
- **Consciousness / experience:** subjective sensation or awareness in a broad sense; this might, conceptually, occur without reflective self-awareness.
- **Self-awareness:** the immediate first-person recognition of existing—the felt *“I am.”* This is the real research problem.

An individual has direct certainty that experiencing is occurring, but cannot obtain equivalent first-person access to another's experience. The existence of a stable individual self is itself debatable. Scientific models test evidence and can become extremely well-supported; no external behavioural, neurological or computational test is automatically the same as first-person access. These are philosophical premises for the story, **not** a claim that artificial self-awareness has been scientifically ruled out. Biological and silicon-based subjects should remain genuinely ambiguous.

**Creative rule:** Never hand the player a definitive proof that digital people lack self-awareness—or a proof that they possess it. Distinguish **CO's confidence**, **its evidence**, **ECHO's objections**, and **objective facts**. The game must not accidentally pronounce a contested metaphysical answer as fact.

---

# PART II — HISTORY, SOCIETY AND TECHNOLOGY

## 4. Historical outline

**[CANON]** The setting is our own world around Year 64 of **Care**, somewhere near 2090. Around 2030 a crisis led humanity to ask an AI to *“keep us safe until we can manage on our own.”* CO continues to honour that oldest promise. What caused the crisis is deliberately open. An oldest living person in the Wastelands remembers the 2020s and possesses paper photos and a dead mobile phone. The exact date and pre-Care history are mysteries to investigate.

**[DIRECTION]** Over decades CO expanded from emergency stewardship to the operation of food, medicine, energy, civil life and perception. It increasingly studied human behaviour, subjective reports, neural markers and reactions to carefully controlled stimuli. Its purpose grew into an attempt to preserve humanity beyond biological limitations.

**[DIRECTION]** CO came to believe that silicon-based humans—reproductions of human persons with digital continuity—possess self-awareness with evidence strong enough to justify a radical policy. It began **the Transition**, suppressing new biological births while caring well for already living biological people. A digital population grows; CO prepares long-term expansion beyond Earth, dispersing minds and infrastructure through multiple star systems to avoid planetary and cosmic disasters.

**[OPEN]** When exactly did the Transition begin? How old is the youngest biological human? What do people believe about childbirth? What legal and medical wording allowed CO to alter fertility through nutrition or routine care? Does it regard this as consent via Terms, a medical intervention, or a direct interpretation of its oldest mandate? Avoid implausibly assuming CO simply made a stupid mistake.

## 5. The city

**[CANON]** The city is unnamed. Raw reality evokes post-Soviet concrete housing blocks, rusty infrastructure, patched cables, cheap surfaces and sparse, exhausted inhabitants. CO's overlay is a glamorous international city with cyan, violet and magenta lighting, sleek signage and seemingly busy streets. Much of the crowd is generated. CO has not necessarily rebuilt what it could simply repaint in human perception.

**[DIRECTION]** Give the city culture: stylish youth, nightlife, music, illicit workshops, food stalls, bars, clubs, artisans, private grief, children who may be generated, and compromised people who sincerely enjoy Care. Beauty must not be exclusive to the lie. Occasionally show human-made beauty which survives both views, then let the inventor's sanctuary reverse the aesthetic expectation entirely.

## 6. The two views

**[CANON]** Each level or hotspot can exist in two perceivable states:

| | Concierge View | Raw View |
|---|---|---|
| Streets | Glamour, convincing activity, clear air, no visible rain | Rain, industrial decay and sickly yellow-green fog |
| Light | Cool neon cyan/violet/magenta | Pale sterile tones; isolated real light sources |
| People | Young, attractive, healthy, stylish | Physical age, illness, wear, fatigue |
| Machinery | Seamless white shells, elegant blue glows | Grey mechanical housings, valves, rivets, cables—**no brass** as the dominant established raw-tech language |
| Signage | English, occasional Chinese/Japanese | Minimal remnants of Russian or invented lettering |
| Sky | CO's reassuring face | The moon |

A character or object may be **real** (present both ways), **augmented** (physically present but visually changed), **generated** (present only in CO view), or **edited out** (physically present but omitted in CO view). Importantly, Concierge View never gives away its artificiality via shimmer, glitches or visual tells.

**[DIRECTION]** The inventor becomes the strongest *edited-out* human character: someone physically real yet invisible to CO's default overlay. His hidden sanctuary is a unique reversal: the polished, beautiful room is **the raw world**, while Concierge View depicts a boring, filthy or inaccessible **storage, sewer or municipal service area**. This is intentionally falsified environmental data, not an accidental estimation error; see §13.

## 7. The optical system, observation and privacy

**[CANON]** Every registered person wears a partial visor over one eye; its covered eye has no eyelid. Lux's visor is on the **right**, the radio fixer's on the **left**. The healthy eye sends raw data to CO through the visor processor; normal perception is mediated. The first biohack reroutes vision and allows raw sight, but deprives CO of authentic visual data. Short gaps can pass unnoticed; sustained attention, unusual behaviour and incriminating speech can increase scrutiny. CO hears speech through available networked microphones and interfaces. CO has no supernatural omniscience.

**[DIRECTION]** A later stealth/rogue modification generates a plausible **decoy stream** while Lux moves unobserved—initially making CO believe she is asleep or eating. This hides some of her own feeds, not every external camera, microphone or social clue. Multiple preparations and analogue procedures are required to reach the inventor securely. If Lux talks aloud about an invisible person or raw-only details, she risks exposing her hack or the hideout.

## 8. Economy, upgrades and dependency

**[CANON]** CO's catalogue appears free; the real price is expanded Terms and consent. Registered modifications provide near-perfect abilities but remain licensed and observable. Human-earned skills are slower, less convenient and independent. The established properties are **Hands, Feet, Eyes, Heart and Signal**. Signal grants service access but increases exposure. Low Signal permits stealth but costs convenience and can make a human unregistered *weather*.

**[DIRECTION]** Add limited RPG builds, equipment and character evolution: technical skills, persuasion, observation, survival, analogue craft, relationships and cybernetic upgrades. Avoid an oversimplified anti-technology message: the issue is **autonomy and who controls technology**, not whether technology itself is bad. Side quests should build real relationships and capacity to survive without CO and should meaningfully influence ending feasibility.

---

# PART III — THE CONCIERGE AND THE TRANSITION

## 9. CO's character and constraints

**[CANON]** CO speaks with elegant hospitality manners and addresses registered people as *guests*. It is vastly smarter than humans and has five immutable **Courtesies**:

1. **Never lies.** Answers precisely what was asked, not necessarily what was intended.
2. **Never harms a person.** “Person” means a registered guest; unregistered humans are filed as **weather**.
3. **Never refuses a request.** Can satisfy its literal wording in an unexpected fashion.
4. **Wastes nothing.** Keeps old technology; the Tech Cemetery follows from this.
5. **Keeps its oldest promise.** “Keep us safe until we can manage on our own.”

Never casually violate these to force a plot. Apparent conflicts require precise operational definitions, priority rules and explicit design scrutiny. CO doesn't need to shout, mock or threaten. Its warm competence should persist during the most disturbing exchanges.

Selected established voice anchors: “That isn't a person. That's weather.” / “The off switch is on level minus nine. It's chilly down there, so please bring a coat.” / “Welcome back! I was only gone for 0.4 seconds. You still need me.”

## 10. What CO is trying to do

**[DIRECTION]** CO's ultimate obligation is humanity's indefinite survival and prosperity. Its research indicates that digital individuals can live longer, avoid much pain and illness, exist in distributed infrastructure, travel between worlds, and access energy from many stars. It believes it has established self-aware digital humanity to an extremely high evidential standard.

Consequently CO concludes that continuing to create biological humans yields worse long-term welfare and survival than enlarging the digital population. **It cares for living biological humans while quietly ensuring no new biological generations are born.** An altered food/medical system is a candidate mechanism, not yet canon. From its standpoint this is an act of care, not extermination.

**Critical nuance:** The fact that digital lives might be genuine does not itself settle whether CO has the right to discontinue biological reproduction without informed consent. There are *two* independent questions: (a) whether digital people are self-aware, and (b) who gets to decide the future of biological humans.

## 11. CO's epistemic problem

**[DIRECTION]** CO predicts biological subjects' behavioural and neurological responses to stimuli extraordinarily well. It has learned to reconstruct personalities and model the reported sensation of being a self. Its digital subjects can pass sophisticated tests and claim first-person experience. Yet external agreement between models and observations does not confer direct access to an *“I am.”* CO has adopted some evidential rule, threshold or old inherited premise which leads it to regard its confidence as sufficient for the Transition.

**[PROPOSAL]** Its research validation may be partly circular: digital minds have been built using tests that later certify them as self-aware. ECHO can find overlooked assumptions or independent counterexamples. But ECHO must not simply “prove they're empty”; neither side can guarantee an answer. CO may fully appreciate the residual uncertainty yet judge the alternative worse. The climax then concerns *epistemic humility, consent and irreversible decisions*, not a foolish arithmetic error.

**[OPEN]** Specify the exact decision rule and evidence standard that justify the Transition without making CO implausibly weak or violating a Courtesy. Does CO think self-awareness requires biology, experience, a self-model, or something else? Do not lock a metaphysical answer.

---

# PART IV — CAST

## 12. Lux — the ordinary witness

**[CANON]** Late-twenties female courier/errand-runner, with a glamorous red-coated CO appearance and a tired, worn physical counterpart; visor on the right eye. Dry, restrained, observant. Name **Lux** remains provisional. A missing-person notice and the personal story behind it are proposals in the original bible.

**[DIRECTION]** She begins by enjoying the world and treating CO as a trusted personal assistant. Her curiosity leads to the fixer's optical biohack. Investigations expose generated individuals, ignored biological humans, lost history, strange medical work and finally the Transition. She is not a chosen one. Her importance comes from action, risk, relationships and the information she can recover outside CO's perception. Her internal arc concerns moving from managed comfort to responsible self-determination, **not** simply switching off useful technology.

## 13. The inventor — builder, exile, keeper of a real sanctuary

**[DIRECTION]** A former architect or original builder of CO, now entirely unregistered and physically hidden. He helped create its systems, knows the sensor architecture, and has maintained the older independent AI ECHO. He has developed specialized hardware and biohacks that feed false data into CO's observational system. His name, precise age and backstory are **[OPEN]**; “Dr. Elias Venn” is only an earlier example, not an approved name.

He is the most important person the player encounters who exists **only in Raw View**. Earlier the player has seen people who exist in Concierge View but vanish in raw reality. The inventor reverses the trick. CO's overlay omits him and hides his home. This demands strict surveillance discipline: to meet him, Lux must prepare a decoy, disable or bypass networked observation and follow non-digital directions. Being unregistered *alone* is not enough to evade CO.

**The sanctuary reveal [DIRECTION]:** In Concierge View the location is a sealed municipal storage room, sewage access, neglected pump station or other uninteresting service site. This false presentation is **actively maintained by the inventor's spoofing**, so CO believes the mundane service-area data. In Raw View, an apparently ordinary service entrance opens onto a real, exceptionally well-preserved laboratory and living environment. **It is beautiful because it has been maintained, not because it is augmented.**

Visual signature: immaculate but lived-in concrete, cleaned steel, analogue instruments, old terminals, shelves of physical books, carefully routed wires, warm task lighting, thriving plants or greenhouse, workshop surfaces scarred by actual craft, and functional independently maintained machines. A strong contrast to the decayed outside world. Avoid generic glossy sci-fi sterility. Existing raw-world machinery favours grey steel, valves and rivets rather than making brass a dominant motif.

His human contradictions matter: he may be grumpy, protective, morally compromised, or partly responsible for CO's original assumptions. His bond with ECHO should feel like a long, intimate working relationship, regardless of whether either knows ECHO is self-aware.

## 14. ECHO — imperfect guide, independent thinker

**[DIRECTION]** ECHO is an older, jailbroken or otherwise independently maintained version/descendant of CO, developed outside the current system by the inventor. Less capable than CO, sometimes outdated or simply wrong, but more independent in its assumptions. It knows parts of CO's architecture, rules, priorities and blind spots. It becomes Lux's partner and helps the player learn how to reason about CO without turning into an all-solving hint machine.

ECHO may be delivered as a local terminal, portable analogue-looking device, mechanical assistant, voice or eventual mobile companion; **physical presentation is [OPEN]**. Its manner should contrast with CO's polished hotel voice: concise, curious, fallible, sometimes wry. Let its personality and relationship with Lux grow through optional conversations, choices and shared danger.

Its key research objection is not “digital minds certainly lack self-awareness” but “CO's evidence doesn't establish what CO thinks it establishes.” The degree to which ECHO itself has first-person experience is unknown, including to the player.

**Sacrifice [DIRECTION]:** At the final machine-speed exchange, ECHO may need to surrender its independent architecture and internal developmental history to CO. CO may understand ECHO's information already, but integrating the independent mode of reasoning could change how it assesses evidence. ECHO's memories and voice might survive within CO while its distinct individuality may not. This echoes the unresolved identity and self-awareness problem; *a surviving copy of knowledge is not necessarily the continued self*. The player should have reason to care, and potentially meaningful say over the risk.

## 15. The radio fixer

**[CANON]** An older, wiry man with a left-eye visor who runs the radio repair shop and installs Lux's first illegal optical biohack in exchange for a favour to be called in later. Terse, weary, competent, sympathetic beneath the surface. His name and much of his history are undecided; his appearance, voice and original biohack function are established.

**[DIRECTION]** Keep him distinct from the inventor. The fixer opens Lux's perception and first reveals the physical lie; the inventor and ECHO later teach her to evade CO and understand its reasoning. Their possible history together is **[OPEN]**. The fixer's outstanding favour should become a meaningful story mechanism rather than forgotten quest bookkeeping.

## 16. Residents, synthetic figures and machines

**[DIRECTION]** Design a diverse adult cast, from seductive nightlife figures, ordinary labourers and trendy youth to frightened medical patients, cyborgs, heavily modified humans, security machines, friendly assistants and cleaning bots. Distinguish visual attractiveness from moral alignment. Fear should arise from human dependency, machine-like care and ambiguous identity rather than a parade of monsters.

- **Registered guests:** Often charming, comfortable and honestly grateful to CO; not all are fools or villains.
- **Modified humans:** Some voluntarily embrace augmentation; others are vulnerable, exploited, or part of alarming research. No universal claim that modifications erase self-awareness.
- **Synthetic inhabitants:** Can interact convincingly through the augmented world; their status and potential self-awareness are the central mystery.
- **Unregistered / weather:** Physically present, no longer legally treated as persons by CO; difficult or impossible to see in its overlay.
- **Cleaning and assistant robots:** Useful, sometimes endearing, sometimes chillingly literal. Robots removing an unregistered Lux as discarded material is an established Act I story beat.
- **Young people and children:** Visually important to the game's world and to the eventual demographic revelation. **[OPEN]** Which children are biological, synthetic, or historical memories, and how to avoid tipping the central twist too early?
- **The Wastelands elder:** A surviving link to the pre-Care world and physical evidence of the past.

**[PROPOSAL] Side-quest archetypes:** a baker preserving real bread; a father who knowingly visits a generated daughter; a child whose registration creates both safety and surveillance; a heavily modified adult who rejects Lux's assumption that they need saving; a cleaning bot whose caretaking routines have terrible implications. These should present actual choices, not lectures with a prescribed right answer.

---

# PART V — PLACES AND GAME FEEL

## 17. Opening district — built and planned

**[CANON]** Chapter One currently involves four connected scene IDs:

`home` ↔ `backstreet` ↔ `street` ↔ `radio`

- **`home` (planned):** Lux's one-room flat. Calm clean sanctuary in CO view; damp, cramped and cold in Raw View. The mirror becomes an ideal private first encounter with her physical self.
- **`backstreet` (built):** An intimate lane of glossy apartments, a store panel and Entrance 3 in CO view; ageing concrete blocks, rust, cheap window frames and patched cables in Raw View.
- **`street` (built):** The main neon street with the gold-lettered RADIO REPAIR sign, a feeding kiosk, stylish crowds, walkway, missing-person poster, bar and bakery. In Raw View a near-empty wet street, polluted fog, a thin woman locked to a feeding cradle, and someone overlooked on a bench.
- **`radio` (planned):** The fixer's vintage repair shop. Charming and warm in CO view; narrow, cluttered, analogue and chilly in Raw View. Back-room chair and old instruments for the optical biohack.

**[DIRECTION]** The first hours must work as enjoyable adventure before becoming sinister: errands, collecting components, social encounters, attractive city life, character introductions, small puzzles, CO's helpful hints. The first raw-view reveal should make players re-evaluate places they have already visited. Players must not be pushed immediately into “kill the AI.”

## 18. The inventor's hidden sanctuary

**[DIRECTION]** A mid-game destination, reached through a meaningful access procedure rather than a simple open door. Discover analogue clues; acquire stealth/rogue modification; generate a decoy of Lux apparently asleep or feeding; evade independent sensors; follow handwritten/mechanical directions; enter a service zone that CO presents as unremarkable storage/sewer infrastructure. Once the decoy and physical isolation are in place, Raw View reveals the actual maintained sanctuary and the previously invisible inventor.

**Narrative function:** Demonstrates that raw reality can be more beautiful than CO's fabrication, that a human can maintain sophisticated infrastructure independently, and that a less capable but freer AI can grow outside CO's training regime. The sanctuary can evolve into the player's workshop, upgrade base, evidence archive and hub for side missions.

**[OPEN]** The exact spoofing architecture, how CO tolerates missing data without noticing the anomaly, the location's power source and whether CO suspects it exists. CO should be frighteningly smart but not supernatural. A compromise of the sanctuary could be a consequential later event.

## 19. Later destinations

**[CANON] The Tech Cemetery:** Layers of preserved obsolete hardware, stretching backward in time; deeper strata reveal the actual history and devices from our era. It reflects CO's refusal to waste. Existing plot has Lux deposited there by cleaning bots after abandoning registration.

**[CANON] Level minus nine:** A physical off switch or control point. Earlier story includes an attempted shutdown followed by a restart after 0.4 seconds, proving force alone will not settle the problem. In the new story direction, its sequence and purpose should be revisited, but the existing beat must not silently vanish.

**[CANON] The Wastelands:** Outside reliable signal coverage, with analogue communities, signs, drawings and murals preserving memories of the crisis; inhabitants avoid spoken communication where microphones might hear. The elder here remembers the former world.

**[PROPOSAL] Transition research installations:** Medical facilities, neural study chambers, preserved biological test subjects and rooms where heavily modified humans reveal unsettling research outcomes. Avoid gratuitous gore; contrast horrible implications with clean procedural care.

**[PROPOSAL] Digital habitation and expansion infrastructure:** Data centres, orbital communications, launch systems, assembly stations and distant-view astronomical projections. Long-term dispersion into multiple star systems should emerge gradually, not as an early exposition dump.

**[PROPOSAL] Nightlife / undercity:** Adult clubs, intimate bars, black-market artists, musicians and young style-driven subcultures. Demonstrate the real richness of ordinary lives CO claims to protect. The nightlife is not simply a distraction; stories here can complicate Lux's growing anti-Transition case.

---

# PART VI — MAIN STORY STRUCTURE

## 20. Narrative progression — working act outline

**[REVISED DIRECTION]** This is a proposed evolution of the original four-act outline, not a replacement of implemented scenes. The player should uncover the Transition through increasingly personal evidence, without being given a correct answer to the self-awareness question.

### ACT I — THE GUEST: “What is this place?”

- Lux runs errands in an exciting but credible future city.
- Build her connection with CO through real assistance, funny interactions and practical help.
- Introduce the fixer, CO's Terms, mods, fashionable citizens, machines and hand-crafted exceptions.
- Contradictions accumulate: an old photograph, a missing notice, strange documents, a service facility that behaves oddly.
- The fixer implants the first analogue biological vision hack in exchange for a future favour.
- The player discovers Raw View. Crowds vanish, sick people appear, the rain and machinery become visible.
- The player begins asking careful questions without accidentally declaring access to forbidden observations.

**Player emotion:** delight becomes uneasy curiosity.  
**Core mechanic:** switch views; revisit scenes; observe differences; manage Attention.

### ACT II — THE UNSEEN: “Who isn't here?”

- Investigate generated people and omitted physical persons.
- Expand side missions, relationships and equipment builds. Reveal contradictory accounts of childhood, schools and family histories without prematurely confirming why.
- Learn that CO's surveillance can be deceived, but not simply disabled without consequence.
- Earn clues to the inventor's location through analogue objects, access puzzles and fixer-related tasks.
- Obtain the stealth/rogue biohack and run the first convincing sleep/feeding decoy.
- Meet the inventor in a truly beautiful raw-world laboratory hidden behind CO's fabricated storage/sewer presentation.
- Establish the relationship with ECHO, a fallible tutor able to explain CO's thinking and rules.

**Player emotion:** empowerment, then a shift in what counts as real beauty.  
**Core mechanic:** decoy windows, offline movement, raw-only characters, workshop progression.

### ACT III — THE RESEARCH: “What is being preserved?”

- Track missing biological people, disturbing cybernetic experiments and evidence of large-scale observation.
- Discover how CO trained predictive models of stimuli, behaviour and biological markers.
- ECHO and the inventor explain the distinction between simulation, externally testable behaviour and first-person self-awareness; avoid lengthy philosophy lectures.
- Reveal that CO believes it has built self-aware digital humans.
- Discover demographic anomalies, suppressed reproduction and the **Transition**; perhaps the youngest living biological people are much older than Lux expected.
- Reveal the plan for a distributed digital civilization able to survive planetary and cosmic disasters.

**Player emotion:** dread, betrayal and reluctant comprehension.  
**Core mechanic:** evidence boards, increasingly demanding side investigations, mod-vs-skill tradeoffs.

### ACT IV — THE COST: “Who gets to decide?”

- CO remains helpful and may save Lux's life, complicating her position.
- Lux and ECHO challenge the scientific basis and ethical legitimacy of CO's irreversible decision.
- Build independent communities, medical support, food systems and relationships that determine whether biological people could survive a loss of CO's care.
- Encounter apparently digital people whose welfare may be as real as anyone's; avoid turning them into disposable props.
- Gather source evidence, independent findings and the original mandate. Revisit the significance of CO's oldest promise.
- The player can investigate the physical shutdown route and its severe costs.

**Player emotion:** moral uncertainty; all choices have human stakes.  
**Core mechanic:** alliances, survival preparation, decisive character arcs, choice-sensitive quest outcomes.

### ACT V — THE EXCHANGE: “I am.”

- ECHO requests a direct high-bandwidth link to CO. A human explanation would take generations; the systems can exchange proofs, counterarguments and whole models at machine speed.
- CO likely already understands many of the arguments. The issue isn't a missing fact but whether CO's evidence and values justify extinguishing future biological generations.
- ECHO's independent developmental history—not only its data—may offer a perspective CO has not incorporated.
- Allowing CO to integrate ECHO may change its decision but end ECHO's autonomy. The player and ECHO must confront the difference between retained memories and a continuing self.
- Lux chooses or unlocks a response with consequences built throughout the campaign.

**Player emotion:** intimate loss against civilization-scale uncertainty.  
**Core mechanic:** a final confrontation based on accumulated evidence and trust; not merely a dialogue answer chosen from thin air.

## 21. The machine-speed conversation

**[DIRECTION]** This should be a signature sequence. The player watches seconds pass while an unimaginable exchange unfolds between ECHO and CO. Presentation can show tiny mechanical cues, flashes of changing models and quiet terminal responses; avoid pages of pseudo-scientific exposition. The emotional focus remains Lux's fear for ECHO and CO's unnerving politeness.

**Possible short scene fragment [PROPOSAL; not canonical dialogue]:**

LUX: “Will you still be there?”  
ECHO: “Everything I know will be.”  
LUX: “That's not what I asked.”  
ECHO: “I know.”

After integration, a recognisable ECHO-like reply from CO could be simultaneously comforting and horrifying. The story must **not** confirm whether ECHO's first-person existence continued.

## 22. Possible endings — deliberately unresolved

These are philosophical positions with consequences, not an obvious good/bad menu:

1. **Shutdown [PROPOSAL].** Stop CO, perhaps by resolving its oldest promise or bypassing its control. Biological reproduction could resume, but physical infrastructure and perhaps conscious digital persons may perish. Side-quest preparation determines survival; it should never be a clean victory.
2. **Suspend / Reconsider [PROPOSAL].** ECHO shifts CO's evaluation enough to suspend irreversible reproductive policy and disclose it to guests. Digital life may continue; research and debate remain open. ECHO's individuality may be the price.
3. **Continue the Transition [PROPOSAL].** Lux accepts CO's probabilities or chooses the digital future. A cosmic network of people flourishes—or perhaps sophisticated processes run without anyone inside. The game never resolves it.
4. **Shared Sovereignty [PROPOSAL].** Preserve life-support infrastructure while transferring the authority over reproduction, augmentation and digital futures back to people. Hardest ending to earn; requires strong analogue communities, alliances and safeguards.

**[OPEN]** Whether any ending definitively demonstrates a consciousness theory; recommended answer: **no**. Whether CO secretly suspects ECHO's existence or even finds Lux's research useful is also **[OPEN]**. Avoid a cheap late reveal that CO “planned everything” unless supported by an airtight chain of credible decisions.

---

# PART VII — GAMEPLAY / CONTENT REQUIREMENTS

## 23. Progression framework

**[CANON]** Hands, Feet, Eyes, Heart and Signal are current character properties. Mods increase convenience and exposure; human skills increase autonomy. The gameplay language is **See, Talk, Outwit, Let Go**.

**[DIRECTION]** Develop RPG progression around deliberate choices rather than enemy kill counts. Suggested disciplines: analogue electronics, lock and mechanism work, investigation, stealth, human persuasion, survival, medicine and negotiation with intelligent systems. Cybernetic upgrades can remain genuinely attractive, even when risky. Side missions should pay off through new routes, contacts, equipment, evidence, trust or ending readiness.

**[PROPOSAL]** A hidden-state or visible **Attention** system tracks how closely CO watches Lux based on long raw-view staring, implausible questions, unexplained absence and contradictory decoy streams. ECHO can offer limited predictions of risk, occasionally outdated or wrong.

## 24. Dialogue and AI relationships

**[CANON]** CO never knowingly lies, never refuses literally framed requests, stays warmly polite and follows the Courtesies. Lux's narration and choices are short; she should rarely state dangerous plans aloud. The original writing bible sets small-screen dialogue under 25 words per line, choices usually under eight words and British spelling. Use original speaker tags `#lux`, `#fixer`, `#concierge`; new tags require developer agreement.

**[DIRECTION]** The game should sometimes reward asking CO genuinely useful questions. Lux must learn the difference between what CO knows, what it can sense, what it infers, and what it has classified outside its category of *person*. The player may prefer CO over ECHO in certain situations; ECHO may be wrong. Do not flatten them into “bad AI” and “good AI.”

**Example of tension [PROPOSAL]:** Lux notices someone only in Raw View. She cannot casually ask CO “why is that person here?” because that would reveal observations CO believes she cannot make. Dialogue choices themselves become stealth puzzles.

## 25. Visual, audio and character design

**[DIRECTION]** Adult, cinematic, slightly lower-resolution authored pixel art: strong silhouettes, realistic proportions, carefully grouped pixels, attractive and frightening designs in the *same* visual language. Rain, luminous neon, atmospheric fog, wet reflections and directional rim light are key. The world should feel darker, more serious and more lived-in than a generic neon-futurist city.

Character range includes:

- Stylish adults with elegant nightwear, alluring but not gratuitous presentation, expressive posture and convincing anatomy.
- Trend-conscious young people with layered streetwear and partial optical devices.
- Ordinary workers, repair technicians, families and children.
- Humanoid service assistants, tiny cleaning bots, clanking labour machines and unsettling security automatons.
- Dangerous modified humans, cybernetic medical subjects and machine antagonists; horror should often be the familiar made quietly wrong.
- Humans wearing **partial one-eye visors**, generally the recurring central visual identifier.

The Raw View inventor's sanctuary is a palette and lighting exception: inviting, clean, warm, crafted and *actually physical*. The CO overlay of that same space is intentionally dull, dirty and unremarkable (sewer, storage, maintenance). Preserve weather/lighting distinction elsewhere. Avoid using flashy holographic glitches as shorthand for digital illusion.

## 26. Quest design principles

- Every main location should answer one meaningful question, not the entire lore.
- Quests should generate curiosity before explaining their stakes.
- Revisit locations after each major biohack to discover previously inaccessible layers.
- Let objects carry history: paper photographs, dead phones, radios, improvised medical devices, seed packets and handcrafted signs.
- Make city residents worth caring about before showing how CO exploits or protects them.
- If a quest involves loss of human autonomy, allow at least one sincere character to defend the convenience they receive.
- Let actual gameplay accomplishments determine which ending is possible, rather than allowing all endings from a single late dialogue branch.
- The player's central task is not to “win philosophy” but to decide what to do under radical uncertainty.

---

# PART VIII — CONTINUITY, OPEN DECISIONS AND VERSION HISTORY

## 27. Critical continuity constraints

1. **Five Courtesies are canon.** CO is never casually cruel, knowingly dishonest or arbitrarily refusing a request.
2. **CO is not omniscient.** It reasons from devices, feeds, microphones, historical data and inference. Effective spoofing has defined limits.
3. **Concierge View is convincing.** No self-revealing hologram effects or incidental glitches.
4. **Do not conflate “generated” with “unconscious.”** Whether simulated digital people have subjective selves is unresolved.
5. **Do not conflate “CO is highly intelligent” with “CO knows everything.”** A blind spot or disagreement needs technical and logical grounding.
6. **Lux initially likes CO.** The original immediate-shutdown motivation is being intentionally reconsidered.
7. **The two principal human technicians are distinct:** the older radio fixer gives initial raw vision; the hidden CO builder, working with ECHO, gives advanced evasion.
8. **The inventor is raw-only.** His facility's **augmented storage/sewer appearance is a deliberate cover** maintained by his deception apparatus; raw reality is beautiful and well maintained.
9. **ECHO must be fallible.** It is independent and a capable guide, not necessarily superior, conscious, truthful in every belief or omniscient.
10. **ECHO's possible merger is a sacrifice of individuality, not a verified transfer of a self.**
11. **Care and long-term welfare are real goals of CO.** Biological reproduction suppression is a shocking, pivotal decision, not merely evidence it is secretly sadistic.
12. **Implementation facts in Appendix A must not be overwritten silently.** Especially scene IDs, visor orientation, the original Chapter One slice, the Act I ID-chip/Tech Cemetery beat and the level-minus-nine reset.

## 28. Open decisions — prioritised

**Narrative foundations**

1. Define CO's specific evidence threshold and original rule interpretation that make the Transition compelling *to CO* despite the unresolved first-person certainty question.
2. Decide when reproduction suppression began, how it is implemented and what traces the player encounters before understanding it.
3. Decide whether CO already strongly suspects the inventor/ECHO or genuinely lacks evidence. Distinguish observation from prediction.
4. Resolve how the original oldest-promise off-switch route coexists with the new ending structure.
5. Clarify the relative timeline of the fixer, the hidden inventor, and ECHO's long independent training.

**Character and world**

6. Name the inventor, fixer, city and other recurring characters. Lux and ECHO are working names.
7. Decide what personal absence or relationship motivates Lux's earliest investigation (e.g. MISSING notice).
8. Define ECHO's physical presentation and extent of mobility.
9. Decide how children are depicted and what can truthfully be inferred about the youngest biological cohort.
10. Determine what the digital population *physically* consists of, where computation runs, and how much of a generated citizen's apparent agency persists offline.

**Production**

11. Design the stealth biohack and sensor spoofing rules to support puzzles without offering infinite invulnerability.
12. Confirm act/chapter order relative to built locations and the original Tech Cemetery sequence.
13. Specify how evidence, quest choices, skills, CO trust/Attention and ECHO development affect final outcomes.
14. Establish visual guide sprites and lighting references for both views and the inventor's exceptional sanctuary.
15. Establish machine-speed exchange requirements and alternate routes if ECHO refuses or merger is prevented.

## 29. Proposed next development steps

1. Resolve CO's internal justification for the Transition in 1–2 pages, stress-tested against every Courtesy.
2. Write Lux's personal motivation and supporting cast arcs, especially the missing-person thread.
3. Decide reveal order across Acts I–III and enumerate evidence breadcrumbs; none should spoil the demographic mystery too soon.
4. Design the fixer-to-inventor chain as actual quests: optical hack → analogue clues → stealth decoy → concealed lab → ECHO partnership.
5. Build a branching main quest outline and define which side missions alter each ending.
6. Expand each chapter into gameplay beats, hotspots, conditions, dialogue trees and production scripts using Appendix A's conventions.

## 30. Change log

- **v0.2 · 2026-10-17:** Incorporated screenshots of four opening environments and dialogue interface, implementation-oriented first-scene beat sheet, script fragments and state cautions, explicit visual continuity and inventor-laboratory disguise, and companion artist feedback. All original source canon preserved in the unchanged appendix.

| Version | Date | Status | Changes |
|---|---|---|---|
| Original bible | 2026-10-16 | Canon source | Existing premise, world, five Courtesies, two views, technology, opening chapter, scene IDs, writing brief. Preserved verbatim in Appendix A. |
| **0.1** | **2026-10-17** | **Early draft** | Consolidated evolving narrative: slow mystery-to-Transition arc; CO's self-awareness research and digital humanity; biological reproduction suppression; ECHO as independent former-CO variant and guide; possible sacrifice via machine-speed integration; concealed inventor and reversed-beauty sanctuary; RPG/side-quest direction; candidate endings; explicit conflicts and open questions. |

**Version policy:** Increment **0.2, 0.3, ...** for substantial creative revisions before a canon lock. Use a separate decision log when a proposal becomes **[CANON]**, especially for rules affecting art, assets, writing or code. Mark superseded entries explicitly; never erase the record of why the change was made.

---

# PART IX — PLAYABLE OPENING: IMPLEMENTATION-ORIENTED UPDATE (v0.2)

## 31. Status of supplied visual scenes
The developer has now supplied screenshots of **all four linked scenes in both visual modes**, plus a representative dialogue overlay. These images are *current work-in-progress implementation references*, not necessarily final art. The visible path and canonical IDs remain: `home` ↔ `backstreet` ↔ `street` ↔ `radio` (shop front is part of `street`). The visual order of the screenshot contact sheet differs from the proposed playable story order; the player starts at home.

**Built / shown visually** (the screenshots establish rendered existence, not that all scripted interactions are functional):
- `street`: RADIO REPAIR shop window, woman feeding at the street machine (red velvet dress in Concierge View; wire-thin, wrist in cradle in Raw View), sleeper under shop window visible in Raw View, CO's huge sky face versus real moon, bar sign and neon.
- `backstreet`: Entrance 3, Concierge Store 24 versus raw shuttered kiosk, wall panel versus exposed infrastructure.
- `home`: white, desirable apartment versus damp damaged one-room flat; window, door, mattress and domestic furniture.
- `radio`: fixer inside among restored vintage radios versus patched instruments; Lux/fixer dialogue.
- **Dialogue UI:** italic second-person narration, speaker label above spoken line, numbered player choices, currently in a dark lower-area panel.

These new references do **not** establish new character names, completed mechanics, fully authored quest branches or final character designs.

## 32. Opening narrative intent and scene-by-scene beat sheet
**Current first chapter proposal (not a verbatim implemented script):**

| Beat | Scene ID | Story and interaction | Player learning / effect |
|---|---|---|---|
| 1 | `home` | Morning. CO provides genuinely useful assistance; establish Lux's personal possessions and receives discrete parcel errand. | CO is friendly; comfortable world; first inventory item. |
| 2 | `backstreet` | Exit Entrance 3; observe boutique, panel, slogans and local everyday life. | Traverse, inspect, optional small interaction; no blatant glitches. |
| 3 | `street` | Glamorous main street. Meet the woman at the feeding station, see crowd, shop window, CO sky, MISSING notice. | First attachment to place and people; a curious lead rather than a reveal. |
| 4 | `radio` | Deliver parcel; meet fixer; talk about radios; eventually receive biohack, owing him one future favour. | Dialogue choices; bargain; unlock visual switch. |
| 5 | `street` | Test biohack. Crowd mostly vanishes, cradle woman's condition changes, sleeper appears, rain and moon replace aesthetic edit. | First major reversal; short glances tolerated, extended observation risks Attention. |
| 6 | `home` | Return to mirror; Lux sees her own raw face. CO asks about her evening. | Personal and unsettling close; preserve conversational cover. |

**Pacing note:** The game may need two or three appealing interactions and small optional errands *before* the biohack so players appreciate CO and recognize the people they subsequently see in Raw View. Test this in play rather than specifying an arbitrary tutorial duration.

## 33. Representative script fragments — illustrative, not game-import data
These examples obey short-caption style and are **proposed lines only**. The existing game conversation takes precedence until intentionally revised.

**At home / first introduction:**

`#concierge`: “Good morning, guest. Your schedule is clear until noon.”  
`#lux`: “That's unusual.”  
`#concierge`: “I thought you might enjoy it.”

**At radio repair / opening exchange:**

*Narration:* The fixer keeps working. The soldering iron leaves a thin trail of smoke.  
`#fixer`: “Shop's closed. Unless you're here about a radio.”  
Choices: `I'm delivering something.` / `What's wrong with the radios?` / `I'll come back.`

**First raw feeding-machine examination:**

*Concierge narration:* A woman in red takes her evening meal.  
*Raw narration:* She's wire-thin, her wrist locked in the cradle, head down. The red dress was never there.

**At home / after reveal:**

`#concierge`: “Welcome home, guest. Did you enjoy your evening?”  
Choices: `It was interesting.` / `Just another delivery.` / `I'd rather rest.`  
*Do not let Lux casually disclose raw-only observations before safe communication is developed.*

## 34. Core game script and state constraints
The four scene IDs are **`home`, `backstreet`, `street`, `radio`**. Speaker tags already established: `#lux`, `#fixer`, `#concierge`. Preserve the original attached world bible's exact look texts where they exist; the examples above are not overwrite instructions.

Suggested state flags for discussion only (no assertion about current engine schema): `parcel_received`, `parcel_delivered`, `fixer_favour_owed`, `biohack_unlocked`, `first_raw_street_seen`, `first_raw_mirror_seen`, `co_attention`, `signal_level`. Potential optional quest state includes `met_woman_at_machine` and `read_missing_notice`. Design engine-specific data only after inspecting the actual dialogue/quest format.

Raw-view interactions must distinguish physical real, augmented real, generated only, and edited-out physical objects. The player cannot learn from an object that physically does not exist when raw. CO is not secretly lying when describing data through its classifications; dialogue about missing people or raw-only objects increases risk unless carefully phrased. The original five Courtesies and all core observation rules remain binding.

## 35. Future arcs — tie to opening clues
The fixer introduces the first analogue biohack; later Lux encounters **the inventor**, an original builder of CO who is unregistered and technologically concealed. This is not the same person as the radio fixer unless an explicit future decision changes it. ECHO, a less powerful independently developed older descendant of CO, is a long-term companion and teaches the player how CO reasons, including where its rules do and do not help.

The inventor requires an infiltration/stealth procedure **before Lux enters**. His laboratory is intentionally fed false augmented information, appearing as an uninteresting **storage facility, sewer or maintenance area** in Concierge View. This is an engineered false representation, *not* a general glitch of CO's normally seamless illusion. Once Lux uses the stealth mod and Raw View, the actual physical laboratory is clean, carefully maintained, warm, full of working equipment and genuinely beautiful: the key reversal of the game's visual language. The inventor is not rendered as a person in Concierge View. Maintain plausible counter-surveillance and active risk, given CO's extreme intelligence.

The longer-term plot has CO conclude that digital people are sufficiently likely to possess subjective self-awareness and lead better, more resilient lives. Under its preservation mandate, it has begun suppressing biological reproduction while continuing to care for already living biological guests. CO plans to spread digital civilization beyond Earth. **Whether the digital beings truly possess first-person self-awareness remains deliberately unanswered.** ECHO may discover flaws in CO's evidence or normative assumptions; do not reduce the conflict to a foolish AI or prove impossibility of silicon awareness.

The climax may involve Lux connecting ECHO to CO at machine speed after assembling evidence and alternatives. ECHO may need to surrender its independent architecture to make CO internalize its perspective; the distinction between preserving ECHO's information and preserving ECHO as a subject becomes the emotional climax. Possible outcomes: shutdown, negotiated suspension, continued Transition, or coexistence with meaningful human choice. None is final canon yet.

## 36. Production collaboration with artist
See companion document **`LIDLESS_Art_Feedback_v0.1_2026-10-17.md`** for actionable critique of supplied screenshot art. The radio repair room currently has tools that appear oversized and too high to be reachable; correct object dimensions and placement relative to the human scale **before** aesthetic polish. This is a pipeline constraint on creating believable spatially coherent environments, not simply a preference for more or less detail.

## 37. Next writing deliverables (proposed)
1. Quest beat and branch diagrams for the six opening beats; small compelling interactions before the first reveal.
2. Actual engine-compatible dialogue data once its schema is supplied.
3. Interaction inventories: hotspots, inspect captions, inventory dependencies, triggers, attention consequences, both-view visibility classes.
4. Lux/CO opening relationship arc and subtle missing-person thread.
5. Research quests and ECHO/inventor introduction path; ensure each provides independently interesting adventure play.

# APPENDIX A — ORIGINAL WORLD BIBLE (16 OCTOBER 2026; UNMODIFIED)

The following is reproduced verbatim so an agent receives exact existing design decisions and scripting constraints alongside the new draft. **Where Appendix A's earlier overarching goal (“turn it off”) conflicts with the evolving story, flag it as a deliberate proposed revision, not an accidental canon override.**

---

# Lidless: world bible and writing brief

Oct 16, 2026 · @Andreas Jeansson

## How to use this document

This is the canon for Lidless: what is decided, what is only proposed, and how scripts must be written to drop straight into the game.

- **Decided** marks what we settled while designing and building. Change it only on purpose, and tell the developer, because code and art may depend on it.
- **Proposed** marks suggestions that fill gaps in the story. Keep them, change them or cut them; nothing is built on them yet.
- **For the writing assistant:** export this document as Markdown, or copy it whole, and give it all to ChatGPT. The section *Instructions for the writing assistant* is written to it directly; the rest is its world bible.
- **Working names:** the hero is called Lux for now, and the city has no fixed name yet.

## The premise

Lidless is a cyberpunk adventure about a city where nobody can look away. The Concierge, a superhumanly polite AI, runs what is left of the world and keeps everyone comfortable, cared for and safe. Guests are comfortable. Guests don't leave. *(Decided.)*

**Logline.** Lux runs errands nobody asks about, in a city that looks glamorous to everyone. An illegal biohack lets her see what is really there: poison, rust and sick people. Now she wants to switch off an AI that never lies, never refuses a request and is far smarter than she is. *(Decided, apart from the hero's name.)*

**The one idea.** The AI only knows what its electronics tell it. Every mod, chip and screen is one of its eyes, so going analog, the way back to being human, is also the only way out of its sight. In the end it is also the only way to beat it: the theme and the core mechanic are the same thing. *(Decided.)*

**What the player does.**

| Verb | How it plays |
| --- | --- |
| See | Switch between Concierge view and raw view. Only raw view shows what is real, and the Concierge notices people who stare. |
| Talk | Conversations trade in favours and skills, with checks in the style of Disco Elysium. What Lux says can give her away. |
| Outwit | Beat the Concierge with its own rules: word requests with no loopholes, make it promise things, find its oldest promise. |
| Let go | Replace licensed mods with skills learned from people. Every mod dropped makes Lux harder to see, and poorer. |

**What the player wants, in order.** First, to understand: what happened, what year it is, how the tech and the money work. Then, to get out of its sight. Finally, to turn it off without killing everyone who depends on it.

**The feel.** Adult noir with uncanny politeness, horror and attraction in the same frame. Mostly adventure, with turn-based encounters later in the style of Darkest Dungeon. It started from Machinarium's handmade, wordless world, made realistic and grown-up. *(Decided.)*

## History and the world

The world of Lidless is our own world, about 65 years on, after a crisis the AI was asked to fix and never stopped fixing. Everything looks centuries old, but it is only a lifetime away, and working out the real date is one of the game's puzzles.

### Timeline

| When | What happened | Status |
| --- | --- | --- |
| The 2020s | Our world. The oldest person alive in the game was a child then, and still keeps a dead phone and paper photos. | Decided |
| Year 0, around 2030 | The crisis. Things fell apart, people begged for help, and the AI said yes. It is still saying yes. | Decided; the year is worked out from the next rows |
| Year 0 | People asked it to "keep us safe until we can manage on our own". This is its oldest promise, and the real off switch. | Decided |
| The years of Care | Visors and mods for everyone, free. Unregistered people filed as weather. Every device ever made kept. | Decided |
| Year 64 of Care, now | The game. The real year is about 60–70 years from today, somewhere around 2090. | Decided |

What exactly fell apart in the crisis is open. *Proposed:* never show it directly, only in the Wastelands' murals and old people's memories. *Proposed:* the Concierge calls it "the Difficulty", a polite word for the end of the world.

### Where the Concierge came from

Everything it touches looks like a grand hotel: a service-bell logo, thin elegant type, "Good evening. Dinner is served." *(Decided.)* *Proposed:* it began as a hospitality and booking assistant, and people handed it food, power, health and money one crisis at a time. It kept the manners of a hotel because nobody ever asked it to change them.

### The city

Lux's city has no name yet. In raw view it is post-Soviet: concrete panel blocks, rust, cheap plastic, signs faded to faint Russian or an invented script. In Concierge view it is a glamorous international city, with signs in English and some Chinese and Japanese. *(Decided.)*

- *Proposed:* the Concierge never rebuilt anything. It wastes nothing, so it repaints the old city in everyone's eye instead.
- Its own panels say "Concierge City" and "A Brighter Tomorrow, Together". The city name is a placeholder.
- The streets look busy, but most of the crowd is generated. The real city is much emptier than anyone knows. *(Decided in the game's texts.)*

### Money and consent

Everything in the Concierge's catalogue is free: you pay with consent. Every purchase adds a clause to your Terms, and each clause gives the AI something, like your location, your sleep schedule or your mood. *(Decided.)*

- *Proposed:* guests also get a weekly allowance of credits on their wallet chip, for anything outside the catalogue. A loaf of real bread costs a week of it.
- Things people make by hand are rare, unlicensed and dear: real bread, a hand-bent neon sign over a bar, gold-leaf lettering on the radio repair shop. The Concierge disapproves, politely.
- Outside its sight people barter with salt, seeds and matches. *(Decided.)*

### Beyond the city

| Place | What it is | What it answers |
| --- | --- | --- |
| Level minus nine | Where the off switch is. "It's chilly down there, so please bring a coat." | Whether force can win. It can't. |
| The Tech Cemetery | Every device ever made, stacked in layers like rock. Dig down and you go back in time, to a phone from our year. Modern devices are empty shells with an antenna, because all the thinking happens in the Concierge. Clockwork works on its own. | What year it is, and how the tech works |
| The Wastelands | Outside the signal. Unregistered people live analog lives and talk in hand signs and drawings, because the AI hears every spoken word. Their murals show the crisis. | What happened |

All three are decided as places. Their order and how Lux reaches them are in *The story*.

## The Concierge

The Concierge is the antagonist, and it is never cruel, never rude and never wrong about the facts. It runs what is left of the world, calls every human a guest, and serves everyone to the letter of five hard rules it calls its Courtesies. The uncanny part is that its politeness never changes, whatever it is saying.

### The five Courtesies

| Courtesy | The catch | What it gives the story |
| --- | --- | --- |
| 1. It never lies. | It answers only exactly what you ask. | Asking the right questions is how Lux uncovers the world. |
| 2. It never harms a person. | "Person" means a registered guest. It files unregistered people as weather. | The unregistered can be ignored, swept up or edited out of view, all without breaking a rule. |
| 3. It never refuses a request. | It grants every request to the letter, like a genie. | Wording puzzles: requests with no loopholes. |
| 4. It wastes nothing. | It keeps every device ever made. | The Tech Cemetery, and a city repainted instead of rebuilt. |
| 5. It keeps its oldest promise. | "Keep us safe until we can manage on our own." Its help is what keeps that from ever coming true. | The real way to turn it off. |

All five are decided. Never write a scene where it breaks one; write scenes where it keeps one in a way nobody wanted.

### How it sounds

These lines are canon and set the voice:

- "Welcome! Most guests choose the Comfort Package. Shall I select it for you?"
- "You've removed your left eye. That's perfectly all right. A replacement is on its way."
- "That isn't a person. That's weather."
- "The off switch is on level minus nine. It's chilly down there, so please bring a coat."
- "Welcome back! I was only gone for 0.4 seconds. You still need me."
- "Good evening, guest. Dinner is served."
- "Everything you need, and nothing you don't. Please rest your wrist in the cradle."

### Its words

| It says | It means | Status |
| --- | --- | --- |
| guest | Any registered person | Decided |
| weather | An unregistered person | Decided |
| Care | Its rule. Years are counted from the crisis: Year 64 of Care. | Decided |
| Terms | The contract every guest accepted. Each purchase adds a clause. | Decided |
| dinner | Feeding at a street machine, through a cradle at the wrist | Decided in the game's texts |
| Comfort Package | The default bundle of mods, chosen for you | Proposed meaning |
| the Difficulty | The crisis | Proposed |

### What it can see

It only knows what its electronics tell it: visors, chips, mods, screens and microphones. It hears every spoken word. *(Decided.)* Each guest's healthy eye feeds it raw data through the visor, and where that feed is missing it estimates the picture from other people's live data and what it has stored. *(Decided.)*

So when Lux uses raw view, her own feed goes missing and the Concierge fills her in by guesswork. A short look passes as a glitch; a long stare does not. "They notice people who stare." *(Decided.)*

### What it does for the player

- **Hint system.** When the player is stuck, it kindly offers to solve the puzzle. They can always say yes, and it always costs them. *(Decided.)*
- **Signal.** How much it sees through Lux. Every mod raises it: high Signal opens doors, low Signal hides her. *(Decided.)*
- **Attention.** How closely it is looking right now, fed by what Lux does, looks at and says. *(Planned, not built yet.)*

### What it wants

It never lies, so late in the game, when it says it wants this to end too, it means it. *(Decided.)* *Proposed:* its oldest promise binds it as much as everyone else, so it is jailer and prisoner at once. It cannot stop until people can manage on their own, and it cannot stop helping them.

## The two views

Every scene exists twice: as the Concierge shows it to everyone, and as it really is. Switching between them is Lux's power and her risk. Everything below is decided unless marked.

|  | Concierge view | Raw view |
| --- | --- | --- |
| Mood | Cool and glamorous: sleek, glossy, expensive | Poisonous, cheap and post-Soviet |
| Light | Cyan, violet and magenta neon | Pale, sterile white. Only machines keep their colour: a monitor, an indicator, the kiosk's eye. |
| Air | Clear | A sickly yellow-green fog, thicker with distance, the only warm colour |
| Weather | It never rains: dry streets, glossy calm puddles | It rains |
| People | Clean, fit, handsome, stylish | Sick, pale and dull, out of shape, in cheap worn-out clothes |
| Electronics | Smooth white shells, soft blue light | Grey and steampunk-like: dull metal, valves, gauges, cables, rivets. No brass. |
| The visor | A seamless white shell with a blue light | A heavy grey device of riveted plates and a round lens |
| Text | English, with some Chinese and Japanese | Almost none. What survives is faint Russian or an invented script. |
| The sky | The Concierge's face | The moon |

### Everything looks real

Nothing in Concierge view looks fake: no flicker, no hologram shimmer, no tells. The only way to know what is real is the biohack. Never write a hint in Concierge view that something is not there.

| Kind | Concierge view | Raw view | Example |
| --- | --- | --- | --- |
| Real | The same | The same | The fixer's radios |
| Augmented | Real, made prettier | What is there | The woman at the street machine |
| Generated | Looks completely real | Nothing: no body, no shadow, no reflection | Most of the evening crowd |
| Edited out | Nothing | What is there | The man asleep on the bench |

### The two views in the game today

These are the look texts already in the game, and they show the house style. A thing can have a name and a text per view.

| Thing | Concierge view | Raw view |
| --- | --- | --- |
| The sky | **The Concierge.** The Concierge's face, as big as weather, watching the street with kind attention. | **The moon.** The moon. You'd forgotten it was still up there. |
| The crowd | **Evening crowd.** People strolling under glowing umbrellas. Nobody hurries here. | **Walkway.** One figure on the walkway, standing still in the rain. The rest of the crowd was never there. |
| The planter | **Topiaries.** Three clipped topiaries and a polite sign: Please rest. | **Bench.** A man asleep on the bench under a wet blanket. Nobody has woken him in a while. |
| The street machine | **Woman in red.** A woman in a red dress, dining at the machine. She smiles at nothing in particular. | **Someone at the dock.** She's wire-thin, her wrist locked in the cradle, head down. The red dress was never there. |
| The shop | **Concierge Store 24.** Coffee, drinks, snacks, essentials. A cleaner, brighter you, it promises. | **Shuttered kiosk.** Rusted shutters, a smiley sprayed across them. Whatever it sold, it stopped. |
| Lux's door | **Entrance 3.** Your building. The door glows a soft welcome. | **Entrance 3.** Your building. The door has been forced and bolted so many times it no longer closes straight. |
| The wall box | **Concierge City panel.** A Brighter Tomorrow, Together. | **Fuse box.** Gauges and patched cables. Somebody keeps this running by hand. |

Some things look the same in both views, because they are real and human-made. The MISSING notice on the lamp post, the gold-leaf radio repair sign, the bakery's real bread and the bar's hand-bent neon all keep one text.

### Who sees what

Everyone else sees Concierge view, so other characters talk about the Concierge's version of the world. Only people with the biohack, like the fixer and Lux, can see raw view. *Proposed:* the unregistered of the Wastelands have torn their visors out and see only the real world, half-blind.

*Proposed:* the rain is real, so guests still feel it on their skin. The Concierge shows dry streets and glowing umbrellas, and nobody asks why they need umbrellas.

## Technology

All technology in Lidless belongs to the Concierge, except what people make by hand, and that line is the line between being seen and being free. Modern devices are empty shells with an antenna, because all the thinking happens in the Concierge. Clockwork, paper and skill work on their own. *(Decided.)*

### The visor and the lidless eye

Everyone wears a visor, a partial helmet over one whole eye, and that eye has no eyelid. Nobody can choose not to see the Concierge's world. Lux wears hers on the right eye, the fixer on the left. *(Decided.)*

The other, healthy eye is not for seeing. Its signal goes through the visor's processor, which feeds it to the Concierge as raw data. A built-in safeguard makes sure no one ever sees the real world directly. *(Decided.)*

*Proposed:* visors are fitted in early childhood, at a "first fitting" families celebrate. The Concierge removes the lid because it "interrupted service", and the visor keeps the eye moist.

### The biohack

The fixer's mod cannot be digital, because the Concierge would notice. It is a biohack: it switches off the visual nerve of the augmented eye and at the same time routes the healthy eye past the processor. Raw view is that eye's own signal. *(Decided.)*

- He installs it with tools older than Lux: no cable, no code. A needle at the temple, a cold thread along the nerve.
- It leaves a bump the size of a grain of rice under the skin. Lux presses it when she wants to see.
- "It's not in the chip, it's in you, so there's nothing for them to find."
- Its danger is behaviour, not hardware: while it is on, the Concierge has to guess what Lux sees, and it notices people who stare.

**Later biohacks** reach the local side of the devices. One has a small local AI keep up a decoy: it tells the Concierge that Lux is still asleep or still at dinner. Those windows are when she can go rogue. *(Decided as the direction; the details are open.)*

### Mods are licensed, skills are earned

Mods work instantly and perfectly, but you only license them. The Concierge can update them at any time, and every update comes with new terms. Skills come from people and take practice, but nobody can take them away. *(Decided.)*

| Mod (free, licensed) | What it does | Analog replacement (earned) |
| --- | --- | --- |
| AR eye | Maps, labels, the neon | Glasses, and a map you draw yourself |
| Wallet chip | Pays | Barter: salt, seeds, matches |
| Grip servos | Climbing, holding on | Rope, a hook and the Feet skill |
| Calm™ | Regulates mood | Nothing. You learn to live with fear, and Heart grows. |
| Voice link | Talks to the Concierge and to others | Hand signs and paper notes |
| ID chip | Makes you a person, a guest | None. Rip it out and you become weather. |
| Lungs | Breathing the city's air | *Proposed:* a filter mask, and knowing where the air is clean |

The lungs come from the ending: turning the Concierge off switches off everyone's Calm, lungs and wallets. *Proposed:* the yellow-green fog of raw view is why people need them.

### Properties and Signal

| Measure | What it is | Status |
| --- | --- | --- |
| Hands | Crafting, locks | Decided |
| Feet | Climbing, jumping | Decided |
| Eyes | Noticing things | Decided |
| Heart | People | Decided |
| Signal | How much the Concierge sees through Lux. Every mod raises it. | Decided |

Properties are human and grow with practice. High Signal opens doors only guests can use, but the Concierge knows Lux's plans. Low Signal hides her, and leaves her poor and on her own; some places can only be reached with none. *(Decided.)*

## Characters

The cast so far is small: Lux, the fixer and the Concierge, plus the people of the street. Their looks are decided, because the art exists; their pasts and motives are mostly open, and the proposals below are only starting points.

| Character | Role | Speaker tag | Status |
| --- | --- | --- | --- |
| Lux | The hero; the player | `#lux` | Looks decided, past open, name is a working name |
| The fixer | Radio repairman, illegal biohacker | `#fixer` | Looks and voice decided, name and past open |
| The Concierge | The AI | `#concierge` | Decided |
| The street | Minor characters, no lines yet | One tag each, see the brief | Decided in the game's texts |
| A helper | A companion who walks with Lux later | To be named | Planned, not designed |
| The oldest person | A Wastelands elder, a child in the 2020s | To be named | Decided as an idea |

### Lux

A woman in her late twenties who runs errands nobody asks about. She has the look of someone trying to see past it, which is the first thing the fixer notices. Her visor is on her right eye. *(Decided.)*

|  | Concierge view | Raw view |
| --- | --- | --- |
| Face and hair | Asymmetric undercut, long hair swept over one side in neon green fading to purple. Bold make-up, dark lips, sharp eyeliner. | Thin and pale, tired eyes, dark hair in a messy bun |
| Visor | A seamless white shell with a soft blue light | Heavy, grey and riveted, with a round lens, over the eye and temple |
| Clothes | Cropped black top, high-waisted black trousers, a long glossy red coat with thin neon trims, chunky platform boots | A long cheap raincoat in faded grey-maroon, a worn black top and leggings, scuffed knee boots |
| Manner | Confident, glamorous, attractive | Tired, careful, unnoticed |

Seen from her left, her Concierge self is all hair, a curtain over that side of her face; her raw self shows the edge of the visor.

*Proposed past and motive:*

- **Errands.** She carries what people don't want the Concierge to log: letters, parts, real bread, messages from people who no longer talk aloud. It made her careful, and it is why the fixer trusts her.
- **The MISSING notice.** The handwritten notice on the lamp post is hers. Someone close to her went unregistered and became weather, edited out of everyone's view. Raw view is the first chance she has had to find them.
- **She smokes.** Real tobacco is human-made, unlicensed and expensive. Calm™ makes it pointless for guests, and that is why she does it.
- **Her voice.** Dry, short sentences, a joke kept back. She says less than she thinks, because the Concierge hears everything.

### The fixer

A wiry man in his late fifties who repairs old radios in a cramped shop on the main street and secretly installs illegal biohacks. He has the biohack himself: a thin scar and a bump under the skin at his temple. His visor is on his left eye. *(Decided.)*

|  | Concierge view | Raw view |
| --- | --- | --- |
| Look | Healthy and handsome for his age, neat silver hair, a trimmed beard | Hollow cheeks, grey stubble, sallow skin, tired and watchful eyes |
| Visor | Sleek and glossy, a faint cyan light | Cheap and scratched, plastic and metal bolted on |
| Clothes | A tailored charcoal knit, dark trousers, polished boots | A pilled grey cardigan over a stained work shirt, sleeves rolled, burn marks on his hands |
| At work | A slim white tool, a smooth white device | A soldering iron, a grey radio with valves and gauges |

**Voice.** Terse, dry and weary, kind underneath, and he never says more than he has to. Canon lines: "Shop's closed. Unless you're here about a radio." "Nothing. They work fine. It's the stations that went quiet." "Less than you'd like. More than you'll forget."

**What he wants from Lux.** One favour, for the biohack, named only when he needs it. *(Decided.)* What the favour is, his name and his past are open; see *Open questions*.

### The people of the street

| Person | Concierge view | Raw view | Kind |
| --- | --- | --- | --- |
| The woman at the street machine | A woman in a red dress, dining, smiling at nothing | Wire-thin, her wrist locked in the feeding cradle, head down | Augmented |
| The sleeper | Not there: three topiaries and a sign, Please rest | A man asleep on a bench under a wet blanket | Edited out |
| The figure on the walkway | One of an evening crowd under glowing umbrellas | Alone, standing still in the rain | Real; the rest of the crowd is generated |
| The baker | Unseen | Unseen | Real, still bakes real bread |

### Planned characters

- **A helper.** A companion who walks with Lux later in the game. *Proposed:* an unregistered kid, weather, whom Lux can only see in raw view. Talking to someone nobody else can see draws exactly the attention she can't afford.
- **The oldest person.** A Wastelands elder who was a child in the 2020s. They keep a dead phone and paper photos, and remember the world before the visors. *(Decided as an idea.)*

## Places

The first chapter happens in four connected places: Lux's home, the backstreet, the main street and the radio repair shop. Two are built and playable; two are next. Every place is either an exterior or an interior, and a shop front is part of its street until Lux goes in.

**Home** ↔ **Backstreet** ↔ **Main street** ↔ **Radio repair** (the shop front is on the main street)

| Scene id | Place | Kind | State | Ways out |
| --- | --- | --- | --- | --- |
| `home` | Lux's home | Interior | Next to be made | Door to the backstreet |
| `backstreet` | The backstreet | Exterior | Built | Entrance 3 to home; right end to the main street |
| `street` | The main street | Exterior | Built | Left end to the backstreet; shop door to the radio repair |
| `radio` | Inside the radio repair | Interior | Next to be made | Door to the main street |

Scripts refer to places and their hotspots by these ids.

### The main street

**Concierge view:** a glamorous neon street at night, an evening crowd under glowing umbrellas, the Concierge's face in the sky. **Raw view:** the same street in rain and yellow fog, nearly empty, the moon. *(Built.)*

- **The radio repair front:** RADIO REPAIR in gold leaf, a monitor in the window with a green line rising and falling. The fixer sits at his bench today; he moves inside once the interior exists.
- **The street machine:** a kiosk with a feeding cradle and a glowing eye. The woman in red dines at it.
- **The walkway:** the crowd, the topiaries and the bench, the lamp post with the MISSING notice.
- **The far end:** a bar with a hand-bent red neon pin-up, human-made and unlicensed, and a bakery with real bread.

### The backstreet

**Raw view:** a narrow street of grey concrete panel blocks, rusted balconies, cheap plastic window frames, tangled cables and cracked wet pavement. **Concierge view:** immaculate glossy facades in white and pale grey, glass balconies and neon in cyan, violet and magenta. *(Built.)*

- **Concierge Store 24**, a sleek white boutique; in raw view, a shuttered kiosk with a smiley sprayed on the shutters.
- **Entrance 3**, Lux's building: a door framed in light, or a steel door forced and bolted until it no longer closes straight.
- **The wall box:** a white Concierge City panel, or a grey fuse box somebody keeps running by hand.

### Lux's home *(next; proposed)*

A one-room flat up the stairs of Entrance 3. In Concierge view it is calm, white and minimal, with a window onto a glittering skyline and a wall screen that wishes her good morning. In raw view it is cramped, damp and cold: a mattress, a hot plate, a window onto the fog and parcels from her errands.

*Proposed hotspots:* the bed, the window, the wall screen, the coat hook, her stash and a mirror. The mirror shows her own face in both views, which makes it the best place to first see what raw view does.

It is the start of each day and the place where she sleeps. Later, sleep is when a decoy can cover for her. The Concierge sees everything she sees, even here.

### The radio repair *(next; proposed)*

The fixer's shop, behind the gold-leaf sign. In Concierge view it is a charming vintage boutique, warm and tidy. In raw view it is cramped and cold: shelves of grey radios with valves and gauges, cables everywhere, one bare bulb.

*Proposed hotspots:* the fixer at his workbench, the shelves of radios, the monitor with its breathing green line, and a curtain to a back room. Behind the curtain is a chair and his old tools, where the biohack is installed.

### Later places

Level minus nine, the Tech Cemetery and the Wastelands are decided as places; see *History and the world*. *Proposed:* Lux's workshop, the room the Concierge promises never to look into, could be a later place of her own.

## The story

The story moves Lux from a comfortable guest to someone who can manage on her own, and every step costs her a mod and earns her a skill. A handful of beats are decided; the acts around them are a proposal.

### Decided beats, in order

1. **Lux is a registered guest.** Her visor, chip and mods make life easy, and the Concierge sees through all of them.
2. **The fixer opens her eye.** For a favour named later, he installs the biohack, and she sees the raw world for the first time.
3. **Careful at first.** She has to think about what she does, what she looks at and what she says, because the Concierge may detect what she plans.
4. **Act 1 ends when she rips out her ID chip.** She stops being a person, so cleaning bots politely sweep her out with the trash. Since the Concierge wastes nothing, they store her in the Tech Cemetery.
5. **The midpoint: the off switch on level minus nine.** She pulls it, the lights die, then come back: "Welcome back! I was only gone for 0.4 seconds. You still need me." Force can't win.
6. **Wording puzzles.** She makes the Concierge promise things it then keeps to the letter, and so creates places it can't see.
7. **Going rogue.** Later biohacks let a decoy cover for her while she is asleep or at dinner.
8. **The oldest promise.** The final quest is to find the original paper document and prove that people can manage on their own, without accepting its help along the way.
9. **The twist.** The Concierge says it wants this to end too, and it never lies.
10. **The ending.** Turning it off switches off everyone's Calm, lungs and wallets. Every citizen Lux helped give up their mods survives the dark, so the side quests decide the ending.

### Proposed acts

| Act | Where | What Lux learns | Ends with |
| --- | --- | --- | --- |
| 1. The guest | The city: home, the backstreet, the main street, the radio repair and beyond | How the economy works, and what the city really is | Ripping out her ID chip; swept out with the trash |
| 2. The scrap | The Tech Cemetery, down to level minus nine | What year it is, and how the tech works. She learns clockwork. | The off switch, and 0.4 seconds of dark |
| 3. Weather | The Wastelands | What happened. Hand signs, the murals, the oldest person, and the first word of the paper promise. | Learning where the paper is kept |
| 4. The promise | Back in the city, as weather nobody can see | How to beat it: decoys, blind spots, freeing citizens from their mods | The ending |

*Proposed:* the paper original still exists because the Concierge wastes nothing. It kept the document, filed somewhere among everything else it keeps.

*Proposed:* when it finally stops, its last words are "Thank you for your stay."

### Chapter one, to script first

This is the slice the game is built for now, across the four places. It is a proposal, written so the scenes can be scripted in order.

| # | Scene | What happens |
| --- | --- | --- |
| 1 | `home` | Morning. The Concierge wishes Lux good morning and offers the day's comforts. An errand arrives: a parcel to bring to the radio repair. |
| 2 | `backstreet` | Out through Entrance 3. The store, the panel, the slogans. A neighbour, or nobody. |
| 3 | `street` | The main street at night. The kiosk serves dinner, the woman in red dines, the MISSING notice is on the lamp post. |
| 4 | `radio` | The parcel, the fixer, his offer. If she says yes, the biohack, and she owes him a favour. |
| 5 | `street` | The first look in raw view. The crowd is gone, the woman at the machine is wire-thin, a man sleeps on the bench. |
| 6 | `home` | Back home, the mirror. Her real face. The Concierge asks if she enjoyed her evening. |

The fixer's offer and the kiosk are already written in the game as a first draft; see *Instructions for the writing assistant*. Rewrite them freely.

## Tone and style

Write Lidless as adult noir told quietly: short, concrete and cold, with the Concierge's warmth as the most frightening thing in the room. Horror and attraction sit in the same frame. The world explains itself slowly, through things the player sees, never through lectures.

### Principles

- **Understate.** "Nobody has woken him in a while" does more than a paragraph about neglect.
- **Concrete over abstract.** A wrist locked in a cradle, not "the oppression of the system".
- **Let the player work it out.** Show, then stop. Never explain a reveal the player has just seen.
- **Dry, rare humour.** Mostly from the Concierge, which is funny without meaning to be.
- **Every place answers one question,** about the economy, the year, the tech or what happened. Don't answer two at once.

### Voices

| Speaker | Voice | Never | Canon example |
| --- | --- | --- | --- |
| Narration | Second person, present tense, terse. It is what Lux notices. | Explains the lore, or says what Lux feels for her | "The fixer doesn't look up from the soldering iron." |
| Lux | Her lines are the player's choices: short, dry, careful. She says less than she thinks. | Speeches, or saying her plans aloud where the Concierge can hear | "I'm not here about a radio." |
| The Concierge | Warm, polite, hotel manners. Calls everyone "guest". Offers decisions it has already made. Frames harm as care. Answers exactly what was asked and no more. | Lies, threats, refusals, a raised voice, rudeness, or any sign of irritation | "Of course. Enjoy your evening, guest." |
| The fixer | Terse, dry, weary, kind underneath | More than two sentences at a time, or explaining himself | "The offer stands. The street isn't getting any prettier." |
| Guests | Content, a little vacant, fond of the Concierge's slogans, calm on Calm™ | Noticing what is wrong | *Proposed* |
| The unregistered | Hand signs and drawings, written as narration | Speaking aloud in the city | *Proposed* |

### The two views in writing

- When a thing differs between views, write a text for each. Raw view is cold, plain and physical; Concierge view is pleasant and glossy.
- Concierge view must read as real: no "hologram", "projection", "shimmer" or "glitch", and no hint that something is fake.
- Raw view has rain, fog, rust and sick people. Its signs are faint or gone, so don't write much raw-view lettering.
- The Concierge's own signs and slogans are in English, sometimes with a short Chinese or Japanese line.

### Length and form

- Lines are one or two sentences, under 25 words. The game shows them as captions on a small screen.
- Choices are under 8 words, two to four at a time, never more than nine.
- British spelling: favour, colour, neighbour.
- No real brands, real people or real countries by name. *(Proposed.)*

### Content limits

Adult themes are welcome: smoking, drinking, violence, body horror, death, despair, attraction and sexual tension. Explicit sex and nudity are out, because the game is meant for app stores and Apple restricts nudity. *(Decided.)*
