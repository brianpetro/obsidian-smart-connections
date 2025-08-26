# Common Workflows with Smart Connections

> **Real-world examples of using Smart Connections with Claude Code CLI for various tasks**

## Table of Contents

1. [Research Workflow](#research-workflow)
2. [Writing Workflow](#writing-workflow)
3. [Development Workflow](#development-workflow)
4. [Daily Notes Workflow](#daily-notes-workflow)
5. [Learning Workflow](#learning-workflow)
6. [Project Management Workflow](#project-management-workflow)

## Research Workflow

### Academic Research with Smart Connections

#### Setup
```markdown
Vault Structure:
📁 Research/
  📁 Papers/
    📄 Smith2023-ML-Survey.md
    📄 Jones2024-Neural-Networks.md
  📁 Notes/
    📄 Research-Questions.md
    📄 Methodology.md
  📁 Sources/
    📄 Bibliography.md
```

#### Workflow Example

**Step 1: Import Research Papers**
```markdown
# In Smart Chat:
User: I've added Smith2023-ML-Survey.pdf to my vault. Can you help me extract key findings?

# Smart Connections automatically:
1. Finds the PDF in your vault
2. Extracts text content
3. Creates embeddings for semantic search

Claude (with context from PDF): Based on Smith2023-ML-Survey, here are the key findings:
1. Transfer learning reduces training time by 60%
2. Attention mechanisms improve accuracy by 15%
3. Data augmentation is crucial for small datasets
...
```

**Step 2: Find Related Research**
```markdown
# Smart Connections Panel shows:
Related to current note (Smith2023-ML-Survey):
- Jones2024-Neural-Networks (0.89 similarity)
- Research-Questions (0.76 similarity)
- Methodology (0.72 similarity)

# In Smart Chat:
User: How does Jones2024 build on Smith2023's findings?

Claude (with context from both papers): Jones2024 extends Smith2023's work by:
- Implementing the suggested attention mechanisms
- Testing on larger datasets (10x size)
- Achieving the predicted 15% improvement
```

**Step 3: Synthesize Findings**
```markdown
User: Create a literature review summary combining all papers in [[Papers/]]

Claude (with folder context): # Literature Review Summary

## Transfer Learning (Smith2023, Jones2024)
Transfer learning has emerged as a dominant paradigm...

## Attention Mechanisms (Jones2024, Brown2023)
Following Smith2023's predictions, attention mechanisms...

## Data Augmentation Strategies
Multiple studies confirm that data augmentation...
```

### Real Research Session Example

```markdown
# Morning Research Session
09:00 - Open daily note
09:05 - Smart Chat: "What research questions am I currently exploring?"
        Claude: Based on your Research-Questions.md, you're investigating:
        1. Impact of model size on performance
        2. Trade-offs between accuracy and efficiency
        3. Generalization across domains

09:10 - Add new paper to vault
09:15 - Smart Chat: "Summarize the methodology section of the new paper"
09:20 - Connections panel shows 5 related papers
09:25 - Smart Chat: "How does this methodology compare to my planned approach in [[Methodology]]?"
09:30 - Update methodology based on insights

# Actual Chat Transcript:
User: Find all papers that mention "transformer architecture"

Claude: Searching your vault for papers mentioning "transformer architecture"...

Found 7 papers with relevant content:
1. **Smith2023-ML-Survey.md** - Discusses transformer evolution
2. **Jones2024-Neural-Networks.md** - Implements custom transformer
3. **Brown2023-Attention.md** - Compares transformer variants
...

Would you like me to summarize the transformer-related findings from these papers?
```

## Writing Workflow

### Blog Post Creation with AI Assistance

#### Initial Brainstorming
```markdown
User: I want to write about productivity systems. What topics have I covered before?

Claude (searching vault): Based on your vault, you've written about:
1. **GTD-Implementation.md** - Getting Things Done system
2. **Zettelkasten-Method.md** - Note-taking for knowledge work
3. **Time-Blocking.md** - Calendar-based productivity

Gaps in your coverage:
- Pomodoro Technique
- Energy management vs time management
- Digital minimalism approaches
```

#### Content Development
```markdown
User: Help me outline a post about energy management based on my notes

Claude: Based on your notes in [[Productivity/]] and [[Daily Notes/]], here's an outline:

# Energy Management > Time Management

## Introduction
- Your note from 2024-01-15: "Had 8 hours but got nothing done"
- Thesis: Managing energy yields better results than managing time

## Your Energy Patterns (from your daily notes analysis)
- Peak hours: 9-11 AM (mentioned 47 times)
- Low energy: 2-4 PM (mentioned 38 times)
- Second wind: 7-9 PM (mentioned 22 times)

## Strategies You've Found Effective
1. **Cognitive Load Matching** (from Workflow-Optimization.md)
   - High energy → Deep work
   - Medium energy → Communication
   - Low energy → Administrative tasks

## Case Studies from Your Experience
- Project Alpha success (aligned with energy)
- Project Beta failure (ignored energy patterns)
```

#### Writing Enhancement
```markdown
User: Make this paragraph more engaging: "Energy management is important for productivity."

Claude (with your writing style context): Based on your previous posts, here's a revision in your style:

"Picture this: It's 2 PM, you have four hours left in your workday, and your to-do list is mocking you. You're not out of time—you're out of energy. This is why the productivity gurus have it backwards. Time management is so 2010. Energy management? That's where the real gains hide."

(This matches your conversational tone from Recent-Posts/ folder)
```

### Actual Writing Session

```markdown
# 10:00 AM - Start writing session
User: What was my main point in yesterday's draft?

Claude: In yesterday's draft (Draft-Energy-Management.md), your main point was:
"Productivity isn't about squeezing more into your day—it's about aligning your hardest work with your highest energy."

You supported this with three examples:
1. Your morning coding sessions (3x more productive)
2. Afternoon email clearing (natural low-energy fit)
3. Evening creative writing (unexpected second wind)

# 10:15 AM - Continuing from yesterday
User: Suggest a transition from the examples to the methodology section

Claude: Based on your writing style, here's a transition:

"These aren't random patterns—they're predictable rhythms we can leverage. After tracking my energy for 90 days (data in [[Energy-Tracking-Log]]), I discovered a simple framework that anyone can implement..."

# 10:30 AM - Fact checking
User: Did I write about ultradian rhythms before?

Claude: Yes, you mentioned ultradian rhythms in:
1. **Sleep-Optimization.md** (2024-03-15): "90-minute cycles throughout the day"
2. **Focus-Sessions.md** (2024-04-22): "Work in 90-minute blocks, then break"

You could reference this: "As I noted in my sleep optimization experiments..."
```

## Development Workflow

### Coding with Vault Context

#### Project Setup
```markdown
Vault Structure:
📁 Development/
  📁 Projects/
    📁 SmartConnectionsEnhancement/
      📄 requirements.md
      📄 architecture.md
      📄 implementation-notes.md
  📁 CodeSnippets/
    📄 javascript-patterns.md
    📄 obsidian-api-examples.md
```

#### Development Session Example

```markdown
# Starting a new feature
User: I need to implement a context menu for Smart Connections. Check my previous implementation notes.

Claude: From your vault, I found relevant implementation patterns:

From **implementation-notes.md**:
- You previously implemented a context menu in Project-Alpha
- Used Obsidian's registerEvent for right-click handling

From **obsidian-api-examples.md**:
```javascript
this.registerEvent(
  this.app.workspace.on('editor-menu', (menu, editor, view) => {
    menu.addItem((item) => {
      item
        .setTitle('Find connections')
        .setIcon('search')
        .onClick(() => this.findConnections(editor));
    });
  })
);
```

From **javascript-patterns.md**:
- You prefer async/await over promises
- You use early returns for validation

Here's a implementation matching your style:

```javascript
async registerContextMenu() {
  // Early return pattern from your notes
  if (!this.app.workspace) return;
  
  this.registerEvent(
    this.app.workspace.on('file-menu', async (menu, file) => {
      // Your preferred null checking style
      if (!file || file.extension !== 'md') return;
      
      menu.addItem((item) => {
        item
          .setTitle('Find Smart Connections')
          .setIcon('links-coming-in')
          .onClick(async () => {
            // Your async pattern
            await this.showConnections(file);
          });
      });
    })
  );
}
```
```

#### Debugging Session

```markdown
User: I'm getting an error "Cannot read property 'smart_sources' of undefined". Where else have I seen this?

Claude: I found similar issues in your notes:

From **debugging-log.md** (2024-08-20):
"Same error occurred when SmartEnv wasn't fully initialized"
Solution: Added await this.env.init() check

From **implementation-notes.md**:
"Race condition with smart_sources loading"
Fix: 
```javascript
// Your previous solution
if (!this.env?.smart_sources) {
  await this.waitForEnv();
}
```

From **architecture.md**:
"Smart sources loads asynchronously after plugin init"

Recommended fix based on your patterns:
```javascript
async ensureSmartSources() {
  // Your defensive coding style
  while (!this.env?.smart_sources?.ready) {
    await sleep(100); // Your utility function
  }
  return this.env.smart_sources;
}
```
```

## Daily Notes Workflow

### Morning Review with Smart Connections

```markdown
# Daily Note: 2024-08-26

## Morning Review (09:00)

User: What did I work on yesterday and what's pending?

Claude: Based on yesterday's daily note (2024-08-25) and your task lists:

**Yesterday's Progress:**
- ✅ Completed Smart Chat refactoring (mentioned in 3 notes)
- ✅ Fixed embedding generation bug (#issue-142)
- 🔄 Started documentation update (50% per your note)

**Pending from yesterday:**
- [ ] Review PR #456 (marked high priority)
- [ ] Update test suite for new features
- [ ] Client meeting prep (scheduled for today 2 PM)

**Related notes from this week:**
- Monday: Planned Smart Chat refactoring ✅
- Tuesday: Bug investigation (#issue-142) ✅
- Wednesday: Started documentation
- Thursday: Client requirements gathering

**Suggested focus for today** (based on your patterns):
Morning (high energy): Complete documentation
Afternoon (post-meeting): PR review
Evening: Test suite updates
```

### Evening Reflection

```markdown
## Evening Reflection (17:30)

User: Analyze my productivity patterns this week

Claude: Analyzing your daily notes from this week:

**Productivity Patterns:**

**Most Productive Hours:**
- 9-11 AM: Completed 80% of deep work tasks
- 7-9 PM: Secondary productive window (3 mentions)

**Task Completion Rate:**
- Monday: 6/8 tasks (75%)
- Tuesday: 8/8 tasks (100%) 
- Wednesday: 5/9 tasks (55%)
- Thursday: 7/7 tasks (100%)
- Today: 6/7 tasks (86%)

**Recurring Themes:**
1. "Interrupted by meetings" (4 mentions)
2. "Morning focus excellent" (5 mentions)
3. "Afternoon slump" (3 mentions)

**Insights from your notes:**
- Best days had <3 meetings
- Task completion higher when you started with hardest task
- Friday documentation tasks often pushed to next week

**Recommendation based on patterns:**
Block Fridays for creative/documentation work - your energy is consistently lower for deep technical work on Fridays.
```

## Learning Workflow

### Studying New Topics with Smart Connections

```markdown
# Learning Rust Programming

User: I'm learning Rust. What concepts from other languages in my notes might help?

Claude: Based on your programming notes, here are relevant connections:

**From C++ Notes** (cpp-memory-management.md):
- RAII pattern → Directly applies to Rust's ownership
- Smart pointers → Rust's Box<T>, Rc<T>, Arc<T>
- Move semantics → Rust's move by default behavior

**From JavaScript Notes** (js-async-patterns.md):
- Promises → Similar to Rust's Future trait
- Error handling patterns → Rust's Result<T, E> type

**From Functional Programming** (fp-concepts.md):
- Immutability by default → Rust's let vs let mut
- Pattern matching → Rust's match expressions
- Option types → Rust's Option<T>

**Your Learning Pattern** (from previous language learning):
1. You learn best with practical projects (Python, JS notes)
2. You create comparison tables (see go-vs-python.md)
3. You document gotchas (javascript-wtf.md)

Suggested approach for Rust:
1. Create rust-ownership-examples.md
2. Build comparison table with C++ memory management
3. Start "Rust WTF moments" note
```

### Concept Reinforcement

```markdown
User: Quiz me on Rust concepts using my notes

Claude: Based on your Rust notes, here's a quiz:

**Question 1:** In your note "rust-ownership.md", you wrote about the three rules. Can you name them?

*Your note has:*
1. Each value has a single owner
2. When owner goes out of scope, value is dropped
3. [What's the third rule?]

**Question 2:** You compared Rust's Result<T, E> to what concept in your Go notes?

*Hint from your comparison table: Go uses multiple return values for errors*

**Question 3:** In "rust-borrowing.md", you noted a tricky case with mutable references. What was it?

*Your example involved a Vec and iteration*

[After answers]

Claude: Checking against your notes:
✅ Correct: Only one mutable reference at a time
❌ Missed: Go's error handling is actually more verbose (per your note)
✅ Correct: Can't modify Vec while iterating (your exact example)
```

## Project Management Workflow

### Sprint Planning with Context

```markdown
User: Help me plan next sprint based on my project notes

Claude: Analyzing your project folder (Projects/AppDevelopment/):

**Current Sprint Review (from sprint-3-retro.md):**
- Velocity: 34 points (target was 40)
- Blockers: API documentation incomplete
- Success: Authentication module shipped

**Backlog Analysis (from product-backlog.md):**
High Priority Items:
1. User Dashboard (13 points) - Dependencies met ✅
2. API Integration (21 points) - Blocked by docs ⚠️
3. Search Feature (8 points) - Design complete ✅
4. Performance Optimization (5 points) - Can parallelize ✅

**Team Capacity (from team-notes.md):**
- Alice: Available full sprint (13 points historical avg)
- Bob: 3 days PTO (8 points adjusted)
- You: Full capacity (13 points historical avg)
Total: ~34 points

**Recommended Sprint 4:**
```
Sprint Goal: Launch User Dashboard with Search

Committed:
- User Dashboard (13 pts) → Alice
- Search Feature (8 pts) → Bob  
- Performance Optimization (5 pts) → You
- API Documentation (8 pts) → You

Total: 34 points (matching velocity)

Stretch: 
- API Integration (if docs completed early)
```

**Risk Mitigation (from your risk-log.md):**
- API docs dependency: Schedule for days 1-2
- Alice hasn't worked on dashboard: Pair day 1
```

### Daily Standup Automation

```markdown
# Morning Standup Prep

User: Generate my standup update from yesterday's notes

Claude: Based on your notes from 2024-08-25:

**YESTERDAY:**
- ✅ Completed user authentication refactoring (PR #234)
- ✅ Reviewed Alice's dashboard wireframes 
- 🔄 Started API documentation (3 of 8 endpoints documented)
- Investigation: Found root cause of performance issue (note: performance-debugging.md)

**TODAY:**
- Complete remaining 5 API endpoints documentation
- Pair with Alice on dashboard implementation kickoff
- Deploy auth changes to staging (after PR approval)

**BLOCKERS:**
- Waiting for Bob's review on PR #234 (pinged yesterday 4 PM)
- Need clarification on rate limiting requirements (per api-questions.md)

**PARKING LOT:**
- Performance fix can improve response time by 40% (discuss post-standup?)
```

## Tips for Effective Workflows

### 1. Structure Your Vault for Smart Connections

```markdown
Good Structure:
📁 Projects/
  📁 ProjectName/
    📄 README.md
    📄 requirements.md
    📄 daily-log.md
    📄 decisions.md

Why it works:
- Folder references [[Projects/ProjectName/]] include all context
- Related files have high semantic similarity
- Clear hierarchy for targeted searches
```

### 2. Use Consistent Naming

```markdown
Examples:
- Daily Notes: 2024-08-26.md
- Meetings: meeting-2024-08-26-client.md
- Projects: project-smartconnections-enhancement.md

Benefits:
- Easier to reference in chat
- Better chronological context
- Improved semantic matching
```

### 3. Leverage Metadata

```markdown
---
tags: [project, active, high-priority]
project: SmartConnections
status: in-progress
created: 2024-08-26
---

User: Show me all active high-priority projects

Claude: Based on frontmatter metadata, you have 3 active high-priority projects:
1. SmartConnections Enhancement (started 2024-08-20)
2. Client Dashboard (deadline 2024-09-01)
3. Performance Optimization (critical flag set)
```

### 4. Create Connection Hubs

```markdown
# Machine Learning Hub

## Core Concepts
- [[ML-Fundamentals]]
- [[Neural-Networks]]
- [[Deep-Learning]]

## Projects
- [[Project-ImageClassifier]]
- [[Project-TextGeneration]]

## Resources
- [[Papers/]]
- [[Courses/]]

This becomes a central node with high connectivity, improving context retrieval.
```

---

[← Back to Documentation](../README.md) | [← Installation Walkthrough](./installation-walkthrough.md) | [Configuration Examples →](./configuration-examples.md)