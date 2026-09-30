# Complaint ledger, part 1: Claude Code transcripts, 07-04 to 09-25

Source: `scratchpad/corpus/1-claude-transcripts.md`, 2,543 lines, 353 `###` headers, read end to end. Last timestamp reached: `2026-09-25T01:30 [free-stroke]`, the final message in the file.

What counts: only what Sebs typed. Skipped: the "This session is being continued" compaction summaries (they quote him, but the quotes are assistant text), his two pasted hero-direction outlines (07-12, 07-13), pasted assistant replies, and the Vercel error dump. Where his own words sit inside a pasted block (07-16, 07-29, 08-23) only his tail is quoted. The `[T]` headers are ruling-extractor prompts; the USER lines inside them are his, but they reached this file through a machine prompt, so they carry `(maybe pasted)`.

Several corpus messages are cut mid-line (`…[cut]`) by the corpus builder. Nothing past a cut was read, because it is not in the file.

The `thread` column groups the same complaint across dates. `repeat` gives the date of the previous entry in this part on the same thread.

Thread codes:

| code | the complaint |
|---|---|
| STOP | the agent stopped, went idle, or was not working |
| DONE | the agent called it done or perfect when it was not |
| SKILL | skills, research or storyboarding not used |
| CREATURE | Frankendoodle creature: weak, no rig, no joints, seizures, boring |
| GENERIC | the look is generic, ugly, AI slop, or a copy of another project |
| PANEL | Frankendoodle panels in the wrong place, controls missing |
| MESSY | spacing and layout messy, buttons unclear |
| DRAWIN | the 2D draw-in does not draw like a hand drawing |
| CAMERA | camera angles random, abrupt, no easing |
| FUSION | fusions do not apply, do not animate, not every combo |
| EXTRUDE | Rock-3D 3D is only an extrude |
| WHITE | white spots and erased patches in the strokes |
| FILES | files moved, duplicates, disk, stray browsers |
| PORTRAIT | portrait pipeline not fixed |
| ASK | asking or confirming instead of doing |
| MISREAD | misread what he said, lost him, did not look first |
| CONSUMER | built outside the one Rock-3D place |
| SHADE | shading does not do what the engine does |
| NIB | line width too uniform, not like the glyphs |
| HEADLESS | checked headless instead of looking |
| (none) | one-off |

## LOOK

| date | cwd | quote | about | thread | repeat |
|---|---|---|---|---|---|
| 07-05 14:17 | rotatable-v4 | Bro wtf is this this is exactly what I said. It to it juts extrudes the outline of the object this what tha issues we had when where using 3d at first | rotatable only extrudes the outline | EXTRUDE | |
| 07-05 17:17 | rotatable-v4 | No it’s not it’s teh extrude with just liens on two edges stffu up wee just doing teh same thing with a different thing slightly changed | same extrude, slightly changed | EXTRUDE | 07-05 14:17 |
| 07-05 17:24 | rotatable-v4 | It’s is a better extrude but still hot garbage no where near what I wnat | better extrude, still garbage | EXTRUDE | 07-05 17:17 |
| 07-05 19:13 | desk-doodles | also lets scrap teh 3d fully rotable thing for rok 2d | scrap the Rock-3D rotatable | EXTRUDE | 07-05 17:24 |
| 07-05 19:41 | desk-doodles | none of teh glphs are filled an di feel like the lines we have on object an dporb icons are too uniforme in width and teh shapes to unifmrn u see the glphs have a mit of wirnedss to teh hspaes it has teh lines arent unfiormed in width either [Image #1] like u see onlt fiest of our obejt here kinda get right there a sligh wsmoth wobbliness to teh glipphs | object lines too uniform, no wobble | NIB | |
| 07-05 21:10 | desk-doodles | they arent really multp strokes the glphs soem times lines just converge and diverge and b1 is teh closests but not quite there | glyph lines converge, not multi-stroke | NIB | 07-05 19:41 |
| 07-05 22:40 | frankendoodle | our ui geniuly ugly please reasrhc and use skills what would best work as our visual languayev | Frankendoodle UI genuinely ugly | GENERIC | |
| 07-05 23:07 | frankendoodle | this doenst sound liek fun and it siund liek u just ripped desk ddoodels an dmy perkfio | concept ripped from portfolio | GENERIC | 07-05 22:40 |
| 07-05 23:16 | frankendoodle | okay we dont have colros is teh only thig and this feel sgenric like this like doenst feel like the 3 ones u siad | feels generic, no colours | GENERIC | 07-05 23:07 |
| 07-05 23:19 | frankendoodle | i ve seen every ai slop app doing fun make this use all posisbel ksills to craft whwetevr it ourvisulalanguage woll be | reads like AI slop | GENERIC | 07-05 23:16 |
| 07-05 23:24 | frankendoodle | shoudl still have that oh sebs deisgned but hsoudlnt be copying mt prilfio a]langaue im designer i cna deisgn in mnay dfifren styles etc | copying portfolio language | GENERIC | 07-05 23:19 |
| 07-05 23:31 | frankendoodle | yeah thsi read egenrix still | still reads generic | GENERIC | 07-05 23:24 |
| 07-05 23:40 | frankendoodle | i liek the idea but bro hideoiys i liked my orginal look of franken doodle its just wasnt pushed neuiuh an dwas generic bit the look was string | new direction hideous, original stronger | GENERIC | 07-05 23:31 |
| 07-05 23:42 | frankendoodle | like everthing u gave me is ugly in a poorly deisgned way the og had problems but was s tornger in that sense | everything ugly, poorly designed | GENERIC | 07-05 23:40 |
| 07-09 20:13 | frankendoodle | it looses too mcu h cjarecter still and the by thread needs its visual language through resarch and improved with fabe the by th read oen teh og still vsiually is weak | hybrid loses character, OG weak | GENERIC | 07-05 23:42 |
| 07-09 20:14 | frankendoodle | it looses too mcu h cjarecter still (same message sent twice) | resend of 20:13 | GENERIC | 07-09 20:13 |
| 07-16 18:42 | _engine-slab | [Image #5] thes eliterrally just textrude mor eplease do soemthing actually fun bro u  rbing lame run afable on yjis wtf | objects are just extrudes, lame | EXTRUDE | 07-05 19:13 |
| 07-16 22:46 | system | shipped nd cretve tech objext stil pretty wekka | creative-tech objects still weak | (none) | |
| 07-16 22:46 | system | like for the cretauve tech the obejxt are weka ti and stuff (maybe pasted: sits inside a pasted terminal dump) | creative-tech objects weak | (none) | 07-16 22:46 |
| 07-17 01:55 | portfolio-system-lab | [Image #10] I FEEL like we hsould somehin that not relaly extrude ike pake it felike its pape liek a dtera or simething on that front yk like so it lke cler iast a stcka of paper o rpost it noet sbe crtaiev ass hoel | wants paper, not an extrude | EXTRUDE | 07-16 18:42 |
| 07-29 17:57 | sebs | the R has this weird thing where it keeps the face flat and then weirdly pops in the sides. (maybe pasted: his words quoted inside a pasted prompt) | rotatable R face flat, sides pop | EXTRUDE | 07-17 01:55 |
| 08-01 04:36 | memory | [Image #38] okay and remmebr look thsi fucled f;at lileey casue ist hallow like soldi means it woud be white the one isue is how we handl eth strokes/outliens of rock 3d form stingthis dark | Rock-3D looks flat, hollow | (none) | |
| 08-08 17:18 | Projects | teh gemorty lighting still is off /broken | tape geometry lighting broken | (none) | |
| 08-08 17:18 | Projects | lil shadow line needs to be improce dtoo | tape shadow line weak | (none) | |
| 08-14 05:33 | portfolio | i wnat every part of he fukcing piplein teh svg the desk doodles the rock 3d perfetct i wnat that portat pileine perfercrt | portrait pipeline not good enough | PORTRAIT | |
| 08-14 22:03 | media | dhoww fe object that reallshow it follows shapes stuff we did a basdic rect here | demo on a basic rectangle | (none) | |
| 08-14 22:25 | media | A gutiar more bs rectangle shapes | guitar is more rectangles | (none) | 08-14 22:03 |
| 08-15 00:07 | media | i dont undertand he improvmeng on teh shaidng fro desk didoles th elines are thicker and lighter ? what exactly got impved, part of of our shading engien is using like cross hatching tehciniew with pec=ncil pressure and spacig to create shaidng like hwo did this imorve our shaidng system | shading "improvement" unclear, not hatching | SHADE | |
| 08-15 00:08 | media | like we have all difreent options for shading aroun thta prencipal of pencil pressure liek thickness and spaicng betwen lien s, thos dpenst even do any of that angle stuf tp give form u ai d | shading ignores pressure and angle | SHADE | 08-15 00:07 |
| 08-15 00:11 | media | [Image #49] lol these isnt even fixed its in th elastets 29 and the where we at on top shoudl show the edn reult form each of 3 pipleiens an dnon of the stuff about glasses nose ears ect was ever rsorlved and finer detaiels being lost | portrait details lost, never fixed | PORTRAIT | 08-14 05:33 |
| 08-28 22:07 | T | That gb icon is not what the logo is I told u to just use (maybe pasted: inside a ruling-extractor prompt, cut there) | GitHub icon is not the logo | (none) | |
| 09-06 18:27 | free-stroke | Fix this then I gross | something gross, subject not named | (none) | |
| 09-19 14:44 | portfolio | Right now it's just being styled just like how DeskDoodle is. We got to redo the whole DeskDoodle stuff here, the UI and stuff. This is a different design system. It's not DeskDoodle | Doodle page styled as Desk Doodles | GENERIC | 07-09 20:14 |

## MOTION

| date | cwd | quote | about | thread | repeat |
|---|---|---|---|---|---|
| 07-04 22:46 | frankendoodle | also the phises here eh like u made it seem liek it was gonna be ajcarcter that u can ntercat and do stuf with phisycs with | creature physics not a character | CREATURE | |
| 07-04 22:48 | frankendoodle | well i wnated osmtehing more then a rag doll like we can inetcat with and it intercat back with it | wants more than a rag doll | CREATURE | 07-04 22:46 |
| 07-04 23:01 | frankendoodle | /Users/sebs/Desktop/style/Screen\ Recording\ 2026-07-04\ at\ 6.59.18 PM.mov ist seizuringgg | creature seizures | CREATURE | 07-04 22:48 |
| 07-04 23:03 | frankendoodle | it hsould move around and dont let cofiend in its little thig let move aorund teh whole screen i said set it up on charteyer rihgh with limbs etc | confined to box, no limbs rig | CREATURE | 07-04 23:01 |
| 07-04 23:06 | frankendoodle | wtfff | reaction to the creature | CREATURE | 07-04 23:03 |
| 07-04 23:07 | frankendoodle | dont let just moce around in te box around te screen | still confined to box | CREATURE | 07-04 23:06 |
| 07-04 23:13 | frankendoodle | \`stilly spazzing out not doing anythig jst stands there | still spazzing, stands there | CREATURE | 07-04 23:07 |
| 07-04 23:14 | frankendoodle | it supposed to be ai level smart | creature not smart | CREATURE | 07-04 23:13 |
| 07-04 23:15 | frankendoodle | it shoudl have limbs and joinst liek a rela chatert rig dummmy | no limbs and joints | CREATURE | 07-04 23:14 |
| 07-05 21:48 | frankendoodle | aslo the charcter irggging the ai teh inetrcting with is still pretty weak | rig and AI still weak | CREATURE | 07-04 23:15 |
| 07-05 22:40 | frankendoodle | barley srtael we need a betetr startling systme | startle barely happens | CREATURE | 07-05 21:48 |
| 07-05 22:47 | frankendoodle | we and more well develop rig systemma dnveryhing the interacctions still arent clear just it beig in teh  corn we need liek expreeisve mayve expreesiev emoiton sound sidk we need to to high craft high plosh | interactions unclear, not expressive | CREATURE | 07-05 22:40 |
| 07-06 01:17 | frankendoodle | [Image #6] ay yo fuck u you need to make the actualy drawing imt a rig wtf o sthis shti we nned a betetr chaarcte rrigh a  nsmart layer ml systme to smartly figure out how to place joints limbs etc | drawing itself is not the rig | CREATURE | 07-05 22:47 |
| 07-06 01:23 | frankendoodle | like it get smorig afte 5 second palying with | boring after 5 seconds | CREATURE | 07-06 01:17 |
| 07-06 01:39 | frankendoodle | there no joints tho | no joints | CREATURE | 07-06 01:23 |
| 07-06 01:52 | frankendoodle | not really seeing joints | still no joints | CREATURE | 07-06 01:39 |
| 07-28 03:03 | frankendoodle | yeah it needs a notehr hatd pass the whole game, liek creatur eplaying par  super weak still like its more basic then tomachigic i wanted a  adbaved ai based sysetme tamchi thnng but liek 1000x more adnaved | creature play super weak | CREATURE | 07-06 01:52 |
| 07-31 21:22 | free-stroke | i also dont full geth janky can angels once it turn 3d | janky camera angles in 3D | CAMERA | |
| 07-31 21:25 | free-stroke | what the point of these cameer angels we get randomly | random camera angles | CAMERA | 07-31 21:22 |
| 08-01 14:55 | free-stroke | THE 2D AND 3D TRANFORMATION SI WAY TO SUBTLE LIKE IT HARD TO TELLL IT WENT FRO  2D TO 3D | 2D to 3D change too subtle | (none) | |
| 08-01 14:55 | free-stroke | ITS ALSO LAGGY AT MARTS | laggy in parts | (none) | |
| 08-01 14:55 | free-stroke | TEH CAMERA ANGLES CHNAGE ARE ADRUPT AND DONT HAVE ANY EASING AND STILL DONT MAKE REAL SEN LIKE I THINK U I UDNERATD N ITS TO SHOW THAT ITS 3D BUUT ITS GOD AWFUL AND I KEE O TELLIG U AND U KEEP LEAVING THAT PART AS IS [Image #2] LIKE IV TOLDU EVERY TIME THOS FUCK ASS CAMERA  MOVEMSNTS CHNAGE THNAG ANGELS ARE WDUFL I GET HE IDEA BUT ITS NOT WOKRING U NEED TO ACTUALLY THINK THROUGH HOW TO SHOW ITS 3D | camera cuts abrupt, no easing | CAMERA | 07-31 21:25 |
| 08-02 13:28 | free-stroke | non of wierd  camera nageks are fixed | camera angles still not fixed | CAMERA | 08-01 14:55 |
| 08-04 13:46 | free-stroke | few issues wihth fusion some dont animate | some fusions do not animate | FUSION | 08-03 17:24 |
| 08-04 19:56 | free-stroke | slow weather and turntabel dont aniamte | slow weather, turntable dead | FUSION | 08-04 13:46 |
| 08-08 17:18 | Projects | tape is  alot better but still to low resolution physidc , tactilness motion anaimtion etc needs to betetr | tape physics low resolution | (none) | |
| 09-25 01:17 | free-stroke | What the actual fuck, bro? The beat anime hero beat animations are still complete average, complete garbage. | hero beat animations garbage | (none) | |
| 09-25 01:17 | free-stroke | The letter-by-letter is complete garbage, bro. The way they turn is awful letter by letter, and the way they turn and then overlap into the next letter is so dog shit. | letter turns overlap badly | (none) | |

## UI

| date | cwd | quote | about | thread | repeat |
|---|---|---|---|---|---|
| 07-04 21:42 | frankendoodle | paanel shoudl be on the side  an di feel like teh drwing panell with controal on the side we have so muc w ite space ine acg | panels not on the side | PANEL | |
| 07-04 21:55 | frankendoodle | [Image #1] drawing control o the keft ssshole 3d will chnage the left panel and pro make it tak ethe full length of the screen like desk doodles does right also tehre a lot of teh drawing control misisng like teh auto detce stuff the shapes etc | controls missing, panel not full height | PANEL | 07-04 21:42 |
| 07-04 21:56 | app | snap is ising a lot | snap missing features | PANEL | 07-04 21:55 |
| 07-04 21:56 | app | bro u need to import ove rth full engine basiclaly | engine only partly imported | PANEL | 07-04 21:56 |
| 07-04 22:10 | frankendoodle | do it snao aslo has th shape stuf that try to detct what shaoed u tried to draw ashshole just fick import it all stop fucking aorund | shape detection missing | PANEL | 07-04 21:56 |
| 07-04 22:12 | frankendoodle | [Image #2] asshole i sad teh draw controols teh ones on top on the let stles on th eright u kieraly swtched where the styles panell isnd i though i said to take full view port lnegh for teh panles | panels swapped, not full height | PANEL | 07-04 22:10 |
| 07-04 22:28 | app | but thise toggles ranet what chnages in desk in doodldes its strippe ddon veriosn just the ful 3d | stripped-down 3D toggles | PANEL | 07-04 22:12 |
| 07-04 22:45 | frankendoodle | [Image #4] shoudl it be connect like how when you have to charcater rig, style pnael here shoul spper on th side n hve a 3d togle that bring it ot life shoudl either be somehing else or be removed | style panel not on side | PANEL | 07-04 22:28 |
| 07-04 23:01 | frankendoodle | there no code enter place to enetr a code for the room | no room-code field | (none) | |
| 07-05 21:48 | frankendoodle | teh 3d doesnt wokr righ it doesnt save the it as 3d and when i try to switch oly on eaprt the end it still switches the hwole thing | 3D not saved per piece | (none) | |
| 07-05 23:45 | frankendoodle | well hierahcy was and it had weird spacing issues an lyout issues that needs fixing | weird spacing and layout | MESSY | |
| 07-05 23:50 | frankendoodle | i had a bunch stuff from th eold tha need clenaing upliek the homepga had wieng issues with sapcing | homepage spacing | MESSY | 07-05 23:45 |
| 07-06 00:15 | frankendoodle | this looks teh same and stiill teh ame issue smessy everyjwet code and jion should be ,more clear whats   a button what text fiel | still messy, button vs field unclear | MESSY | 07-05 23:50 |
| 07-06 00:18 | frankendoodle | messy evertjhwer nothing cleaned uup | messy everywhere, nothing cleaned | MESSY | 07-06 00:15 |
| 07-06 00:49 | frankendoodle | [Image #5] ettf are these button this upher | buttons look wrong | MESSY | 07-06 00:18 |
| 07-06 00:51 | frankendoodle | no u fuck the fucking soaicng look ist not cneetr in teh buton stui=pid owthelss asshsole | button label not centred | MESSY | 07-06 00:49 |
| 07-09 19:01 | frankendoodle | i like teh clean simole style sty fo whe we have rn minus all teh poor deisgn layout stuff | poor layout on current style | MESSY | 07-06 00:51 |
| 08-01 05:01 | free-stroke | REMMMEBR TH EPILLS AND PROOF ISSUES REMMBER PROOFS AR ENOT PILLS MORE LIEK A BOX RE,,BER WHAT ISAID ABOUT PILLS ETC | proofs drawn as pills | (none) | |
| 08-01 14:55 | free-stroke | IK ITS NOT DONE CASUE FUSION DOESNT HAVE A WAY FR AUSER TO MAKE THEIRIR FUSINS | no way to make a fusion | FUSION | |
| 08-02 13:28 | free-stroke | ahre tf are the toggles i had for teh idfffent type of animations remmber i asked to come up with some of ur own as well | animation option toggles missing | (none) | |
| 08-03 17:21 | free-stroke | my fusion doesnt work and i aldo dont htink iy makes sesen or clrra  hwo to set i tup liike i can make a new custom fusion but nhting actually apples | custom fusion does not apply | FUSION | 08-01 14:55 |
| 08-03 17:24 | free-stroke | also its i htought fusions ment evrthing gets fused togtehr some fusion options only use some which igeuss its fine but tha means fusion shoudl be mor expanisve having evry psoissble ocmbos of stuff | not every fusion combo | FUSION | 08-03 17:21 |
| 08-04 13:46 | free-stroke | i asked to have at least one fusion for evry possible combo styles | still not every combo | FUSION | 08-03 17:24 |
| 08-04 19:56 | free-stroke | when i mean tehre shoudl be afuiosn for veru possible of combo there hsould be alot more like there 7 or styles and all with diffrent aniamtion stuff so like its a magitufe ofr number | combos should be 2^7 | FUSION | 08-04 13:46 |
| 08-08 01:38 | portfolio | i dont know hwere these are  mbtt-arm-straddle and mbtt-toys | cannot find named options | (none) | |
| 08-21 21:38 | portfolio-system-lab | Ehhh teh ion could move more right and down a little and it’s overlapping a scraps I said no overlapping we supposed have something in teh system so they can’t over lap even if I move them around | Ion overlaps a scrap | (none) | |

## WRITE-IN

| date | cwd | quote | about | thread | repeat |
|---|---|---|---|---|---|
| 07-31 21:22 | free-stroke | also teh drawing in naimtion is god awful fpr 2d we have such a beatiful ssytem that draws them in 3d in the free strek app like wtf teh hwoel reason im usuing the free stroke ap was for its drawing anaimtion of strakes like wtf | 2D draw-in god awful | DRAWIN | |
| 07-31 21:22 | free-stroke | a,d and alos if swicth engine to desk dddoles teh word just auto appears | Desk Doodles engine: word just appears | DRAWIN | 07-31 21:22 |
| 07-31 21:22 | free-stroke | th fucking drawig is fast aand janky | drawing fast and janky | DRAWIN | 07-31 21:22 |
| 07-31 21:25 | free-stroke | no tell me wtf is happing why do we have such a horriblie stroe drawing animtion | horrible stroke drawing | DRAWIN | 07-31 21:22 |
| 07-31 21:25 | free-stroke | wes till have a shit naiamtion tha is owrse then og | worse than the original | DRAWIN | 07-31 21:25 |
| 08-01 14:55 | free-stroke | [Image #1] WHEN TEH ENGIEN IS FRFEE STROKE TEH 2D DRAW IN IT STILL JAK IT SLIKE ITS USING A SONE STUPID SWEEAP RECEAL | 2D draw-in is a sweep reveal | DRAWIN | 07-31 21:25 |
| 08-02 13:28 | free-stroke | hey wtf why is animation stilll shit the 2d drawing naimtion still doenst sdraw like osme actually draiwng the strokes | still not drawing the strokes | DRAWIN | 08-01 14:55 |
| 08-02 20:19 | free-stroke | I CANT BEILEV YOU KEEP NOT FIXING MY BIGGEST ISSUE | biggest issue still unfixed | DRAWIN | 08-02 13:28 |
| 09-04 13:58 | free-stroke | What why didn’t fucking touch the fuckinf word | the word was never touched | DRAWIN | 08-02 20:19 |
| 09-25 01:17 | free-stroke | The lettering doesn't write in when you write them in, and they don't animate well. | lettering does not write in | DRAWIN | 09-04 13:58 |
| 09-25 01:17 | free-stroke | There's a weird fucking way the S is made, and it is fucking god-awful at the end. | S letterform awful at end | (none) | |

## ARTIFACT

| date | cwd | quote | about | thread | repeat |
|---|---|---|---|---|---|
| 08-02 21:01 | free-stroke | [Image #1] wtf | screenshot of the white spots | WHITE | |
| 08-02 21:04 | free-stroke | like there random hwit balnks spots teh 3d text i fully dtsrited worse wen u tyoe ur own text likess someone ran a eraser all over it | white blank spots, like an eraser | WHITE | 08-02 21:01 |
| 08-03 01:00 | free-stroke | [Image #2] HOW O STHIS NOT FIXED STILL | still not fixed (screenshot, subject likely the spots) | WHITE | 08-02 21:04 |
| 08-14 15:49 | portfolio-system-lab | [Image #40] one issue i see is the little like strokes thta re sll over the place u see what i mean we had tha same isue ages gao for svg stuff in teh desk ddoles u see wht i mean its its these poinst becomed lonagtd stroeks | points became elongated strokes | (none) | |
| 08-28 21:57 | free-stroke | Still see lots of artifacts looks at these white spots in teh strokes ashsole | white spots in the strokes | WHITE | 08-03 01:00 |
| 09-18 04:34 | portfolio | Oh, and there are still these weird letters next to the cursor, like weird broken letters, and it's never been fixed | broken letters beside cursor | (none) | |
| 09-25 01:17 | free-stroke | Literally, you can go back and mine my conversations, but shit still has these artifacting things, these white spots. | white spots still there | WHITE | 08-28 21:57 |

## PROCESS

| date | cwd | quote | about | thread | repeat |
|---|---|---|---|---|---|
| 07-05 18:47 | desk-doodles | so what happned to tat  hardeing pass on the icons and object and the builds for all teh new 6x6 and the whole thing of putting cetrgoies that should be decions decions | queued work silently dropped | (none) | |
| 07-05 18:59 | desk-doodles | whatevr happedn to teh page to page aniamtion the morphs tuff | morph work dropped | (none) | 07-05 18:47 |
| 07-05 19:04 | desk-doodles | what tf i sphase 11 | unexplained internal label | MISREAD | |
| 07-05 21:18 | desk-doodles | oh god bro u ar eat 96 percent fro the week u shoudknt have dne thta | burned weekly usage | (none) | |
| 07-05 21:52 | frankendoodle | well u ahav eto check desk ddogles odcs too | did not read Desk Doodles docs | MISREAD | 07-05 19:04 |
| 07-05 22:05 | frankendoodle | no not pivot finish this frist | pivoting before finishing | (none) | |
| 07-05 22:40 | frankendoodle | tehre wre more skills and what about teh oen i pasted | skills left unused | SKILL | |
| 07-05 23:19 | frankendoodle | taht teh issue sur not usng ksills and onlien resrahc | no skills, no research | SKILL | 07-05 22:40 |
| 07-05 23:23 | frankendoodle | we have mnay ksilll use the, | use the skills | SKILL | 07-05 23:19 |
| 07-05 23:25 | frankendoodle | keep bringing more kislls | bring more skills | SKILL | 07-05 23:23 |
| 07-05 23:31 | frankendoodle | doenst feel liek u used nay of teh skills skills arent god dont let them stop u form being funa dn eeicting | skills not visibly used | SKILL | 07-05 23:25 |
| 07-06 00:16 | desk-doodles | u made one big compit ? yo hit or broen into chucks? | one big commit | (none) | |
| 07-06 00:18 | frankendoodle | i have sme ksils coetjio u didnt run taht i made for like layout alsigment deisgn etc go look for those | his layout skills not run | SKILL | 07-05 23:31 |
| 07-06 00:56 | desk-doodles | bro teh main should be properlt updated | main not updated | (none) | |
| 07-06 01:07 | frankendoodle | what are these sticthes for what are u trting show m e | unclear what is being shown | MISREAD | 07-05 21:52 |
| 07-06 01:11 | frankendoodle | no i mena why are u showing the end screen with the sitches what am uspposed to give feedbakc on the screen is teh smae | shown unchanged screen for feedback | MISREAD | 07-06 01:07 |
| 07-10 10:00 | frankendoodle | i had u pick some skills for it remmber | forgot skills already picked | SKILL | 07-06 00:18 |
| 07-28 13:14 | frankendoodle | okay im up so are ugonna fix shit ? or just tell me | reports instead of fixing | (none) | |
| 07-29 05:19 | Canvas-Lab | SO WHAT ARE WE DOIN WITHTHIS (after a pasted assistant finding) | findings reported, nothing done | (none) | 07-28 13:14 |
| 07-29 17:57 | sebs | i also wnat all teh glphs ready for it too so spin a subg agent to get alll glohs rortable fuck u aslo for levaing me w a regressed gplph | left a regressed glyph | (none) | |
| 07-31 21:22 | free-stroke | wtf was all this rearch we did just for u to basiclaly make a slighly diffrnet veriosn | research wasted on small change | SKILL | 07-10 10:00 |
| 07-31 21:23 | free-stroke | oka then fucking make new lanes to start their owkr assshol | lanes not started | STOP | |
| 07-31 21:25 | free-stroke | like i had use sills storybiard part of ths was to create logic an dreasonn behidn evrthng | storyboard skill not applied | SKILL | 07-31 21:22 |
| 08-01 00:32 | free-stroke | why are u not worjing asshole dont come till everthing perfect no way th e aniation and fulll stroke app done | not working, app not done | STOP | 07-31 21:23 |
| 08-01 14:55 | free-stroke | U NEED TO ACTUALLY THINK THROUGH HOW TO SHOW ITS 3D | not thinking the 3D reveal through | (none) | |
| 08-01 14:55 | free-stroke | UR STILL NOT OODING STORUBAORD RIGHT CAUSET HESE CAMERA NAGELS OWULD BEEN CUT JUST FROM LOGIC ALONE | storyboard still not done right | SKILL | 07-31 21:25 |
| 08-01 14:55 | free-stroke | I ALSO DONT BEILVE THAT THE REST IF APP IS ODNE CHECK CHECK ECHEKC AND TEST ETST THERE NO WAY IST DONE | app claimed done, is not | DONE | |
| 08-01 20:50 | free-stroke | Bro wym perfect make people thrown money at it go line by line for teh cod | "perfect" claim rejected | DONE | 08-01 14:55 |
| 08-02 20:05 | free-stroke | u build unless i say no there no way the app and aniamtions are fully done | not fully done | DONE | 08-01 20:50 |
| 08-02 20:15 | free-stroke | WHAST LEFT FOR U I TOLD I DON TBEILEVWE ARE EVEN CLISE TO DONE | not close to done | DONE | 08-02 20:05 |
| 08-02 22:35 | free-stroke | Eat shit | insult, subject not named | STOP | 08-01 00:32 |
| 08-02 23:12 | free-stroke | U trying to play games little shit | stalling | STOP | 08-02 22:35 |
| 08-02 23:15 | free-stroke | Fuck you work | not working | STOP | 08-02 23:12 |
| 08-03 20:38 | free-stroke | So why are u not working | not working | STOP | 08-02 23:15 |
| 08-04 15:28 | free-stroke | did u start u fuck? | had not started | STOP | 08-03 20:38 |
| 08-04 20:03 | free-stroke | its been 3 hrs so far | slow | STOP | 08-04 15:28 |
| 08-08 01:38 | portfolio | tf ar eu talking baut cmaeras we have the browse cnavs that is canavs alreayd | misread canvas as cameras | MISREAD | 07-06 01:11 |
| 08-08 17:18 | Projects | no that trnacript was for free stroke dumbass | filed transcript to wrong project | MISREAD | 08-08 01:38 |
| 08-14 05:33 | portfolio | i fcking said i said baout teh fukcing portrait bro i cnat with you | ignored portrait ask | MISREAD | 08-08 17:18 |
| 08-14 23:51 | media | I thought I said keep improving teh scraps and the potroats did you use all the images . So we went done in scraps there was no way to get the other ones to pass ? | stopped before all scraps passed | STOP | 08-04 20:03 |
| 08-14 23:54 | media | lol u stupid asshole I said so all of them and teh unroofed . So why tf did u stop asshile all scraps need to pass fully lol fuck you wasted being idle while I ran | idle while he was out | STOP | 08-14 23:51 |
| 08-14 23:57 | media | Use all teh images u fuck the point was better training material fuck | not all portrait images used | PORTRAIT | 08-14 05:33 (LOOK) |
| 08-14 23:59 | media | And then you keep doing the ooop Thai time with all the images (maybe a voice typo) | repeats the same image mistake | PORTRAIT | 08-14 23:57 |
| 08-15 00:00 | media | You knew Thai tho you had been fine all day | knew the rule, broke it | PORTRAIT | 08-14 23:59 |
| 08-15 00:11 | media | lol these isnt even fixed | portrait claimed fixed | DONE | 08-02 20:15 |
| 08-23 01:30 | scrap-mining | liek thso folder then wer not mined propelry , also u misudnetand me | folders not mined, misread | MISREAD | 08-14 05:33 |
| 08-23 14:03 | desk-doodles | WTFFFFFFF ASSHOLE BUILT THE ICON IN TEH ROCK ED WHAT TF HOW OS THSI POSSIBEL I TELL U BNOT TO DO THIS EACH TIME HWO DOES THSI KEEP HPAPEING IDC WHAT U DO MAKE IT IMPSOSOBELF RO U TO EVR MAKEA SOCMUENR ND AGAIN BUKD IT RAW | built a consumer again | CONSUMER | |
| 08-23 21:53 | Canvas-Lab | im so lost (after a pasted assistant paragraph) | jargon report lost him | MISREAD | 08-23 01:30 |
| 08-28 12:39 | free-stroke | Asshole ur in auto mode keep running | stopped in auto mode | STOP | 08-14 23:54 |
| 08-28 15:57 | free-stroke | so dobt co eback till the nt doen list is fone | came back before done | STOP | 08-28 12:39 |
| 08-28 21:51 | free-stroke | Hold up I’m lost all you listed Soudns lien referring to the desk doodles side of it where we wer busing the animation stuff let’s get aligned for a sec | list unclear, lost | MISREAD | 08-23 21:53 |
| 08-28 22:07 | motion-2026-08-28 | Don’t eve just state always fix pleas | states instead of fixing | (none) | 07-29 05:19 |
| 08-29 00:07 | free-stroke | so what baout te ypart whre i looked at the dek doodles rto see what can be sueful for the catula app wiat so it wasnt in the app causi nevr saw naythigf | promised step never reached him | MISREAD | 08-28 21:51 |
| 08-29 00:21 | free-stroke | i was able to acess the desk dodoles ruafce what are usyaibg iliterray sent lics eraly er | agent claim contradicted | DONE | 08-15 00:11 |
| 08-29 00:22 | free-stroke | what were the gaps u nerver told me | gaps never reported | (none) | |
| 08-29 00:51 | free-stroke | go wokr asshole | not working | STOP | 08-28 15:57 |
| 09-04 12:48 | free-stroke | wtf why did u stop working | stopped | STOP | 08-29 00:51 |
| 09-04 14:03 | free-stroke | STOP FUXKKF ASKINF | asking instead of doing | ASK | |
| 09-04 14:50 | free-stroke | Answe me this are u done with all work did u confirm perfection if. Not why do u waste my time an dare stopped u dont comb back till perfect is confirmed in every possible way | stopped without confirming perfection | STOP | 09-04 12:48 |
| 09-04 15:27 | free-stroke | WHYYY DI DU STOP FUCK 3RD TIME ASSHOLEEEEEEEEEEEEEEEEEEEEEE | stopped a third time | STOP | 09-04 14:50 |
| 09-04 20:32 | portfolio | So no shading either like please look brother desk doodles to fully understand | did not read Desk Doodles shading | SHADE | 08-15 00:08 (LOOK) |
| 09-05 20:49 | free-stroke | Why are u stopped finish it | stopped | STOP | 09-04 15:27 |
| 09-05 21:07 | free-stroke | Are u done bitch boi | stopping | STOP | 09-05 20:49 |
| 09-11 17:18 | T | We have a doc for it we literally have a doodle nav item look ashsole (maybe pasted: inside a ruling-extractor prompt) | did not search the nav | MISREAD | 08-29 00:07 |
| 09-22 18:18 | T | sub agenst aashol (maybe pasted: inside a ruling-extractor prompt) | not using subagents | STOP | 09-05 21:07 |
| 09-22 18:18 | T | remmber i want perfecrion you really pissed me off last with enelss kangauges passes and not once did anything really get fixed (maybe pasted: inside a ruling-extractor prompt) | endless language passes, nothing fixed | DONE | 08-29 00:21 |

## HARNESS

| date | cwd | quote | about | thread | repeat |
|---|---|---|---|---|---|
| 07-28 16:30 | frankendoodle | did u check everthing direcly no headless stuff doenst alway make it accurate | headless checks inaccurate | HEADLESS | |
| 08-07 13:23 | free-stroke | Why are u spawning so makes chromes at once every few seconds | Chromes spawned every few seconds | (none) | |
| 08-07 13:32 | free-stroke | Okay so make sure it is enforced and run the agents this was never a issues until now | browser cap not enforced | (none) | 08-07 13:23 |

## FILES

| date | cwd | quote | about | thread | repeat |
|---|---|---|---|---|---|
| 08-07 13:27 | free-stroke | Jill it clean the mess | lane mess left on disk | FILES | |
| 08-08 23:17 | projects | Free stroke 2 is a duplicate remember | duplicate project folder | FILES | 08-07 13:27 |
| 09-07 14:03 | free-stroke | What why did we move it asshole | project moved off Desktop | FILES | 08-08 23:17 |
| 09-07 14:04 | free-stroke | Move it back just fix the sync issue asshole | move back, fix sync only | FILES | 09-07 14:03 |
| 09-07 14:12 | free-stroke | No move it all back | move it all back | FILES | 09-07 14:04 |
| 09-22 21:02 | free-stroke | Make sure we don't have any trees taking up disk space on our merge trees. Our harness is supposed to take care of making sure everything gets merged immediately and that we don't leave all things in memory taking up space | worktrees eating disk | FILES | 09-07 14:12 |

## OTHER

| date | cwd | quote | about | thread | repeat |
|---|---|---|---|---|---|
| 07-04 23:30 | frankendoodle | same issue | Vercel upload still aborts | (none) | |
| 07-05 21:48 | frankendoodle | hey so only i seem to be balt to get it to work on mine like when she satrt a session it nevr loads ehn  i joing | two-player room never loads | (none) | |
| 07-05 21:48 | frankendoodle | alos tehre seesm to be issues with svg port like it doens t wokr half teh time | SVG port fails half the time | (none) | |
| 08-14 15:51 | desk-doodles | [Image #41] all teh text needs to trimmed and simlifed as muchas  possibel you have way too much jargon and intrenal terms clean simoel and quck plese | too much jargon in text | (none) | |

## Praise and approval (kind: praise), the target

| date | cwd | quote | what he liked |
|---|---|---|---|
| 07-04 23:21 | frankendoodle | nvrm it sifn w | an issue resolved itself |
| 07-05 21:10 | desk-doodles | b1 is teh closests but not quite there | b1 closest to the glyph line |
| 07-05 23:11 | frankendoodle | i liek this stack asshole | the proposed stack |
| 07-05 23:40 | frankendoodle | i liek the idea but bro hideoiys i liked my orginal look of franken doodle its just wasnt pushed neuiuh an dwas generic bit the look was string | the idea, and his original look |
| 07-05 23:52 | frankendoodle | i like dthe frankenddole idea mixed wth that abc stakc | Frankendoodle idea plus the stack |
| 07-06 19:51 | frankendoodle | i would actually like a mix of 125 | options 1, 2 and 5 |
| 07-09 19:01 | frankendoodle | i like teh clean simole style sty fo whe we have rn | the current clean simple style |
| 07-09 20:13 | frankendoodle | cinepct is srtorng | the by-a-thread concept |
| 07-16 22:46 | system | liek teh lst one has pontteial like it could been teh en draiwng and then does coool morph thing whre the liens in drswing become code | last object: lines morph into code |
| 07-31 21:22 | free-stroke | we have such a beatiful ssytem that draws them in 3d in the free strek app | the original Free Stroke 3D draw-in |
| 08-01 14:55 | free-stroke | THE SPECILA DRAIWNG ANAIMTION IN DESK DDDOELS ITS A LOT BTTER | the Desk Doodles drawing animation |
| 08-08 01:38 | portfolio | [Image #13] i like where the taped titel is here tht would be my top chce | taped title placement |
| 08-08 17:18 | Projects | tape is  alot better | the tape |
| 08-15 00:09 | media | i mean its fine | the new shading pass, lukewarm |
| 08-29 00:23 | free-stroke | lookslike resaonabl e things to add at a galance | the gaps list |

The two Free Stroke praise lines point at the same target: the draw-in should look like the original Free Stroke 3D draw-in and the Desk Doodles drawing animation, not a sweep reveal.

## Top 10 most repeated complaints in this part

Counted by thread code, across all tables above.

| rank | thread | entries | first | last | one quote |
|---|---|---|---|---|---|
| 1 | STOP: agent stopped, idle or not working | 19 | 07-31 | 09-22 | "WHYYY DI DU STOP FUCK 3RD TIME ASSHOLEEEEEEEEEEEEEEEEEEEEEE" |
| 2 | CREATURE: Frankendoodle creature weak, no rig or joints | 17 | 07-04 | 07-28 | "it shoudl have limbs and joinst liek a rela chatert rig dummmy" |
| 3 | MISREAD: misread him, lost him, did not look first | 12 | 07-05 | 09-11 | "tf ar eu talking baut cmaeras we have the browse cnavs that is canavs alreayd" |
| 4 | GENERIC: generic, ugly, AI slop, copy of another project | 11 | 07-05 | 09-19 | "i ve seen every ai slop app doing fun" |
| 5 | DRAWIN: 2D draw-in does not draw like drawing | 10 | 07-31 | 09-25 | "the 2d drawing naimtion still doenst sdraw like osme actually draiwng the strokes" |
| 6 | SKILL: skills, research, storyboard not used | 10 | 07-05 | 08-01 | "taht teh issue sur not usng ksills and onlien resrahc" |
| 7 | PANEL: panels in wrong place, controls missing | 8 | 07-04 | 07-04 | "u kieraly swtched where the styles panell isnd i though i said to take full view port lnegh for teh panles" |
| 8 | DONE: called done or perfect when it was not | 7 | 08-01 | 09-22 | "THERE NO WAY IST DONE" |
| 9 | FUSION: fusions do not apply, animate, or cover every combo | 7 | 08-01 | 08-04 | "i can make a new custom fusion but nhting actually apples" |
| 10 | MESSY: spacing, layout, buttons | 7 | 07-05 | 07-09 | "the fucking soaicng look ist not cneetr in teh buton" |

Next after the ten: EXTRUDE 7 (07-05 to 07-29), FILES 6, WHITE 5 (08-02 to 09-25), PORTRAIT 5, CAMERA 4 (07-31 to 08-02).

Totals: 184 complaint entries (PROCESS 66, LOOK 33, MOTION 28, UI 26, WRITE-IN 11, ARTIFACT 7, FILES 6, OTHER 4, HARNESS 3) and 15 praise entries.

For the Free Stroke hero ask, the threads that never closed in this part are DRAWIN (first 07-31, still open 09-25), WHITE (first 08-02, still open 09-25) and the letter-turn complaint, which first appears here on 09-25. CAMERA stops after 08-02 in this source, which means he stopped raising it here. That is not evidence it was fixed.
