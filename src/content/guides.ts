/**
 * Original study guides for the public site (/guides). Plain data so they render as fast, crawlable server pages.
 * Written to be practical and college-agnostic: nothing here depends on one university's rules.
 */
export type GuideSection = { heading: string; paragraphs?: string[]; bullets?: string[]; steps?: string[] };
export type Guide = {
  slug: string; title: string; description: string; category: "Study skills" | "Exams" | "Study groups" | "Using EduSathi";
  published: string; updated: string; readMinutes: number; intro: string; sections: GuideSection[]; takeaway: string; related: string[];
};

export const GUIDES: Guide[] = [
  {
    slug: "semester-exam-study-plan",
    title: "A 4-week study plan for semester exams",
    description: "A realistic four-week revision plan: map the syllabus, schedule short daily sessions, practise with past papers and keep the last week calm.",
    category: "Exams", published: "2026-10-20", updated: "2026-10-20", readMinutes: 6,
    intro: "Most students do not fail exams because they are not smart. They run out of time because they start revising everything at once, a few days before the paper. A plan that starts four weeks out turns a huge pile of work into small daily steps you can actually finish.",
    sections: [
      { heading: "Week 0: map the syllabus before you study anything", paragraphs: [
        "Open your syllabus and list every subject, then every unit inside it. Next to each unit write one of three words: strong, shaky or untouched. This takes twenty minutes and it is the most valuable twenty minutes of the whole plan, because it tells you where your hours should go.",
        "Check the exam timetable and count the days between papers. A subject with a long gap after it can be revised later; a subject that comes first needs attention first."] },
      { heading: "Week 1: cover the untouched units", bullets: [
        "Start with units marked untouched, then shaky. Leave strong units for later.",
        "Study in blocks of 45 to 50 minutes with a 10 minute break. Phone in another room during the block.",
        "Aim for two or three subjects a day, not six. Switching too often wastes the first ten minutes of every session.",
        "At the end of each session write three sentences from memory about what you just studied. If you cannot, the session was not finished."] },
      { heading: "Week 2: turn notes into questions", paragraphs: [
        "Reading notes again feels productive but teaches you very little. This week, convert every unit into questions: definitions, differences, steps of a process, short derivations or short programs, depending on your subject. Answer them without looking, then check.",
        "Keep a single page per subject called the weak list. Every question you get wrong goes on it, with the correct answer written in your own words."] },
      { heading: "Week 3: past papers under real conditions", steps: [
        "Collect three to five past question papers for each subject from your classmates or your group.",
        "Do one paper per subject with a timer and no notes. Use the real time limit.",
        "Mark it honestly. For every lost mark, write down why: did not know it, forgot it, misread the question or ran out of time.",
        "Spend the rest of the week fixing the reasons that cost the most marks. Time management and misreading are usually easier to fix than missing knowledge."] },
      { heading: "Week 4: revise, rest, repeat", paragraphs: [
        "Your only jobs now are the weak list and one last paper per subject. Do not start new topics in the final three days; it raises anxiety and rarely gains marks.",
        "Sleep matters more than another late night. Memory is consolidated while you sleep, so an extra hour of sleep before a paper is worth more than an extra hour of panicked reading."] },
      { heading: "If you are already behind", paragraphs: [
        "Compress the plan instead of abandoning it: spend the first days on the units that carry the most marks, finish one past paper per subject as early as possible, and use the weak list to decide what to revise. A smaller plan that you follow beats a perfect plan you drop on day two."] },
    ],
    takeaway: "Map the syllabus, study in short focused blocks, turn notes into questions, practise with past papers under real conditions and protect your sleep.",
    related: ["active-recall-spaced-repetition", "use-past-papers-well"],
  },
  {
    slug: "how-to-take-good-notes",
    title: "How to take notes you will actually use",
    description: "Practical note-taking for lectures and textbooks: what to write, how to structure a page, and how to turn notes into revision material.",
    category: "Study skills", published: "2026-10-20", updated: "2026-10-20", readMinutes: 5,
    intro: "Good notes are not a copy of what the teacher said. They are a tool you will use later, under time pressure, to remember and to answer questions. That changes what you should write down.",
    sections: [
      { heading: "Write ideas, not sentences", paragraphs: [
        "If you try to write everything, you stop listening, and the notes you get are long, messy and hard to revise. Listen for the idea, then write it in your own short words. Keep exact wording only for definitions, formulas and code that must be precise."] },
      { heading: "A simple page structure", bullets: [
        "Date, subject and unit at the top, so pages can be sorted later.",
        "A narrow column on the left for keywords and questions, a wide column on the right for the notes themselves.",
        "A short summary at the bottom of the page, written after class: two or three sentences in your own words.",
        "Leave space. Crowded pages cannot be corrected or extended."] },
      { heading: "Mark what you do not understand", paragraphs: [
        "Put a question mark next to anything that is unclear instead of pretending to follow. After class, ask a classmate, your group or the teacher. Unclear points that stay unclear grow into whole missing chapters by exam time."] },
      { heading: "Review within 24 hours", steps: [
        "Re-read the page the same evening and fix anything that no longer makes sense.",
        "Underline the five most important points.",
        "In the left column write the questions each part answers: What is it? Why does it matter? How does it work? When does it fail?",
        "Cover the right column and try to answer the questions from memory."] },
      { heading: "Adapt your notes to the subject", bullets: [
        "Programming and technical subjects: write the idea, then a tiny example you can run or trace by hand. Keep a short list of mistakes that produced errors, because the same ones come back.",
        "Theory and definition-heavy subjects: use headings that match the questions examiners ask (definition, types, advantages, limitations) so each page doubles as an answer outline.",
        "Maths and numericals: copy the problem, write each step with a few words of reasoning, and mark the step where you got stuck. Re-solve those problems a week later without looking.",
        "Reading and case-based subjects: record the argument in one sentence per paragraph, then add your own question or disagreement in the margin."] },
      { heading: "A five-minute weekly review", paragraphs: [
        "Once a week, flip through the week's pages and do three things: strike out anything you now realise was wrong, add the missing example to the page that needed it, and write the top three questions you could be asked on each subject. This small habit keeps notes alive instead of letting them pile up unread until the exam week."] },
      { heading: "Notes from textbooks and slides", paragraphs: [
        "Do not highlight whole paragraphs. Read a section, close the book, and write what you remember. Then open the book and add what you missed. This is slower than highlighting and far more effective, because retrieving information is what builds memory.",
        "For slides, write down only the reasoning the teacher adds out loud. The slide text is already available; the explanation is what you will not find later."] },
      { heading: "Sharing notes with classmates", paragraphs: [
        "Comparing notes after class exposes gaps quickly: someone caught the example you missed. Share your own notes, credit the author when you use someone else's, and never share copyrighted books or papers you do not have the right to share."] },
    ],
    takeaway: "Capture ideas in your own words, mark what you do not understand, and turn every page into questions within a day.",
    related: ["active-recall-spaced-repetition", "share-notes-responsibly"],
  },
  {
    slug: "study-group-that-works",
    title: "How to run a study group that actually works",
    description: "Seven rules for a study group that helps everyone learn: size, goals, roles, schedule, shared files and how to handle members who do not contribute.",
    category: "Study groups", published: "2026-10-20", updated: "2026-10-20", readMinutes: 6,
    intro: "A good study group multiplies what each person can learn. A bad one is a chat full of memes and the same two people doing all the work. The difference is almost always structure, not talent.",
    sections: [
      { heading: "1. Keep it small and focused", paragraphs: [
        "Four to eight active people is the sweet spot for a working group. If your class is bigger, create one group for announcements and file sharing and several small groups for studying together."] },
      { heading: "2. Give the group one clear goal", paragraphs: [
        "Write it in the description: for example, share Unit 1 to 5 notes for Data Structures and prepare for the midterm. A clear goal makes it obvious what belongs in the group and what does not."] },
      { heading: "3. Split the work", bullets: [
        "Rotate who summarises each lecture or unit, so notes appear every week without one person burning out.",
        "Assign one person to collect past papers and one to keep the list of important questions.",
        "Name a moderator who can hide spam and keep discussions on topic."] },
      { heading: "4. Fix a schedule", paragraphs: [
        "Choose a weekly time for a call or in-person session and keep it, even if only half the group comes. Put exam dates and assignment deadlines where everyone can see them so nobody has to ask."] },
      { heading: "A sample 90-minute session", steps: [
        "Five minutes: everyone says what they want to get out of today and which topic is the weakest for them.",
        "Twenty minutes: one person teaches a topic without notes while the rest ask questions.",
        "Thirty minutes: solve two past-paper questions individually, in silence, then compare answers and marking.",
        "Twenty minutes: swap and mark each other's answers; write down every gap in understanding.",
        "Ten minutes: split the gaps among members as homework, and agree what to share before the next meeting."] },
      { heading: "5. Teach each other", paragraphs: [
        "The best way to find out whether you understand something is to explain it. In each session ask one person to explain a topic in five minutes with no notes, then let others ask questions. Gaps appear immediately and everyone learns from the correction."] },
      { heading: "6. Keep files organised", paragraphs: [
        "Name files clearly (subject, unit, type) and use categories such as lecture notes, assignments and past papers. A library nobody can search is a library nobody uses."] },
      { heading: "7. Deal with free riders early and kindly", paragraphs: [
        "If someone never contributes, send a private message first: ask whether they are stuck and offer a small task. If nothing changes after a couple of weeks, the owner can remove inactive members. Be clear and polite; the goal is a group that works, not a punishment."] },
      { heading: "Online or in person?", paragraphs: [
        "In-person sessions are good for working through problems on a whiteboard and for accountability; online sessions are easier to schedule and to record. Many groups do both: a weekly in-person or call session for teaching and problem solving, and the group chat for quick questions in between. Whatever you choose, keep a written record of what was covered so that someone who missed a session can catch up in ten minutes."] },
      { heading: "When the group grows too big", paragraphs: [
        "If more than a dozen people are active, discussions become noisy and quiet members stop contributing. Split by purpose rather than by name: one group for announcements and files, and smaller groups of four to six for each subject or exam preparation. Appoint a moderator in each group so that spam and off-topic posts are handled quickly."] },
    ],
    takeaway: "Small group, clear goal, shared responsibilities, a fixed schedule and a habit of teaching each other.",
    related: ["getting-started-edusathi", "share-notes-responsibly"],
  },
  {
    slug: "use-past-papers-well",
    title: "How to use past question papers without just memorising answers",
    description: "Past papers are the best revision tool when you use them to find patterns and weak spots, not to guess the next exam. A step-by-step method.",
    category: "Exams", published: "2026-10-20", updated: "2026-10-20", readMinutes: 5,
    intro: "Past papers show you how questions are asked, which topics carry marks and how much you can write in the time. Used well they are powerful. Used badly, as a list of answers to memorise, they leave you lost the moment a question is worded differently.",
    sections: [
      { heading: "Step 1: study the pattern first", paragraphs: [
        "Before answering anything, lay out several papers side by side. Note how many questions there are, how marks are split between short and long answers, and which units appear every year. This tells you what to prioritise without pretending to predict specific questions."] },
      { heading: "Step 2: attempt a paper under exam conditions", bullets: [
        "Set a timer for the real exam length.",
        "Use only what you are allowed to use in the exam.",
        "Answer in full sentences or full code, not in notes to yourself.",
        "If you get stuck, write down what you do know and move on."] },
      { heading: "Step 3: mark it like a strict examiner", paragraphs: [
        "Compare with a model answer or a classmate's answer and mark yourself honestly. For every lost mark note the reason: knowledge gap, memory slip, misread question, poor time management. Count the reasons. Most students discover that a handful of repeated mistakes cost most of their marks."] },
      { heading: "Step 4: rewrite weak answers from memory", paragraphs: [
        "A day later, close the paper and write the answers you got wrong again, from memory. Then check. Repeating this on the same topics turns weak areas into strong ones faster than reading more material."] },
      { heading: "How many papers is enough?", paragraphs: [
        "Quality matters more than quantity. Three to five papers per subject, each fully attempted and carefully marked, teach far more than ten papers skimmed. If you only have limited time, do fewer papers but spend as long reviewing each one as you spent writing it."] },
      { heading: "Example: one question, three study tasks", paragraphs: [
        "Suppose a past paper asks you to explain the difference between two data structures with an example. First, answer it from memory as if in the exam. Second, find the part of your notes that covers each structure and fix any gap in your answer. Third, invent one variation of the question yourself (for instance, ask for a situation where the other structure would be a better choice) and answer that too. One question has now become three useful tasks, and you are prepared for a differently worded version."] },
      { heading: "Practical, theory and numerical subjects", bullets: [
        "Practical subjects: re-do the lab tasks from scratch without looking at your old code or procedure; time yourself.",
        "Theory subjects: practise writing structured answers (definition, explanation, example) in the time allowed per mark.",
        "Numerical subjects: redo the same problem types until the method is automatic, and check units and final answers every time."] },
      { heading: "What not to do", bullets: [
        "Do not assume a question will repeat. Examiners change wording and sometimes the whole topic.",
        "Do not skip units that are missing from recent papers; they may simply be due.",
        "Do not memorise an answer without understanding it. Understanding lets you adapt it to a new question.",
        "Do not share papers that you do not have the right to share, and credit whoever prepared answer keys."] },
    ],
    takeaway: "Use past papers to learn the pattern, test yourself under real conditions and fix the mistakes that repeat, not to hunt for exact questions.",
    related: ["semester-exam-study-plan", "active-recall-spaced-repetition"],
  },
  {
    slug: "share-notes-responsibly",
    title: "Sharing notes responsibly: copyright, credit and privacy",
    description: "What students can and cannot share: your own notes, other people's work, textbooks, personal information and graded assignments.",
    category: "Using EduSathi", published: "2026-10-20", updated: "2026-10-20", readMinutes: 5,
    intro: "Sharing notes makes everyone stronger, but a few simple habits keep it fair and safe for you, your classmates and the authors of the material you share.",
    sections: [
      { heading: "Share your own work freely", paragraphs: [
        "Notes you wrote yourself, summaries in your own words and practice questions you created are yours to share. Make them useful: clear titles, the subject and unit, and a short description of what the file covers."] },
      { heading: "Be careful with other people's work", bullets: [
        "Textbooks, published guides and paid courses are protected by copyright. Do not upload full copies unless the author or publisher allows it.",
        "A teacher's slides or handouts may be shared only if your teacher allows it. If you are not sure, ask.",
        "When you build on a classmate's notes, say whose they are. Credit is free and it encourages people to keep sharing."] },
      { heading: "Keep personal information out of files", paragraphs: [
        "Remove phone numbers, email addresses, citizenship or ID details, student numbers and photos of people from anything you upload. Screenshots of group chats often contain names and numbers: crop them."] },
      { heading: "Do not publish graded or personal work", paragraphs: [
        "Homework, assignments and lab reports that you submit for marks belong to your own learning and to your college's integrity rules. Share them inside a trusted group for discussion if your teacher allows it, but do not make them public. EduSathi does not allow these categories to be published publicly."] },
      { heading: "A quick checklist before you upload", bullets: [
        "Is it your own work, or do you have permission to share it?",
        "Does the title say what it is, including subject and unit?",
        "Have you removed phone numbers, email addresses, ID details and faces?",
        "Is it free of answers from an upcoming assessment that your teacher asked you to keep private?",
        "Would you be comfortable if the original author saw it shared this way?"] },
      { heading: "What happens when you publish on EduSathi", paragraphs: [
        "Files you upload start private to your group. If you want a note to help others, you can ask for it to be published. It stays private until a reviewer checks it and approves it; only certain categories such as lecture notes, previous papers and revision notes are eligible. If someone reports a published note, it can be hidden or removed, and the uploader can always withdraw it and make it private again."] },
      { heading: "Giving credit in practice", paragraphs: [
        "At the top of your document add one line such as: Notes by your name, based on lectures by the teacher's name, with examples from the textbook title. If you improved a classmate's notes, say so. Credit costs nothing, tells readers where the material comes from, and makes it easy for them to look for the original."] },
      { heading: "Report problems", paragraphs: [
        "If you find something that should not be shared, such as someone's personal data or copyrighted material, use the report option. Quick reports protect both the person affected and the community."] },
    ],
    takeaway: "Share what is yours, credit what is not, protect personal details, keep graded work private and report anything that does not belong.",
    related: ["study-group-that-works", "how-to-take-good-notes"],
  },
  {
    slug: "viva-and-presentation-prep",
    title: "Preparing for a viva or class presentation",
    description: "A calm checklist for oral exams and presentations: structure your answer, rehearse out loud, handle questions you cannot answer and manage nerves.",
    category: "Exams", published: "2026-10-20", updated: "2026-10-20", readMinutes: 5,
    intro: "Speaking is a different skill from writing. You can know a topic well and still freeze when someone is looking at you. Practising out loud, with a simple structure, solves most of the problem.",
    sections: [
      { heading: "Structure every answer the same way", steps: [
        "Answer the question in one sentence first.",
        "Give the reason or the key idea.",
        "Add one example.",
        "Stop. Silence after a complete answer is fine."] },
      { heading: "Rehearse out loud, not in your head", paragraphs: [
        "Thinking an answer and saying it are very different. Stand up and explain each major topic to a wall, a friend or your group. Record yourself once and listen: you will hear filler words and unclear steps immediately."] },
      { heading: "Prepare for the questions you fear", bullets: [
        "List the three questions you hope nobody asks. Then prepare those first.",
        "Ask a classmate to interrupt with why and what if. Examiners do exactly that.",
        "For projects, be ready to explain every design choice and every limitation."] },
      { heading: "A three-day preparation timeline", steps: [
        "Three days before: write a one-page summary of the whole project or topic, then list every term you would have to define.",
        "Two days before: rehearse out loud twice with a friend who interrupts, and fix the answers that took more than a minute.",
        "The day before: do one full run with a timer, check files and equipment, and stop studying early so you can sleep.",
        "On the day: arrive early, re-read only your one-page summary, and take a slow breath before you start."] },
      { heading: "Questions worth practising", bullets: [
        "Explain this in simple words, as if to a first-year student.",
        "Why did you choose this approach instead of the alternatives?",
        "What are the limitations, and what would you do with more time?",
        "How did you test that it works, and what went wrong along the way?",
        "What is the most difficult part, and how did you handle it?"] },
      { heading: "When you do not know the answer", paragraphs: [
        "Say so briefly, then show your reasoning: this is what I do know, and this is how I would find out. Honest, structured thinking earns more respect than a confident guess that is wrong. Never invent a fact."] },
      { heading: "Presentations", bullets: [
        "One idea per slide, large text, no paragraphs.",
        "Know your first sentence and your last sentence by heart.",
        "Keep to time: cut content instead of speaking faster.",
        "Test your files and equipment before the session."] },
      { heading: "After the session: learn from it", paragraphs: [
        "Within an hour, write down the questions you were asked and how you answered them, even if you think you did badly. Note one thing that went well and one thing to change. Share the questions with classmates who have not yet had their turn; that is exactly the kind of help a study group is for, and it makes your own next presentation easier."] },
      { heading: "Managing nerves", paragraphs: [
        "A little nervousness is normal and even helps focus. Slow your breathing before you begin, speak a little slower than feels natural and look at one friendly face at a time. Nervous energy fades after the first minute."] },
    ],
    takeaway: "Answer in a fixed structure, rehearse aloud, prepare for the hard questions and be honest when you do not know.",
    related: ["semester-exam-study-plan", "study-group-that-works"],
  },
  {
    slug: "active-recall-spaced-repetition",
    title: "Active recall and spaced repetition: study less, remember more",
    description: "Two evidence-backed study techniques explained simply, with a practical weekly routine you can start today.",
    category: "Study skills", published: "2026-10-20", updated: "2026-10-20", readMinutes: 6,
    intro: "Rereading and highlighting feel like studying, but research on learning keeps showing that they are weak ways to remember. Two techniques consistently work better: testing yourself, and spreading practice over time.",
    sections: [
      { heading: "Active recall: test yourself instead of rereading", paragraphs: [
        "Active recall means retrieving information from memory instead of looking at it. Each time you pull an answer out of your head, even imperfectly, the memory becomes easier to retrieve next time. Rereading only recognises information; it does not train you to produce it, and producing it is what the exam demands."] },
      { heading: "How to practise recall", bullets: [
        "Close the book and write everything you remember about a topic, then check what you missed.",
        "Turn headings into questions and answer them aloud.",
        "Make flashcards for definitions, formulas and differences, with the question on one side and a short answer on the other.",
        "Solve problems before looking at worked examples."] },
      { heading: "Spaced repetition: review just before you forget", paragraphs: [
        "Forgetting is fast at first and then slows down. If you review something just as it is fading, the memory lasts much longer than if you review it again and again in one sitting. Spreading the same study time over several days beats cramming it into one."] },
      { heading: "A simple spacing routine", steps: [
        "Day 0: study the topic and write your own questions.",
        "Day 1: answer the questions from memory.",
        "Day 3 or 4: answer them again; keep only the ones you missed.",
        "Day 7: another quick test.",
        "Day 14 and then monthly until the exam: short reviews of the hard cards."] },
      { heading: "Examples for different subjects", bullets: [
        "Programming: close the editor's reference, then write the function or query from scratch from a plain-language description. Compare with the solution afterwards and note what you forgot.",
        "Theory: cover the answer side of your notes, read only the question heading and answer aloud in full sentences, then check.",
        "Maths and numericals: keep one card per problem type with the problem on the front and the method on the back, and re-solve instead of just reading the method.",
        "Languages and terminology: pair each term with a one-line meaning in your own words and a short example sentence."] },
      { heading: "When you are short on time", paragraphs: [
        "Even a few minutes of recall helps. If an exam is close, skip making beautiful cards and do this instead: pick the topics you rated shaky, write down everything you can recall about each in five minutes, then fix the gaps. Repeat the next day. Two short rounds on shaky topics beat one long reading session on everything."] },
      { heading: "Make it fit a student week", paragraphs: [
        "You do not need an app. A box of paper cards sorted into today, this week and later works well. The important part is the habit: ten minutes of recall at the start of each study session before you open new material."] },
      { heading: "Common mistakes", bullets: [
        "Making cards but never testing yourself with them.",
        "Writing cards that are too long. One idea per card.",
        "Marking an answer as correct because it looked familiar. Say or write the answer first, then check.",
        "Stopping after the first success. Repetition over days is the point."] },
    ],
    takeaway: "Test yourself instead of rereading, and spread the practice over days. Ten focused minutes of recall beat an hour of passive reading.",
    related: ["semester-exam-study-plan", "how-to-take-good-notes"],
  },
  {
    slug: "getting-started-edusathi",
    title: "Getting started on EduSathi in 10 minutes",
    description: "A quick tour for new students: set up your profile, find or create a study group, share notes safely, add deadlines and use chat and search.",
    category: "Using EduSathi", published: "2026-10-20", updated: "2026-10-20", readMinutes: 4,
    intro: "EduSathi is a free place for students in Nepal to study together. This quick tour gets you from sign-up to a working study group in about ten minutes.",
    sections: [
      { heading: "1. Create your account and profile", paragraphs: [
        "Sign up with your email and choose any display name you are comfortable with; your email is never shown to others. In your profile pick your college, course and semester so the site can suggest groups that match you."] },
      { heading: "2. Find a group or start one", bullets: [
        "Open Find groups and search by name, college or semester. Public groups let you join instantly or send a request.",
        "Cannot find yours? Create a group in a minute: name it, add a short description, and optionally link it to your college, course and semester.",
        "Choose public if you want classmates to discover it, or private for invitation-only with a link or QR code."] },
      { heading: "3. Share files privately", paragraphs: [
        "Upload PDFs to your group under categories such as lecture notes, assignments and past papers. Only group members can read them. If you want to help the wider community, you can ask for a note to be published publicly; a reviewer approves it first."] },
      { heading: "4. Talk and ask questions", paragraphs: [
        "Use the group chat for quick conversation, discussions for questions and answers that should be searchable later, and the questions tab to collect practice and previous-exam questions for each subject."] },
      { heading: "Tips if you own a group", bullets: [
        "Write a clear description: who the group is for, which semester or subject, and what members should share.",
        "Appoint one or two moderators early so requests are approved quickly and spam is handled.",
        "Create an invitation link or QR code from the Manage tab, set an expiry and a use limit, and print the QR for your class.",
        "Add the next exam and assignment deadlines to the calendar so everyone gets reminders."] },
      { heading: "Tips if you are joining a group", bullets: [
        "Read the group description and introduce yourself in the chat.",
        "Share something useful early: even one clean set of notes makes you a valued member.",
        "Use categories and subject tags when uploading so files can be found later.",
        "Use Save on public notes you want to come back to; they appear in your Saved notes list."] },
      { heading: "5. Keep deadlines in one place", paragraphs: [
        "Group moderators can add exams, assignment deadlines and classes to the group calendar. Members see upcoming dates on their dashboard and receive a reminder the day before."] },
      { heading: "If something does not look right", bullets: [
        "Cannot find your college, program or subject? Tell us through Content Reporting and choose Other; administrators add them.",
        "Not receiving emails? Check your spam folder first, and make sure you typed your address correctly when you signed up.",
        "Cannot see a group's files? Files are visible to members only, so request to join or ask the owner for an invitation link."] },
      { heading: "6. Keep it safe", paragraphs: [
        "Only share material you have the right to share, keep personal information out of files and use the report button when something does not belong. Read our guide on sharing notes responsibly for details."] },
    ],
    takeaway: "Set your profile, join or create a group, share notes safely and use the calendar and chat to stay organised.",
    related: ["study-group-that-works", "share-notes-responsibly"],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
