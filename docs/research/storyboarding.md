# Storyboarding

*What a storyboard is actually for, the key-poses → breakdowns → in-betweens
workflow, and the notation that turns a board into a timing plan. Sourced from
the primary literature where it could be reached, with the reaches that failed
recorded as such.*

Written because `docs/hero-beat-storyboard.md` needed a discipline behind it, and
because the hero beat had been built as a parameter model — durations, easing
curves, camera dials — with no board behind it at all.

---

## The bottom line

**A storyboard is not a picture of the finished thing. It is an instrument for
finding out whether a sequence works before anyone animates it.** Every practice
below follows from that one purpose:

- **Plan the storytelling drawings first.** Richard Williams: *"What is a key?
  … The storytelling drawing. The drawing or drawings that show what's happening
  in the shot."* Not the prettiest frame — the one that carries the information.
- **The drawing between two keys decides the character of the move, and it is not
  the midpoint.** Williams: *"If the breakdown or passing position is wrong, all
  the inbetweens will be wrong too."* Put a drawing exactly halfway and you get
  even spacing, which reads mechanical.
- **Work small, fast, and do not erase.** Nancy Beiman: *"Try not to spend more
  than five minutes drawing one panel."*
- **Grade the panel in silhouette.** Walt Disney, quoted in *The Illusion of
  Life*: *"Work in silhouette so that everything can be seen clearly."*
- **Then put time back in.** The board is untimed; a separate pass — *slugging*,
  then the story reel — assigns durations and gets re-cut.

And the finding that matters most for us: **nobody has written this discipline up
for interface motion.** §6 is the honest search. The UI-motion canon is duration
tokens and easing curves; the words *key pose*, *breakdown* and *storyboard* are
essentially absent from it. Which means the method has to be borrowed from film
animation directly, and that borrowing is what the hero-beat storyboard does.

---

## 1. Pose to pose, and who draws what

### The principle, in Disney's own words

Thomas & Johnston, *Disney Animation: The Illusion of Life* (1981) — read from the
Internet Archive OCR derivative
([full text](https://ia800800.us.archive.org/32/items/disney-animation-the-illusion-of-life/Disney%20Animation-The%20Illusion%20of%20Life_djvu.txt)):

> There are two main approaches to animation. The first is known as Straight
> Ahead Action because the animator literally works straight ahead from his first
> drawing in the scene. He simply takes off, doing one drawing after the other,
> getting new ideas as he goes along, until he reaches the end of the scene. He
> knows the story point of the scene and the business that is to be included, but
> he has little plan of how it will all be done at the time he starts. Both the
> drawings and the action have a fresh, slightly zany look…
>
> The second is called Pose to Pose. Here, the animator plans his action, figures
> out just which drawings will be needed to animate the business, makes the
> drawings, relating them to each other in size and action, and gives the scene
> to his assistant to draw the inbetweens.

That last clause is the division of labour stated by the studio itself: **the
animator makes the planned drawings; the assistant draws the in-betweens.** And
the order is explicit — planning first, then interpolation:

> Once these poses relate well to each other, it is a simple matter to time the
> intervening drawings and to break down the action.

Pagination for this passage (pp. 56–58, and p. 53 for Staging) is secondhand via
[Wikipedia's article on the twelve principles](https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation);
we did not confirm it against a physical copy.

### The vocabulary

Richard Williams, *The Animator's Survival Kit*
([Archive.org OCR](https://ia801401.us.archive.org/16/items/TheAnimatorsSurvivalKitRichardWilliams/The%20Animator%27s%20Survival%20Kit%20-%20Richard%20Williams_djvu.txt)):

> The main drawings or extreme positions came to be called **extremes** and the
> drawings in between the extremes were called the **inbetweens**.

> In the 1930s they called this the **'break-down' drawing** or **'passing
> position'** between two extremes.

> Question: What is a key? Answer: The storytelling drawing. The drawing or
> drawings that show what's happening in the shot. If a sad man sees or hears
> something that makes him happy, we'd need just two positions to tell the story.

So the ladder is: **keys** (what the shot is about) → **extremes** (the outer
structural positions of each move) → **breakdowns / passing positions** (the one
between) → **in-betweens** (everything else). Williams is scathing about the
industry's collapse of the first two:

> Important animators are called key animators, and word got round that they just
> draw the keys — anything that they draw is a key — and slaves fill in the rest
> according to the little charts provided by the key animators. **Wrong.**

### Why the breakdown, not the midpoint, is where the move lives

This is the load-bearing idea, and Williams states it twice:

> We can see how important that middle position between the two extremes is going
> to be to us. It's obvious how important this middle position is.

> **If the breakdown or passing position is wrong, all the inbetweens will be
> wrong too.**

The reason is structural, not aesthetic: everything downstream is *derived* from
the breakdown, so an error there cannot be recovered by interpolation. The
corollary is the standard anti-pattern, put plainly by Brent Noll of BAM
Animation ([animating a head turn](https://brentandmax.com/animating-a-head-turn/)):

> the WRONG way to do break down drawings is to put a drawing exactly in the
> center of the animation. that creates a situation where you have EVEN SPACING
> between your drawings, and it looks very mechanical.

Williams also quotes Grim Natwick — **"Bad inbetweens will kill the finest
animation"** — and credits Dick Huemer, from the Fleischer studio, with inventing
the role: *"Dick actually told me that he had invented the inbetween and the
inbetweener, the helper or assistant."*

### Williams's own recommended hybrid

Not pure pose-to-pose. Plan in **small thumbnail sketches**; make the big
storytelling drawings (the keys); add the other important drawings; then use those
as *guideposts* and work **straight ahead on top of them, improvising freely**.
Straight-ahead with no plan he characterises as *"We just start drawing and see
what happens — like a kid drawing in the page corners of a schoolbook — stick the
numbers on afterwards."*

**Correction to a common belief:** there is no chapter called "Keys and
Breakdowns" in the *Survival Kit*. The extremes/breakdowns material sits inside
**"Advancing Backwards to 1940"** and the timing/spacing chapter. The real chapter
list, from the OCR: Why This Book? · Drawing In Time · Time To Draw · It's All In
The Timing And The Spacing · Advancing Backwards to 1940 · Walks · Runs, Jumps and
Skips · Flexibility · Weight · Anticipation · Takes and Accents · Timing,
Staggers, Wave and Whip · Dialogue · Acting · Animal Action · Directing · Review.

---

## 2. What a board is FOR

### The origin, and the purpose stated at the same time

Disney's own encyclopedia, [D23 on storyboards](https://d23.com/a-to-z/storyboards/),
in full:

> Disney storyman **Webb Smith** is credited with coming up with the idea of
> storyboards in the early 1930s. These **4×8-foot boards** had story sketches
> pinned up on them in order, and the Disney artists found it **much easier to
> visualize a story this way than to read a script**. Since the 1930s,
> storyboards as invented at the Disney Studio have come into general usage
> throughout the motion-picture industry…

[Wikipedia](https://en.wikipedia.org/wiki/Storyboard) dates the first complete
boards to **Three Little Pigs (1933)** (citing Diane Disney Miller, *The Story of
Walt Disney*, 1956), says all American animation studios were boarding by 1937–38,
and gives *Gone with the Wind* (1939), with **William Cameron Menzies**, as an
early fully-boarded live-action film. It also records what the practice replaced,
citing Sergio Paez, *Professional Storyboarding: Rules of Thumb* (2013): *"every
animator was assigned a scene and had to come up with gags around a theme with no
regard to how they worked as part of a narrative."* Both Miller and Paez are
secondhand here — read through Wikipedia's quotation, not in the originals.

### Pixar says it best, and quantifies it

**"Designing a Pixar Film," Pixar Animation Studios** — an eight-page institutional
paper with no individual byline
([PDF](https://opendesignproject.weebly.com/uploads/2/9/1/6/29168267/designingapixarfilm.pdf)).
Quotes below are from the actual PDF pages.

On what boarding *is*:

> The storyboard is a way to write a story using pictures instead of words. The
> goal is to find actions, presented visually, that provide clues to what the
> character is thinking, feeling or wants. In writing, it is easy to describe
> something, like 'Woody is tired.' In a film, description is not enough, we have
> to deliver experience, so the goal is to create action onscreen that leads the
> audience to discover, 'hey, look at how Woody is acting, I think he is tired.'

On the reel as a deliberately rough stand-in:

> Another is **approximation**, building rough draft representations of the
> finished product that allow us to see the whole, rather than its parts. The
> story reel is a good example of approximation… **The story reel is a vehicle for
> substitution and replacement**: each slightly more finished version of each
> scene goes into the story reel. In the end, four years later, the story reel has
> evolved to become the finished film.

On the division of labour, and the sentence that justifies the whole discipline:

> Editorial takes the storyboards and **puts time back into them**. Editorial's
> product, the story reel, comes about not only from the storyboards but also
> from watching the storyteller's pitch, the process of acting out the storyboard
> sequence to give it life.

> We emphasize freedom in the planning part of the process because of the nature
> of animation, which means building each frame of a **120,000 frame** film. Later
> on in the implementation process we will have a lot less room to improvise and
> discover, so we need to get in as much of that as we can while our focus is on
> planning, **when the cost of exploration is low**.

> In the course of the four years it takes to make one of our films, **the first
> three and a half years are driven by this cycle** (Story → Art → Editorial →
> Story).

Three and a half of four years on boards and reels. That is the argument.

### The animatic, and its stated function

[Wikipedia's Leica reel](https://en.wikipedia.org/wiki/Leica_reel): a storyboarding
device also known as *story reel* or *animatic*; the name derives from the German
camera maker whose cameras were used to shoot the boards. The Disney-origin claim
for the term comes from a **Leica Camera press release** (2023), i.e. marketing —
treat the dating as unconfirmed.

[Wikipedia's animatic](https://en.wikipedia.org/wiki/Animatic), citing Kelly Gordon
Brine, *The Art of Cinematic Storytelling* (OUP, 2020, p. 37): animatics let
animators and directors *"work out any screenplay, camera positioning, shot list,
and timing issues that may exist with the current storyboard,"* and help a
production *"avoid wasting time and resources on the animation of scenes that would
otherwise be edited out of the film at a later stage."*

Whitaker, Halas & Sito, *Timing for Animation* (p. 5) collects the synonyms:
*"These storyboard films have been referred to in the past with various names: the
**Animatic, Workreel, Storyreel or Leica reel**."* And gives a board-density
guideline: *"approximately **100 storyboard sketches for each minute of film**. If,
however, a film is technically complex, the number of sketches could double."*

### Disney Animation today

[disneyanimation.com/process/story](https://disneyanimation.com/process/story/):
*"The storyboarding process was developed at Walt Disney Studios in the 1930s and
the art form continues in our studio today."* Story artists *"start by drawing
thumbnails based on the script"* and *"work from rough to fine"*, thinking about
*"emotion, expression, timing, staging, and framing."*

Worth knowing for us: **staging is a separate downstream department that consumes
the board.** [disneyanimation.com/process/layout](https://disneyanimation.com/process/layout/):
*"Working from storyboards, Layout Artists use a film's characters, sets, props and
cameras to stage, block, and shoot the film, shot by shot."*

---

## 3. Thumbnails

The practice: tiny, fast, rough, disposable — and *kept*.

Nancy Beiman, *Prepare to Board!*
([Archive.org OCR](https://ia803102.us.archive.org/1/items/preparetoboard/Prepare%20to%20Board_djvu.txt)):

> **Do not use an eraser and do not throw away any of the drawings.**

> Work quickly and never scratch out a drawing — just draw another sketch on the
> same page if you are not satisfied with the first one.

> **Try not to spend more than five minutes drawing one panel** for feature length
> and short animated films. Most are done in less time than this.

> Work rough and don't worry about design details at this time.

She also recommends **lined paper**, to *"maintain character volumes and create a
rough size guide."*

The *why* — the reason small forces better composition — is best put by
**Marcos Mateu-Mestre**, *Framed Ink*:

> Remember, in order to achieve the needed 'quick read', do not think in terms of
> the 'elements' you need to compose at first (characters, furniture, rocks,
> trees), but think in terms of **basic, clear, and readable shapes**.

Wikipedia's definition supplies the size point: thumbnails are *"rough sketches
not bigger than a thumbnail,"* sometimes drawn in script margins.

**Dead end:** no primary source prescribes a thumbnail *count*. Beiman's
five-minutes-per-panel is the only hard number we could verify. We are not
inventing one.

---

## 4. Staging, screen direction, and how a panel is graded

### Staging, defined by the studio that named it

*The Illusion of Life*, verbatim:

> Staging is the most general of the principles because it covers so many areas
> and goes back so far in the theater. Its meaning, however, is very precise: it
> is **the presentation of any idea so that it is completely and unmistakably
> clear**. An action is staged so that it is understood, a personality so that it
> is recognizable, an expression so that it can be seen, a mood so that it will
> affect the audience.

> The most important consideration is always the 'story point.' It has been
> decided, for example, that a certain piece of business will advance the story;
> now, how should it be staged? Is it funnier in a long shot where everything can
> be seen or in a close-up featuring the personality? … **every frame of the film
> must help to make this point of the story.**

And the silhouette test, with its two attributions — this is the citation for
"does the panel read as a shape":

> Chaplin maintained that if an actor knew his emotion thoroughly, he could show
> it in silhouette. Walt was more direct: **'Work in silhouette so that everything
> can be seen clearly.'**

The book also gives the historical reason the studio learned it the hard way:
*"The characters were black and white, with no shades of gray to soften the
contrast or delineate a form… There was no way to stage an action except in
silhouette."* Directly relevant to an ink-black subject on paper.

### Screen direction and the line

[180-degree rule](https://en.wikipedia.org/wiki/180-degree_rule): keep the camera
on one side of an imaginary axis between two subjects, so that the first stays
frame-right of the second. Violating it — *"jumping the line"* / *"crossing the
line"* — *"will reverse the order of the characters from left to right and may
disorient the viewer."* Deliberate breakers named: Dreyer, Kubrick, Godard, von
Trier. Honestly noted in the same article: empirical work has found that *"while
viewers can spot violations, the presence of these violations has a negligible
effect on the enjoyment of the scene"* — so it is a guideline, not a law.

[Continuity editing](https://en.wikipedia.org/wiki/Continuity_editing) supplies two
more:

- **30-degree rule** — *"no edit should join two shots whose camera viewpoints are
  less than 30 degrees from one another."*
- **Jump cut** — *"a cut between two shots that are so similar that a noticeable
  jump in the image occurs,"* described as *"a device of disorientation."* This is
  the citation for *cutting between two near-identical framings reads as damage.*

Mateu-Mestre, *Framed Ink*, on the same ground from a board artist's side:
*"Staying on the same side of 'the line': A device that will help us keep a clear
sense of geography along the same sequence."* / *"Never crossing the line and
therefore always keeping the characters screen left and the statue screen right."*
/ *"Screen direction: Culturally we are used to reading in a certain direction…
influencing the way we 'read' the screen."* He has a chapter, *"Composing for
Continuity — How one thing affects the next: thinking in continuity."*

Mark Simon, *Storyboards: Motion in Art* (3rd ed.), ch. 31 abstract — a
search-snippet quote, not a page we read: *"Screen direction refers to the
direction that objects or characters move on the screen. Consistent screen
direction is important in visual storytelling because it often tells the viewer
where a character is going and when the character changes direction."*

### Dolly vs zoom, and why directors care

[Dolly zoom](https://en.wikipedia.org/wiki/Dolly_zoom) explains it through axial
magnification: *"when using a longer focal length while moving the camera/lens away
from the object to maintain the same magnification M, objects seem shallower, and
the axial distances between objects seem shorter."* So **a dolly changes
perspective — parallax and apparent depth between things; a zoom only changes
magnification.** The effect was devised by **Irmin Roberts**, a Paramount
second-unit cameraman, for Hitchcock's *Vertigo*, and *"Roberts was not properly
credited."*

This distinction is exactly why a slow push on a subject with no other objects in
frame carries almost no information: with nothing to be parallaxed against, a
dolly is indistinguishable from a zoom.

### Composition rules for a panel

From Damien Stuart Wood, *Composition for Storyboards*
([storyboardart.org](https://storyboardart.org/storyboard-tutorials/composition-for-storyboards/)),
crediting Giancarlo Volpe for the thirds examples and Sergio Paez for resources:

- **Focal point** — *"Every storyboard needs a focal point or center of interest,"*
  *"clearly designed within the picture frame."*
- **Thirds** — divide the frame in thirds both ways; the intersections make good
  positions.
- **Tangents** — *"a tangent occurs when two lines or forms intersect or nudge
  close enough to each other to create a distraction."*
- **Line character** — *"Horizontal lines give off a feeling of calm — static,"*
  *"Diagonal lines feel more active than either verticals or horizontals."*
- **Depth** — foreground / middleground / background as *"three layers,"* built by
  overlap and size change.
- **Negative space** — *"Good use of shapes should force you to take advantage of
  the negative space."*

**Line of action and silhouette** — John Kricfalusi,
[Animation School Lesson 5](https://johnkstuff.blogspot.com/2006/05/animation-school-lesson-5-line-of.html):

> Line of action helps your poses 'read'. It makes them clear and understandable
> and gives them a distinct non-ambiguous direction.

> See the empty spaces between the arms and legs and major forms in the drawings
> above? Those are **negative shapes**. They are as important to your drawing as
> the positive shapes. They help make the silhouette read.

The lineage is **Preston Blair**, *How to Animate Film Cartoons* (1949).

**One hard studio rule worth stealing**, from Hanna-Barbera's internal *H&B Layout
Notes* (Charles Grosvenor, Iwao Takamoto, Bob Singer, John Ahern, Don Morgan, Gary
Hoffman —
[PDF](http://www.animationmeat.com/pdf/televisionanimation/HB_LayoutNotes.pdf)):
a board panel is never read alone.

> layout artists should constantly refer to three separate sources of information
> on the storyboard: (1) the panel drawn by the board artist, (2) the script
> beneath the panel, executed by the writer, and (3) **the slugging notes, timed
> out by the director**… Layout artists should NEVER base their work solely on the
> drawn storyboard panel.

And an admission of the board's status: *"Poor storyboarding should also be
recognized in the planning stages… The storyboard is not gospel."*

### Boards for animation differ from boards for live action

Whitaker/Halas/Sito, p. 6:

> Live action storyboards tend to emphasize frame composition and mise-en-scène or
> cinematic narrative, and do not focus upon the individual actor's performance…
> By contrast, storyboards for animated films place great emphasis upon **the
> character's performance and what they are thinking or feeling**.

Terminology trap from the same page: in an animated film each individual cut is
called a **scene**, and the sum of the cuts a **sequence** — the reverse of
live-action usage.

---

## 5. Turning a board into a timing plan

### Slugging — the mechanism

This is the step between "the board reads" and "the board has durations."
Whitaker/Halas/Sito, p. 15:

> While the soundtrack is being edited from the collection of individual 'takes',
> **the director goes through the storyboard with a stopwatch and 'slugs' the
> board, which means noting the amount of time for the pauses in between lines of
> dialog.** This way the amount of time needed for actions not using dialog can be
> roughly anticipated… Adding the total amount of slugs and dialog lengths
> together gives the director an idea of the total length of the show before any
> animator has begun to draw.

Then it gets re-cut against a fixed budget: *"If the contract with a television
station is to deliver 12 episodes of 24 minutes 40 seconds each… you cannot give
them 26 or 28 minutes with excuses."* And deliberately leaves headroom: *"Some
allowance should be given for the animator to expand the length of their scenes to
create an inspired bit… In this case, time will have to be lost somewhere else in
the reel."*

Conor & Stina McMullin's working definition
([mcmullinanimation.com](https://www.mcmullinanimation.com/Slugging.htm)): *"if the
show is too long, [the director] must find sequences that can be deleted without
disturbing the story telling… if the show is too short, the director has to find
areas where he can either add new scenes or stretch out existing scenes, without
slowing down the pace of the story."*

### The exposure sheet

Also called dope sheet (UK), X-sheet, camera instruction sheet. Whitaker/Halas/Sito
p. 19: *"The timing is transferred to printed dope sheets (UK), which are known as
'exposure sheets' or 'X sheets' in the USA."*

Format: **one row per frame**, with every eighth line ruled thicker (half a foot of
35mm film, 16 frames to the foot). A classic sheet holds 4 seconds — 96 rows at
24 fps; television studios working at 25 fps use 100-frame sheets, also 4 seconds
(Whitaker/Halas/Sito p. 19;
[D'source, IDC IIT Bombay](https://www.dsource.in/course/exposure-sheet/basic-x-sheet-template)).

Columns, left to right, per the IIT Bombay course notes:

| Column | What goes in it |
|---|---|
| **Action** | *"the timing planned out for the scene, how long the scene should take; and also the action of the character, at what point would the character have a particular pose"* |
| **Dial** | the dialogue breakdown — *"to know at which frame to hit a certain phoneme"* (or the beats of the music if there is no dialogue) |
| **Cel levels** | *"generally five of those columns, each representing one layer of cel"* |
| **Background** | which background, how long it holds, when it switches |
| **Camera** | *"If you want the camera to pan, or zoom in or just shake, all of that goes in here"* |

Whitaker/Halas/Sito's caption for a completed sheet (fig. 10, p. 18): *"Each
horizontal division represents one frame of film. The director's timing is in the
left-hand column and the camera instructions are on the right. The animator has
written the numbers of their drawings in the middle six columns."*

**The director's shorthand** — the best single find in this research, p. 19:

> People have their own individual shorthand, but generally **a horizontal line
> means a hold, a curve means an action of some sort, a loop means the
> anticipation to an action, a wavy line means a repeat cycle**, and so on. If an
> action must take place on a certain frame, this is marked with **a cross** on the
> required frame.

Chuck Jones *"used this place to put detailed instructions, complete with small
sketches and diagrams."* A worked verbal example of the same thing, p. 20:
*"Magician's arm anticipates back 8 frames, thrusts into hat 4 frames, hold 12
frames, pull out rabbit 6 frames, hold and react 72 frames, etc."*

Order of hands on the sheet, per Brian Lemay
([slugging the sheets](https://brianlemay.com/Pages/animationschool/animation/lipsyncbook/slugging.html)):
*"1) Sound Technician 2) Director 3) Layout 4) Animator 5) Camera Operator 6)
Director."*

### Ones, twos, threes

IIT Bombay, the cleanest statement:

> The movies and animations that we watch are generally shot 24 frames per second…
> If we draw 24 drawings for one second, with each drawing held for 1 frame, the
> animation is said to be on **Ones**. If we draw 12 drawings for one second, with
> each drawing held for 2 frames, the animation is said to be on **Twos**.

And the numbering convention that follows: *"while numbering your drawings on the
x-sheet while animating on twos, always use **odd numbers**, subsequently skipping
every next row; and when you want to smooth something out or need a very fast
action, just add in the ones with even numbers."*

Whitaker/Halas/Sito devote a chapter (pp. 52–53) and give three rules rarely stated
elsewhere:

1. *"Most things can be animated sufficiently well on double frames, 'twos', to
   make the added expense of single frames unnecessary."*
2. *"It is **dangerous to animate on double frames during a table move 'pan'**
   and/or camera track 'zoom' or 'truck'. These moves are usually done on single
   frames for smoothness and the combination of doubles and singles can produce
   effects of 'jitter'."*
3. *"Animation to be matched to live action figures or characters has to be done
   with single frames."*

Also: *"Vibrating movements may also need single frames. A vibrating movement
ABABAB, etc., with two frames on A and B, gives a surprisingly slow
reverberation."* On threes and fours,
[Wikipedia](https://en.wikipedia.org/wiki/Traditional_animation) names **Bill
Plympton**, who holds each drawing *"from 1⁄8 to 1⁄6 of a second"* — and notes that
threes is *"usually done to meet budget constraints."*

### Timing charts

The little ladder the animator writes on the key drawing to tell the in-betweener
the spacing. Williams, from the OCR: *"The animator can get away with just drawing
the two extreme positions and making a chart for the assistant to put in all the
inbetween positions… **The chart shows the spacing.**"*

Notation, from BMCC/CUNY course notes (MMP260, Prof. Pinkas —
[week 3](https://openlab.bmcc.cuny.edu/mmp260-pinkas-s2020/week3/)) and confirmed
independently by Williams:

- *"It's a straight line starting and ending with the first and last keyframes of
  the action."*
- **A keyframe is circled.** Williams: *"The drawings which are circled are the
  'keys'."*
- **A breakdown is underlined.** Williams: *"Some animators underline the
  breakdown or passing position because it's so important to the action."*
- *"An arch bridging three steps on a timing chart means that the two halves are
  equal."*

The chart lives *on the key drawing itself*, with that key's number circled at the
head of the ladder. The halving procedure, Williams verbatim: *"Number 3 is smack
in the middle between 1 and 5. Then we put number 2 right in the middle between 1
and 3 — and number 4 in the middle between 3 and 5."* Williams traces the practice
to spacing marks **Grim Natwick** made directly on his drawings: *"I suddenly
realised that this was probably the origin of the charts that animators put on the
edge of their drawings."*

**Bunched marks = a cushion.** The principle is Slow In and Slow Out; the mechanism
is spacing. Whitaker/Halas/Sito, pp. 44–45: *"If the arm is at rest at the beginning
and end of the movement, then the drawings are spaced more closely at the beginning
and end. This gives the impression that the arm is a fairly weighty object
accelerating from rest and decelerating again at the end."* Williams notes Ken
Harris's word for it: **"cushioning"**.

Named chart types, from Brian Lemay
([timing charts](https://brianlemay.com/Pages/animationschool/animation/lipsyncbook/timingcharts.html)):
half in-between; half in-between with slow-in; slow-out; **thirds** (*"even
paced"* — one in-between at the third, another at the half); and **favour /
cushion**, *"a single inbetween marked with 'F'"* that softens *"into the key but
not be at the 1/2 way point."* Fractional series (1/4s, 1/8s, 1/16s) exist for very
small movements.

A chart can also be written as a bare number sequence, e.g. for a cycle
(Whitaker/Halas/Sito p. 96): *"the animation is done on double frames and charted:
1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 2, 3…"* — with the warning that in such a chart
drawings 5 and 2 *"occur twice, that is, they are on the screen for four frames out
of six and so make a greater impact on the eye than the actual extremes."*

**Honest note:** we could not find a primary source that draws the ladder as an
inline dash-string (`1----5--7-9`). Circled keys, underlined breakdowns, the
equal-halves arc, the number-sequence form, odd-only numbering on twos and the
named chart types are all verified. Reconstructing a dash-string from those is
safe, but it should be presented as a reconstruction.

### Real frame counts

Almost all from Whitaker/Halas/Sito, which is the best-sourced set we found.

| Action | Frames @24fps | Source |
|---|---|---|
| the unit | 1s = 24 frames; *"the animator also learns what multiples of this unit look like — 3 frames, 8 frames, 12 frames"* | pp. 12–13 |
| gentle arm gesture / point | ~16 (8 drawings on twos) | pp. 44–45 |
| audience's eye finds a new moving object | ~5 (*"about 1/5 second later"*) | p. 56 |
| freeze at the end of a fast throw | ~12 | pp. 54–55 |
| body held after standing up quickly | 8 | pp. 54–55 |
| a "look" off screen, before cutting to what is seen | ~12 | pp. 54–55 |
| static gag hold (cymbals raised, before a pan away) | 24 | pp. 54–55 |
| plug held with gurgling sfx | 32 | pp. 54–55 |
| reading time per word of a title card | ~16 | pp. 54–55 |
| walk, one step | 12 (= 2 steps/sec) | pp. 98–99 |
| walk through deep snow | 48-frame cycle | pp. 98–99 |
| fast vigorous run | 8-frame cycle (4 per step) | p. 117 |
| less frantic run | 12-frame cycle; *"more than 16 frames… tends to lose its dash"* | p. 117 |
| wheel rotation, minimum readable | 20–24 | — |
| drybrush trail dispersal | ≥16 | — |
| smoke dispersal | ≥32 | — |

Williams's own walk numbers, verified from the OCR: *"the first two steps are
leisurely — 16 frames long,"* then *"step 3… 14 frames,"* then *"His fourth step is
quickest — 12 frames,"* then *"On step 5 he slows up slightly — 14 frames."* Note
his word is **leisurely**, not slow. And his definition of walking, via the old
animators: **"controlled falling."**

**Blinks.** Whitaker/Halas/Sito flag the trap rather than the count: *"a similar
optical effect can occur with eye blinks if the same inbetweens are used on the way
down as on the way up, especially in close ups. In this case it is better to space
the two sets of inbetweens differently."* Numbers come from **Alexander Williams**
(Animation Apprentice; Richard Williams's son —
[why animators need to blink](https://animationapprentice.blogspot.com/2018/03/why-animators-need-to-blink.html)):
*"A standard blink is usually about 8 frames, with the lids closed for about 2
frames, and an ease-in and ease-out at either end,"* and *"often you want to offset
the eye lids by one frame."*
[Bloop Animation](https://www.bloopanimation.com/blinking-animation/) breaks it down
by type: regular = 2 close / 1 hold / 3 open; fast = 2 close / 3 open; long = 3 / 2
/ 4. Eye darts *"usually take 3 frames"*; gaze shifts 3–4.

### Holds, and the moving hold

The distinction, and the reason it depends on the drawing's own style — this is the
passage that answers it directly (Whitaker/Halas/Sito p. 55):

> If the design of the characters is more graphic and stylized, then **a long hold
> is more believable** than a realistically drawn figure held, which might look
> frozen to the audience. In the case of a realistic figure, **a moving hold** is
> desirable. The figure at rest blinks every three to five seconds, shifts its
> weight from one foot to another, etc.

Limited animation exploits exactly that (p. 1): *"With limited animation as many
repeats as possible are used… **A hold is also lengthened to reduce the number of
drawings.** As a rule not more than six drawings are produced for one second of
animation."*

And the test for whether a drawing can carry a hold at all (p. 54):

> A drawing that works as a hold is really a different kind from a normal
> animation drawing… **A held drawing can usually be extracted from the animation
> and works when framed and hung on the wall**, whereas most animation drawings do
> not.

That is, almost word for word, the test for whether something is a key shot.

Thomas & Johnston's definition of the moving hold, via Wikipedia: *"animates
between two very similar positions; even characters sitting still, or hardly
moving, can display some sort of movement, such as breathing, or very slightly
changing position."* **Shawn Kelly** (co-founder, Animation Mentor): *"a frozen
character instantly appears dead, and all your hard work goes down the drain as the
audience remembers they're just looking at a cartoon,"* but also *"As long as the
eyes are alive, you can darn near completely freeze the body."*

### Camera moves, as a board actually specifies them

**In traditional animation the camera does not pan — the artwork moves.**
Wikipedia: *"Pans are created by either moving the cels or backgrounds one step at a
time over a succession of frames (the camera does not pan; it only zooms in and
out)."* Which produces the inversion that catches everyone, from David Steinberg's
*An Animation Scene-Planning Primer* (Sullivan Bluth Studios, 1987 —
[PDF](http://animationmeat.com/pdf/featureanimation/perfectpan.pdf)): *"**A 'pan to
the left' means moving the artwork to the right.**"*

Steinberg on the vertical axis: *"Up-and-down movement (away from or toward the
artwork) is called 'trucking.' A 'truck-in' refers to a movement toward the
artwork, while a 'truck-out' denotes a movement away."*

**And the nested rectangles of a truck are literally the field chart:**

> As the camera trucks toward the artwork, the center of its field of view will
> remain the same, while the outer edges of that field will shrink from a 16-field
> (the full area of the field chart) to a 15-field… **Each concentric rectangle on
> the grid represents a one field change from the rectangle before it.** As it
> happens, a change of one field enlarges or reduces the field of view by 1 inch
> horizontally and .72 inches vertically.

Steinberg's fielding-block code, written above the camera column: `F` = field,
`N/S/E/W`, `CW/CCW`, `¢` = center. *"16F¢ means 16-field, centered in all
directions, 8F/4N+2W means 8-field, moved 4 north and two west."* Optical marks
are drawn in red: a fade is *"a red 'carrot', pointing toward the black end of the
fade"*; a cross-dissolve is *"a red 'X' … extending from dissolve start to finish,
with the center of the 'X' corresponding with the center of the dissolve."*

**Field sizes, with a genuine and unresolvable discrepancy.** Steinberg (features,
Academy): 16-field artwork = 16″ × 11.52″, ratio 1:0.72; closest approach is a
3-field (3″ × 2.16″); 12- and 24-field charts also exist. Mike S. Fowler,
*Animation Background Layout* (2002), excerpted on
[AWN](https://www.awn.com/animationworld/animation-layout-graticule-field-guide-and-labeling):
the graticule *"has a ratio aspect of 1:3/4"* (4:3 TV), with 12, 16 and 32 field
maxima; *"The outer line shows the field size while the inner line shows the
television cut off."* **1:0.72 vs 1:0.75 is a real format split, not an error.**

Hanna-Barbera's rule for the two lines: *"Artists should ALWAYS compose their
layouts to the cut-off dimensions"* but draw artwork out to the academy line.
Their pans are quantised: *"in the case of repeat pans, the length should always be
A to G, or five fields."* And a practical one: *"It is a good idea NOT to put the
sun, moon, or lettering in repeat pan backgrounds."*

**Arrow conventions on a panel** (live-action-derived, now universal):

- Pan / tilt: an arrow inside the frame in the direction of the move — horizontal
  for a pan, vertical for a tilt
  ([Storyliner](https://www.storyliner.online/learn/storyboard-symbols)).
- Push-in: *"arrows in all four corners of the panel pointing inward,"* optionally
  with *"an inner 16:9 rectangle with dotted lines connecting to corner arrows
  showing start/end positions."* Pull-back: four corner arrows pointing outward —
  and it *"always requires two panels since starting close position is hard to show
  with ending wide shot,"* labelled 1A / 1B
  ([Beyond The Process](https://www.beyondtheprocess.art/p/push-pull-zoom-how-i-indicate-camera)).
- Zooms use the same arrows as dollies **but must be labelled as zoom**, because
  the arrow cannot distinguish them. A dolly zoom needs opposing arrows plus the
  words.
- Wavy line under an arrow = handheld; dashed arrows = eyelines; CUT / DISSOLVE /
  FADE / WIPE / MATCH CUT written between panels.

Who converts the board's move into numbers (Whitaker/Halas/Sito p. 134): the
director sketches it on exposure sheets, then *"a scene planner… writes down the
field sizes and marks the frames where camera movements start and stop in the
'camera instructions' column… They also provide a drawn field key with field
centers marked."* Plus the physical inversion again: *"the track is made from field
X to field Y so the screen center moves towards the south-east. This means that
under the camera, the table must move north-west."* And: *"Tracks and table moves
are usually animated on single frames."*

---

## 6. The dead end that matters: nobody has written this for interfaces

We searched hard for a practitioner treating UI motion as a key-poses-first,
board-graded discipline. **There isn't one.** What exists is uniformly a parameter
model: duration tokens, easing curves, spring constants. Reporting this plainly
because it is the reason the hero-beat storyboard has to borrow from film.

**What the UI-motion canon actually contains:**

- **IBM Carbon** — read from the
  [source `.mdx`](https://raw.githubusercontent.com/carbon-design-system/carbon-website/main/src/pages/elements/motion/overview.mdx).
  Two modes (*productive*, *expressive*), six easing curves, six duration tokens
  (fast-01 70ms, fast-02 110ms, moderate-01 150ms, moderate-02 240ms, slow-01
  400ms, slow-02 700ms). **The words "storyboard" and "key pose" appear nowhere in
  the document.**
- **Val Head**, [Animation in Design Systems](https://www.smashingmagazine.com/2019/02/animation-design-system/)
  (Smashing, 21 Feb 2019) — motion principles + implementation; custom curves over
  CSS defaults; duration ranges by animation type. No storyboard language.
- **Caleb Barclay**, [5 steps for systematizing motion design](https://www.designsystems.com/5-steps-for-including-motion-design-in-your-system/)
  (designsystems.com, Figma's publication) — a t1–t5 timing scale, 2–3 bezier
  curves, buttons 100–200ms, page transitions 500–700ms, *"2-5 objects animation =
  300-400MS,"* *"100MS for every 10% movement of viewport."* Documentation
  recommended as Gantt-style diagrams or text specs, *"because text is easily
  editable and these data points can more easily be translated into production
  code."* That clause is the ideology in one line: **motion documented as data for
  code, not as drawings for judgement.**
- **Emil Kowalski**, [7 Practical Animation Tips](https://emilkowal.ski/ui/7-practical-animation-tips)
  — entirely parameter and heuristic: *"Easing… is the most important part of any
  animation"*; ease-out for entrances and exits; *"UI animations should generally
  stay under 300ms"*; *"a 180ms select animation feels more responsive than a 400ms
  one"*; `scale(0.97)` on `:active`; never animate from `scale(0)`, start at 0.9+;
  `transform-origin` *"default value is center, which is wrong in most cases"*; 2px
  of blur to mask imperfections. His
  [Developing Taste](https://emilkowal.ski/ui/developing-taste) prescribes *surround
  yourself with great work / think about why you like something / practice* — **no
  sketching, no boarding, no frame-by-frame study.** Nothing in his article index
  is about planning motion before building it.
- **Rachel Nabors**, *Animation at Work* (A Book Apart, 2017) — chapters: Human
  Perception and Animation / Patterns and Purpose / Anatomy of a Web Animation /
  Communicating Animation / Best Practices and Other Educated Guesses.
  "Storyboard" does not appear on the publisher's page.
- **Rauno Freiberg**, [rauno.me/craft](https://rauno.me/craft) — ~60 craft entries
  (Toolbar Morph, Blur Reveal, Theme Motion, Designing Depth, …). No duration /
  easing / spring / storyboard / key-pose vocabulary in the index; the artifacts
  are built demos, not planning documents.
- **Josh Puckett** — [DialKit](https://joshpuckett.me/dialkit) is explicitly
  parameter tuning: *"Add DialKit controls for: the entrance spring
  (visualDuration and bounce), overlay opacity, content border radius, and a
  'replay' action button."* Third-party descriptions of his
  [Interface Craft](https://www.interfacecraft.dev/) course mention *"entrance/exit
  choreography, spring physics, and animation sequencing using a **stage-driven
  approach**"* — "stages" is the nearest thing to a key-poses framing we found
  anywhere in UI motion, **but the site is a paywalled marketing page and we could
  not read the curriculum to confirm what "stage-driven" means.** This is the one
  lead worth chasing with access.

**The one genuine partial positive.** Google Books' term index for **Val Head,
*Designing Interface Animation* (Rosenfeld Media, 2016)** does list
**"storyboard"** as a term occurring in the book, and its Part III is *"Animation
in your work and process"* (p. 153). So Head very likely does treat UI
storyboarding somewhere in that part. **We could not read the passage** —
Rosenfeld returned 403 and the Google Books API rate-limited every attempt. This is
the highest-value gap in this research: if anyone has written UI-motion
storyboarding seriously, it is most likely Val Head, Part III.

**What the searches returned instead:** combinations of "storyboard" with "UI
motion", "interface animation", "key poses", "design engineer", "plan key frames
before building" produced almost entirely SEO/AI-generated listicles applying the
12 principles to UX at slogan level, plus LLM prompt-template pages. None is a
practitioner working the discipline; several are machine-written. **This is a real,
well-supported gap, not a search failure.**

---

## 7. Dead ends and unverified claims

Recorded so nobody re-walks them, and so nothing above is trusted further than it
deserves.

1. **Nancy Beiman's prose on beat boards vs storyboards.** The open Archive.org OCR
   truncated around ch. 4, so chapters 10–14 (thumbnails, staging, pacing) were
   unreachable; lending copies 403 on search-inside; ScienceDirect and Taylor &
   Francis both 403. We have her thumbnailing rules and her section headings
   (*"Beat Board to Storyboard. How Many Panels in a Story Beat?"*, ch. 11; *"All
   Thumbs: Quick Sketches and Thumbnails"*, ch. 10) but **not her definition of a
   beat board.**
2. **Beiman's chapter list is OCR-derived and uncross-checked** — every publisher
   TOC page 403'd.
3. **Mark Simon, *Storyboards: Motion in Art*** — no body text obtained. One
   search-snippet quote from a chapter abstract only.
4. **Sergio Paez, *Professional Storyboarding: Rules of Thumb*** — Archive.org copy
   is print-disabled. Cited secondhand via Wikipedia.
5. **John Canemaker, *Paper Dreams: The Art & Artists of Disney Storyboards*
   (Hyperion, 1999)** — the single most on-topic book for §2's history, and **no
   accessible text anywhere.** If the Disney story-department history is ever needed
   properly sourced, this book has to be obtained physically.
6. **Pixar in a Box / Khan Academy** storyboarding and "Storyreels" lessons — fully
   JS-rendered, every fetch returned a shell. This is where named Pixar story
   artists speak on camera, so it is a real loss.
7. **Author of "Designing a Pixar Film"** — unattributed in the document itself.
   Cite as *Pixar Animation Studios*.
8. **Material Design and Apple HIG motion guidance** — both fully JS-rendered;
   fetches returned page titles only, and `web.archive.org` is blocked to the fetch
   tool, so snapshots were unavailable. **We have no direct quote for Material's or
   Apple's motion vocabulary.** IBM Carbon and the designsystems.com article carry
   §6's argument instead.
9. **Val Head's storyboard passage** — identified as existing, not read.
10. **Richard Williams's ones/twos chapter body ("The Great Ones and Twos
    Battle")** — the OCR truncates before it, the 36MB PDF exceeds the fetch
    ceiling, and the search-inside API 403'd. We have the surrounding chapters
    verbatim; the ones/twos argument itself only via a single unattributed
    secondary quotation (*"broad, fast actions on twos 'sparkle' and adding ones
    diminishes that vitality"*) — **do not cite that as Williams.**
11. **A frame count for a head turn.** No authoritative number exists in anything
    we read. Whitaker/Halas/Sito have none; Pilar Newton's tutorial explicitly
    declines to give one; BAM Animation gives method only. **The count is
    context-dependent and unstandardised.** What *is* citable: three extremes plus
    an off-centre breakdown, an overshoot/cushion at the end, and Alexander
    Williams's *"always add a blink on a head turn"* — on the reasoning that a
    blink acts as an edit, *"filtering out transitional information."*
12. **"2–3 frames anticipation / 1 overshoot / 4–6 settle"** — a tidy set, but it
    comes from a university blog
    ([UDIT](https://www.udit.es/en/timing-y-spacing-en-animacion-que-es-y-como-mejora-la-sensacion-de-peso/)),
    not a canonical text. Rule of thumb, not doctrine.
13. **A count of story-reel versions per Pixar film.** No source. Catmull gives
    Braintrust cadence (*"every few months or so"*, *Creativity, Inc.*), not a
    version count; multiplying cadence by duration would be inference. Verified
    numbers to use instead: *WALL-E* ≈125,000 board drawings; a typical Pixar film
    50,000–75,000 boards (Boords, citing Pixar); ~100 sketches per minute of film
    (Whitaker/Halas/Sito).
14. ***The Illusion of Life* on storyboarding** — "Webb Smith", "story sketch",
    "storyboard", "story man", "Leica reel", "story reel" all returned NOT FOUND in
    the accessible portion of the OCR. Almost certainly tool truncation rather than
    absence, but **do not cite that book for the Webb Smith story on our
    authority.**
15. **Brian McEntee** was on our list of storyboard practitioners to check. He is
    a **layout artist, art director, colour stylist and production designer**
    (production designer on *The Brave Little Toaster*, *Beauty and the Beast*,
    *Cats Don't Dance*, *Ice Age*), not primarily a story artist. His
    [Animation Guild oral history](https://animationguild.org/oral_history/brian-mcentee/)
    yielded nothing on boarding or staging. If he belongs anywhere it is a
    layout/staging section.
16. **"Keys and Breakdowns" is not a chapter** in *The Animator's Survival Kit* —
    see §1 for the real chapter list.
17. **Beat-board definition** — the practitioner gloss we found is Griz & Norm's
    Tuesday Tip ([tumblr](https://www.tumblr.com/grizandnorm/82384291973/)): *"Beat
    boards are not even the first step to creating a story, but it's often the
    clearest way to pitch an early concept"* and *"useful to plan out the larger
    beats of a large physical sequence."* The page itself did not confirm the
    authors' names or studio — verify before attributing.
18. **Field-chart aspect ratio** is genuinely inconsistent across sources (1:0.72
    Academy features vs 1:3/4 TV). Not resolvable to one number.
19. **Search infrastructure was degraded throughout.** WebSearch quota was
    exhausted at the outset of both research passes, so discovery ran through
    search-engine HTML endpoints; DuckDuckGo CAPTCHA'd mid-session, Mojeek / searx /
    Ecosia / Startpage 403'd, Bing RSS silently ignores quoted phrases, Google Books
    API 429'd throughout, AWN 403s direct fetches. Book quotations are **OCR-verbatim
    from Archive.org derivatives**, read through a summarising fetch tool; only
    strings that came back identically across independent extractions are presented
    as quotes, and single-pass extractions are flagged inline. The sweep in §6 is
    therefore thinner than we would like — though its finding was consistent across
    every route we did have.

---

## 8. What we took into the hero-beat storyboard

| From | Applied as |
|---|---|
| Williams — a key is *"the storytelling drawing"* | K1–K7 are named by what they tell, not by what phase they belong to |
| Whitaker/Halas/Sito — *"A held drawing… works when framed and hung on the wall"* | the admission test for a key shot |
| Williams — *"if the breakdown is wrong, all the inbetweens will be wrong"* | breakdowns specified separately from the keys, and never at the midpoint |
| Disney — *"Work in silhouette so that everything can be seen clearly"* | the legibility gate; and the finding that the current beat's silhouette carries no information at the handoff |
| Continuity editing — the jump cut | why a value step between two identical framings reads as damage rather than as a transformation |
| Dolly vs zoom — parallax is the payload | why a slow push on a single object in an empty frame communicates nothing |
| Whitaker/Halas/Sito — the director's shorthand (hold = line, action = curve, anticipation = loop, must-happen = cross) | the notation of the exposure sheet in §7 of the storyboard |
| Slugging — stopwatch the untimed board, then re-cut to budget | how the storyboard's timing plan was arrived at, and why it is allowed to be re-cut |
| Pixar — *"the cost of exploration is low"* in planning | the argument for boarding this beat before building it again |
| The §6 gap | why the method is borrowed from film rather than from the UI-motion literature |
