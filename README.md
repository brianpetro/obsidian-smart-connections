***Save time* linking, tagging, and organizing:** Smart Connections finds relevant notes *so you don't have to!*

<h2 align="center">
More time for what matters most<br>
<a href="https://smartconnections.app/?utm_source=README-what-matters-most" target="_external"><img src="/assets/SC-OP-more-time-for.gif" alt="More time for what matters most" width="300"/></a>
</h2>

> I just stumbled across a forgotten 20-page Google Doc I poured my heart into months ago, and the rush of lost momentum hit me like a punch.  
> — Brian (December 2022)

> [!QUESTION] **Is this you?**
> You're an Obsidian power‑user, researcher, writer, or lifelong learner with **hundreds or thousands of notes**. You capture ideas quickly, but later struggle to find and connect them when it matters most.

> [!WARNING] **The Problem**  
> Valuable insights disappear in a sea of unlinked notes, forcing endless scrolling, rereading, and duplicated work. Time you wanted for creativity leaks away into manual organization.

# Smart Connections v4

![](https://smartconnections.app/assets/connections-view-notes-2025-12-09.gif)


> [!NOTE] What Smart Connections does  
> Smart Connections uses local embeddings and your Smart Environment to surface notes that are semantically related to what you are working on right now.

✔️ Zero-setup: ships with a local embedding model that just works  

🔐 Private and offline by default  

📲 Works on mobile devices  

📦 Ultra-lightweight bundle with minimal third party dependencies  

🔍 Streamlined codebase with minimal/no dependencies can be audited >3× faster than comparable AI plugins

🌐 Source available core, local-first data

⚔️ Mission driven, user aligned, community supported  

> [!SUCCESS] **What success looks like**  
> With Smart Connections running, ideas resurface when you need them, writing flows faster, and your note taking system finally feels like the trusted second brain you imagined.

> [!FAILURE] **The Cost of Doing Nothing**
> Stay stuck sifting through files, forgetting past research, and wasting precious creative energy on housekeeping instead of creation.
> Without help, your vault keeps growing into a maze. You keep redoing work you already did once, and important ideas stay buried.

### Walkthrough video

See Smart Connections (and how it pairs with Smart Chat) in action:  
[![](/assets/smart-connections-wanderloots.jpg)](https://youtu.be/7Rvl9Sl29Jk?si=16YKPZavyz8Ol7rx)  
[Watch on YouTube](https://youtu.be/7Rvl9Sl29Jk?si=16YKPZavyz8Ol7rx)

### Feature walkthrough

Access the Getting Started guide from Smart Connections settings.  
[![Smart Connections Getting Started](/assets/smart-connections-getting-started.gif)](https://smartconnections.app/story/smart-connections-getting-started/?utm_source=connections-readme)

Watch the [feature walkthrough slideshow](https://smartconnections.app/story/smart-connections-getting-started/?utm_source=connections-readme) or read the [Getting Started guide](https://smartconnections.app/smart-connections/getting-started/?utm_source=connections-readme) to see how Smart Connections fits into your workflow, including Connections view, Lookup view, inline Pro features, and Smart Environment settings.
#### Learn more

- [Smart Connections overview](https://smartconnections.app/smart-connections/?utm_source=connections-readme)
- [Getting Started](https://smartconnections.app/smart-connections/getting-started/?utm_source=connections-readme)
- [Connections list feature](https://smartconnections.app/smart-connections/list-feature/?utm_source=connections-readme)
- [Lookup view](https://smartconnections.app/smart-connections/lookup/?utm_source=connections-readme)
- [Settings guide](https://smartconnections.app/smart-connections/settings/?utm_source=connections-readme)
- [Inline connections (Pro)](https://smartconnections.app/smart-connections/inline/?utm_source=connections-readme)
- [Bases integration (Pro)](https://smartconnections.app/smart-connections/bases/?utm_source=connections-readme)
- [Pro plugins overview](https://smartconnections.app/pro-plugins/?utm_source=connections-readme)
- [Introducing Pro plugins](https://smartconnections.app/introducing-pro-plugins/?utm_source=connections-readme)

## Getting started
### It "just works"
Surface relationships between notes with zero-setup.


> [!TLDR] 3 step plan  
> 1. **Install and enable** Smart Connections from Obsidian Community plugins.  
> 2. **Keep writing**. The built in local model automatically indexes your vault.  
> 3. **Open the Connections view** to see relevant notes and drag links directly into what you are working on.
<details><summary><span style="--font-weight: var(--h3-weight); font-variant: var(--h3-variant); letter-spacing: var(--h3-letter-spacing); line-height: var(--h3-line-height); font-size: var(--h3-size); color: var(--h3-color); font-weight: var(--font-weight); font-style: var(--h3-style); font-family: var(--h3-font); cursor: pointer;">Easy installation + zero-setup</span></summary>

Find Smart Connections in the [Obsidian Community plugins](https://obsidian.md/plugins?id=smart-connections).  
![](/assets/SC-OP-install-and-enable-2025-05-20.png)

#### Install and enable, that is it

A local model starts creating embeddings right away. No extra apps, no CLI tools, and no API key required.  
![](/assets/SC-OP-notices-embedding-complete-2025-05-20.png)
</details><br>

<details><summary><span style="--font-weight: var(--h3-weight); font-variant: var(--h3-variant); letter-spacing: var(--h3-letter-spacing); line-height: var(--h3-line-height); font-size: var(--h3-size); color: var(--h3-color); font-weight: var(--font-weight); font-style: var(--h3-style); font-family: var(--h3-font); cursor: pointer;">Connections view</span></summary>
The Connections view shows notes that are semantically related to your current note.

Open it from the left ribbon (Connections icon) or from the command palette by running the `Open: Connection view` command.

![](https://smartconnections.app/assets/connections-view-notes-2025-12-09.gif)

#### Using the Connections view

Connections view results update automatically when you change notes. The name of the current note appears at the bottom left of the Connections view.

![](https://smartconnections.app/assets/Connections-item-view-info-overload-annotated-main-2025-12-09.png)

- **Result score** (yellow underline)  
	The score reflects semantic similarity between the result and the current note. Exact numbers depend on the embedding model.  
- **Show or hide content** (magenta)  
	Expand or collapse individual results. Use the top row button to expand or collapse all.  
- **Play / pause updates** (orange)  
	Control whether the Connections view automatically updates when you change notes.  
- **Lookup query** (teal)  
	Opens the Lookup view for a semantic search across your vault.

> [!NOTE] Semantic search  
> Semantic queries do not behave like plain text search. A note that contains the exact query text might not appear if it is not actually similar in meaning.

#### Interacting with connection results

- Drag a result into a note to create a link.  
- Hold Cmd or Ctrl while hovering over a result to show Obsidian's Hover Preview.

![](/assets/SC-OP-connections-view-mouse-annotations-2025-05-20.jpg)

#### Hiding and unhiding connections

Right click a result to hide it from the list:  
![](/assets/SC-OP-Connections-view-right-click-to-hide-2025-07-01.png)

Right click any result and use **Unhide all** to bring hidden items back:  
![](/assets/SC-OP-Connections-view-right-click-to-unhide-2025-07-01.png)
</details><br>

<details><summary><span style="--font-weight: var(--h3-weight); font-variant: var(--h3-variant); letter-spacing: var(--h3-letter-spacing); line-height: var(--h3-line-height); font-size: var(--h3-size); color: var(--h3-color); font-weight: var(--font-weight); font-style: var(--h3-style); font-family: var(--h3-font); cursor: pointer;">Lookup view (semantic search)</span></summary>
Use the Lookup view for ad hoc semantic search across your vault.

Open it from the ribbon (Lookup icon) or from the command palette by running the `Open: Lookup view` command.

![](https://smartconnections.app/assets/Lookup-item-view-annotated-new-2025-12-09.png)

> [!NOTE] Semantic search  
> Semantic queries do not work like regular search queries. For example, a note containing the exact query text may not be returned in the results.

![](https://smartconnections.app/assets/Lookup-item-view-annotated-with-query-2025-12-09.png)
</details><br>

<details><summary><span style="--font-weight: var(--h3-weight); font-variant: var(--h3-variant); letter-spacing: var(--h3-letter-spacing); line-height: var(--h3-line-height); font-size: var(--h3-size); color: var(--h3-color); font-weight: var(--font-weight); font-style: var(--h3-style); font-family: var(--h3-font); cursor: pointer;">Random connection function</span></summary>
Jump to a random note that is strongly connected to your current one.

- Click the random connection icon in the ribbon, or  
- Run the `Open: Random note from connections` command from the command palette.  

Note: the random connection command requires the Connections view to be active.
</details><br>


## What's new in v4?

Smart Connections v4 focuses the core plugin on a simple promise: install, enable, and AI-powered connections just work. Advanced configuration and power-user workflows now live in Pro plugins. Read [Introducing Pro Plugins](https://smartconnections.app/introducing-pro-plugins/?utm_source=connections-readme) to learn more.

<details><summary><span style="--font-weight: var(--h3-weight); font-variant: var(--h3-variant); letter-spacing: var(--h3-letter-spacing); line-height: var(--h3-line-height); font-size: var(--h3-size); color: var(--h3-color); font-weight: var(--font-weight); font-style: var(--h3-style); font-family: var(--h3-font); cursor: pointer;">Pause connections</span></summary>
Use the new Connections "pause" button to freeze the connections results. This allows you to move through your vault while keeping the connections to a specific note visible while you work.
</details><br>

<details><summary><span style="--font-weight: var(--h3-weight); font-variant: var(--h3-variant); letter-spacing: var(--h3-letter-spacing); line-height: var(--h3-line-height); font-size: var(--h3-size); color: var(--h3-color); font-weight: var(--font-weight); font-style: var(--h3-style); font-family: var(--h3-font); cursor: pointer;">Copy connections as list of links</span></summary>
Right-click the connections results to *copy all links* to clipboard.
</details><br>

<details><summary><span style="--font-weight: var(--h3-weight); font-variant: var(--h3-variant); letter-spacing: var(--h3-letter-spacing); line-height: var(--h3-line-height); font-size: var(--h3-size); color: var(--h3-color); font-weight: var(--font-weight); font-style: var(--h3-style); font-family: var(--h3-font); cursor: pointer;">Copy all connections content (Context Engineering)</span></summary>
Click the connections view menu button and "Send to Smart Context" (briefcase icon) option. This allows you to quickly copy *all content from the connections* to clipboard for use as context with any AI chat! The Smart Context view also lets you add or remove items before copying all to the clipboard in one-click!
</details><br>

<details><summary><span style="--font-weight: var(--h3-weight); font-variant: var(--h3-variant); letter-spacing: var(--h3-letter-spacing); line-height: var(--h3-line-height); font-size: var(--h3-size); color: var(--h3-color); font-weight: var(--font-weight); font-style: var(--h3-style); font-family: var(--h3-font); cursor: pointer;">Pinned connections</span></summary>
In addition to "hiding" connections, you can now "Pin" connections. This ensures the pinned connections are always visible in the connections view. **Connections Pro:** *Hidden and pinned connections are used by new connections algorithms (available in Pro) to improve results!*
</details><br>

<details><summary><span style="--font-weight: var(--h3-weight); font-variant: var(--h3-variant); letter-spacing: var(--h3-letter-spacing); line-height: var(--h3-line-height); font-size: var(--h3-size); color: var(--h3-color); font-weight: var(--font-weight); font-style: var(--h3-style); font-family: var(--h3-font); cursor: pointer;">Connections Pro</span></summary>
Connections Pro builds on the core plugin and Smart Environment to give power users more control.

![](https://smartconnections.app/assets/connections-view-pro-notes.gif)

Examples of Pro features:

- **Inline connections**  
	Small badges in the editor that show how many strong matches a block has, with a pop-over of related blocks and notes.  
- **Footer connections**  
	A persistent panel that updates as you type so high value connections stay visible while you write.  
- **Configurable scoring and ranking**  
	Choose different algorithms for how results are scored and optionally add a rerank stage.  
- **Connections in Bases**  
	Use `score_connection` and `list_connections` in Obsidian Bases to show similarity columns and related note lists in tables.  
- **Advanced filters and models**  
	Extra Smart Environment controls for embeddings, collections, and include or exclude rules.  
- **Early release experiments**  
	New ideas launch in Early channels first so supporters can shape how they evolve.

Connections Pro is part of the [Pro plugins](https://smartconnections.app/pro-plugins/?utm_source=connections-readme) family and is available to active project supporters. It is still built on the same open Smart Environment. Supporting Pro helps fund development of all Smart Plugins and the free core.
</details><br>

<details><summary><span style="--font-weight: var(--h3-weight); font-variant: var(--h3-variant); letter-spacing: var(--h3-letter-spacing); line-height: var(--h3-line-height); font-size: var(--h3-size); color: var(--h3-color); font-weight: var(--font-weight); font-style: var(--h3-style); font-family: var(--h3-font); cursor: pointer;">Events and notifications</span></summary>
Important events are now surfaced in a dedicated notifications modal:
- On desktop, click the Smart Env item in the status bar to open the notifications modal.  
- On mobile, a Smart Environment notice appears at the bottom of the Connections view; tap it to review events.

Examples of events you might see:
- Initial indexing complete for your vault  
- Sources reimported after model changes  
- Warnings when exclusions block indexing on specific folders or files  

Objectives of the new Events system:
- make the environment inspectable and understandable
- reduce the number of Obsidian native notifications
</details><br>

## Private by Design, Local-first by Default

User-aligned means privacy and local first are design constraints, not optional checkboxes.

- Embeddings are created locally by default.  
- Your notes stay on your machine. 
- Smart Environment gives you a single place to control common configurations that apply to all Smart Plugins.

Privacy should not be a premium feature. *Smart Plugins are private by default!*

## Mission-driven

The Obsidian community opened my eyes to user-aligned software. Smart Connections is built on a set of principles designed to keep power in the hands of individuals, not platforms.

> [!INFO] Your guide  
> Built by Brian, a fellow Obsidian user who felt the same pain, Smart Connections pairs hard won experience with source available AI expertise to lead you from overwhelm to insight.

## Built for You

> [!NOTE] Why Smart Connections  
> Smart Connections started as a personal tool. The Obsidian community turned it into a shared project and helped refine it into something that can actually keep up with real workflows.

Smart Connections exists so you can:

- Spend less time hunting through old notes.  
- Spend more time writing, synthesizing, and shipping.  
- Stop worrying that important research is lost somewhere in your vault.

It is not about features for their own sake. It is about empowerment.

<details><summary><span style="--font-weight: var(--h3-weight); font-variant: var(--h3-variant); letter-spacing: var(--h3-letter-spacing); line-height: var(--h3-line-height); font-size: var(--h3-size); color: var(--h3-color); font-weight: var(--font-weight); font-style: var(--h3-style); font-family: var(--h3-font); cursor: pointer;">Built from scratch</span></summary>Building the Smart Environment, the core architecture behind Smart Connections, from scratch has empowered me with a deep understanding of the capabilities and limitations of AI. These insights contribute to why I believe the Smart Environment will outlast me.</details><br>
 
<details><summary><span style="--font-weight: var(--h3-weight); font-variant: var(--h3-variant); letter-spacing: var(--h3-letter-spacing); line-height: var(--h3-line-height); font-size: var(--h3-size); color: var(--h3-color); font-weight: var(--font-weight); font-style: var(--h3-style); font-family: var(--h3-font); cursor: pointer;">Built on principles</span></summary>Building from scratch is also what makes the Smart Environment and Smart Plugins worth your trust. Nearly all of the code comes from a single (principle: minimal/no dependencies). That means you don't have to worry about waking up to learn about major supply chain attacks that target the most popular and most used dependencies.</details><br>
 


## User testimonials

Hearing from those who use Smart Connections brings to life the impact it has on individuals' workflows and creativity. 

Here's what some of them have to say:

- "Smart Connections is revolutionary for my process of attempting to wrangle decades of sprawling unorganized notes, journals etc. Amazing work! Look forward to seeing it evolve." - Ronny
- ["I've switched over from Mem to Obsidian when I found this plugin"](https://discord.com/channels/686053708261228577/694233507500916796/1091164112425320538)
- ["I actually decided to start using Obsidian BECAUSE of Smart Connections."](https://github.com/brianpetro/obsidian-smart-connections/issues/441#:~:text=I%20actually%20decided%20to%20start%20using%20Obsidian%20BECAUSE%20of%20Smart%20Connections.)
- [Let me take the opportunity to say what a brilliant plug in you have created it has completely transformed the way I am able to use notes.](https://github.com/brianpetro/obsidian-smart-connections/issues/592#issuecomment-2104332746:~:text=Let%20me%20take%20the%20opportunity%20to%20say%20what%20a%20brilliant%20plug%20in%20you%20have%20created%20it%20has%20completely%20transformed%20the%20way%20I%20am%20able%20to%20use%20notes)
- [I can already see this will be a game-changer for my research and personal note-taking.](https://github.com/brianpetro/obsidian-smart-connections/issues/589#issuecomment-2104948387:~:text=I%20can%20already%20see%20this%20will%20be%20a%20game%2Dchanger%20for%20my%20research%20and%20personal%20note%2Dtaking.)
- [Hi Brian, you've created one of the most powerful Obsidian's plugin, in the name of all the Obsidian users, i really want to thank you ! It makes our lives easier and more creative ❤️](https://www.youtube.com/watch?v=tGZ6J63UZmw&lc=UgwRE_J-yZ5QVC6b6yJ4AaABAg)
- [thanks so much for this and the wonderful plugin.](https://www.youtube.com/watch?v=tGZ6J63UZmw&lc=UgzgQhv2CA0easzk7np4AaABAg)
- ["This is such a game-changingly helpful plugin"](https://github.com/brianpetro/obsidian-smart-connections/issues/329#issuecomment-2002162224:~:text=This%20is%20such%20a%20game%2Dchangingly%20helpful%20plugin)
- ["This plugin has become a vital part of my life"](https://github.com/brianpetro/obsidian-smart-connections/issues/120#issuecomment-1492842117:~:text=This%20plugin%20has%20become%20a%20vital%20part%20of%20my%20life)
- ["This is by far my favourite Obsidian plug-in and it is immensely helpful. I'll be doing a full video about using it for PhD research"](https://github.com/brianpetro/obsidian-smart-connections/discussions/371#discussioncomment-7977910:~:text=This%20is%20by%20far%20my%20favourite%20Obsidian%20plug%2Din%20and%20it%20is%20immensely%20helpful.%20I%27ll%20be%20doing%20a%20full%20video%20about%20using%20it%20for%20PhD%20research)
- ["It's astonishing the power it provides to deal with scientific research and scientific articles included in the vault."](https://github.com/brianpetro/obsidian-smart-connections/issues/250#issuecomment-1595108987:~:text=It%27s%20astonishing%20the%20power%20it%20provids%20to%20deal%20with%20scientific%20research%20and%20scientific%20articles%20included%20in%20the%20vault.)
- ["Smart Connections is easily in my Top 3 [plugins], it changes radically the use of [Obsidian], many thanks for that."](https://github.com/brianpetro/obsidian-smart-connections/issues/64#issuecomment-1484212168:~:text=Smart%20connections%20is%20easily%20in%20my%20Top%203%2C%20it%20changes%20radically%20the%20use%20of%20the%20Soft%2C%20many%20thanks%20for%20that.)
- ["[Smart Connections] significantly changed how I use PKM"](https://discord.com/channels/686053708261228577/710585052769157141/1091163849190801468)
- ["This is an AWESOME little plugin. Thanks for sharing."](https://forum.obsidian.md/t/introducing-smart-chat-a-game-changer-for-your-obsidian-notes-smart-connections-plugin/56391/8?u=wfh#:~:text=This%20is%20an%20AWESOME%20little%20plugin.%20Thanks%20for%20sharing.)
- ["Hopping on to also say thanks. I have been wanting this feature in something ever since reading about tad starners remembrance agent in the 90s! And this is even better."](https://github.com/brianpetro/obsidian-smart-connections/issues/47#issuecomment-1471441869:~:text=Hopping%20on%20to%20also%20say%20thanks.%20I%20have%20been%20wanting%20this%20feature%20in%20something%20ever%20since%20reading%20about%20tad%20starners%20remembrance%20agent%20in%20the%2090s!%20And%20this%20is%20even%20better.)
- ["I'm having so much fun using your chat plugin to search my notes better and get insights."](https://github.com/brianpetro/obsidian-smart-connections/issues/57#:~:text=Hi%2C-,I%27m%20having%20so%20much%20fun%20using%20your%20chat%20plugin%20to%20search%20my%20notes%20better%20and%20get%20insights,-.%20I%20was%20just)
- ["This is undoubtedly an excellent plugin that makes a significant improvement in how we interact with our notes."](https://github.com/brianpetro/obsidian-smart-connections/pull/219#issuecomment-1562572364:~:text=This%20is%20undoubtedly%20an%20excellent%20plugin%20that%20makes%20a%20significant%20improvement%20in%20how%20we%20interact%20with%20our%20notes.)
- "I have been using Smart Connections with Obsidian. It is excellent. I am finding more and more uses for it. I am intrigued by the idea of being able to use a local embedding model." - Eamonn
- "Huge fan of Smart Connections so much that I even [wrote a post about how I use it to massively save time on summarizing legal cases](https://careylening.substack.com/p/the-power-of-links-and-second-brains-d1d) (I also talk about my whole crazy workflow and the other tools I use, but SC gets a big shout-out)" - Carey
- "I love the latest version of Smart Connections and just used it for an amazing use case: I took my Obsidian notes and used them for qualifying my yearly performance review." - Jarrett
- "Thanks for your incredible work - I am a performer and a sound artist and your plugin is really helping me make the most of Obsidian, make all kinds of fruitful connections." - Adrienne
- "I'm currently writing a book and this is proving helpful in the process." - Michael
- "Love the plugin! use it all the time. I'm also doing a webinar about it for my community." - Alex
- "I use your app every day. I am a product manager and have a knowledge base of products that I reference in my writing and user story creation."  - Todd
- "On a personal note, man do I wish I had access to these kinds of things when I was doing my PhD." - Mikey

<details><summary>More nice things about Smart Connections 😊</summary>


- "Smart Connections is truly the best new plugin of the year. Please keep it up!" - Larry
- "Brian, you've done a great job. Smart Connections is the best Obsidian plugin ever." - Es
- "I really do love the app.  It saved me from having to buy Mems and stick with Obsidian." - Greg
- "Thanks for making Smart Connections. I use it every day and it has completely changed the game." - Joe
- "I am glad to see your updates on smart connections in the new year. Thank you for your selfless contribution." - 嘿然笑道 
- "Love this app! V2 looks to have an awesome feature as well. Keep up the great work." - Austin
- "I wanted to show my support for Smart Connections and would love to not only get early access to Version 2.0, but help out wherever I can. Thanks!!" - Danny
- "Great plugin, use it as my standard right pane." - Guenter
- "I believe it one of the best plugin for Obsidian!" - Viktor
- "Thank you for the great plugin. I definitely had to vote for it :)" - Marc
- "Good luck and great work on the plugin so far!" - Harpreet
- "Thank you again for your amazing plugin." - Eduardo 
- "Hey, thanks for a great app." - Robert
- "Smart Connections is a really great program, and I am looking forward to working with v2.0." - Jarrett
- "Keep up the great work ♡" - Duke
- "Such an amazing plug-in. Thanks for supercharging my notes!" - Simon
- "Thank you for the plugin! It looks very promising, I am still exploring it." - Damien
- "Big thanks to you for creating such a slick tool. Excited to see where it goes!" - Khael
- "Thank you for this amazing tool!" - Pablo
- "Keep up the good work :-)" - Dorian
- "Thanks for your work on Smart Connections. Excited for v2" - Eli
- "Absolutely love what you're doing here and I can't wait to see how this plugin continues to grow over the next year!" - Ryan
- "You're crushing it!" - Chad
- "Way to go, Brian. Smart Connections Rocks!"  - Arne
- "Tks a lot for the effort you put in this tool!" - Marcelo
- "Thanks for a great plug-in BTW." - Ali
- "Thanks for the plugin ! It really helps in my work :)" - Jordan
- "I am just discovering it, but enjoying it so far!"  - Nick
- "Thank you for all your work on Smart Connections." - Ed
- "In my top 3 of the most useful plugins." - Mickaël 
- "Thank you for your hard work. - from South Korea" - 오송인
- ["I love this extension so much. So many potential features by the way."](https://github.com/brianpetro/obsidian-smart-connections/issues/48#issuecomment-1459929611:~:text=I%20love%20this%20extension%0Aso%20much.%20So%20many%20potential%20features%20by%20the%20way.)
- ["This plugin is fantastic"](https://github.com/brianpetro/obsidian-smart-connections/issues/47#:~:text=This%20plugin%20is%20fantastic)
- ["This is a terrific idea"](https://github.com/brianpetro/obsidian-smart-connections/issues/54#:~:text=This%20is%20a%20terrific%20idea)
- ["This plugins could be a Game changer!"](https://github.com/brianpetro/obsidian-smart-connections/issues/54#:~:text=This%20plugins%20could%20be%20a%20Game%20changer!)
- ["I personally love the app"](https://old.reddit.com/r/ObsidianMD/comments/11s0oxb/chat_with_your_notes_now_available_in_the_smart/jcd73y8/?context=3#:~:text=I%20personally%20love%20the%20app)
- ["This app is such a game changer"](https://github.com/brianpetro/obsidian-smart-connections/discussions/203#discussioncomment-5854265:~:text=This%20app%20is%20such%20a%20game%20changer.)
- ["Absolutely LOVE this plugin"](https://github.com/brianpetro/obsidian-smart-connections/issues/202#issue-1702708828:~:text=Absolutely%20LOVE%20this%20plugin.)
- ["Smart-connections is a fantastic plugin"](https://github.com/brianpetro/obsidian-smart-connections/issues/280#issuecomment-1630047763:~:text=Smart%2Dconnections%20is%20a%20fantastic%20plugin)
- ["Hi, amazing plugin! 🔥"](https://github.com/brianpetro/obsidian-smart-connections/issues/57#issuecomment-1488187361:~:text=Hi%2C%20amazing%20plugin,%F0%9F%94%A5)
- ["Absolutely mind blowing"](https://twitter.com/micka_dore/status/1641527570867822615?s=20)
- ["I love this plugin"](https://github.com/brianpetro/obsidian-smart-connections/issues/496#issuecomment-1996755512:~:text=interest%20of%20course.-,I%20love%20this%20plugin,-.)
- ["Now it serves me as a way to brainstorm potential connections, and I have seen major improvements over the past few months. I especially enjoy using it as part of my book digestion and relation process."](https://old.reddit.com/r/ObsidianMD/comments/11s0oxb/chat_with_your_notes_now_available_in_the_smart/jcczwiq/?context=3#:~:text=Now%20it%20serves%20me%20as%20a%20way%20to%20brainstorm%20potential%20connections%2C%20and%20I%20have%20seen%20major%20improvements%20over%20the%20past%20few%20months.%20I%20especially%20enjoy%20using%20it%20as%20part%20of%20my%20book%20digestion%20and%20relation%20process.)
- ["this is just such an incredible plugin!"](https://github.com/brianpetro/obsidian-smart-connections/issues/244#issuecomment-1595765101:~:text=this%20is%20just%20such%20an%20incredible%20plugin)
- ["Tried it, and it worked as well as I could hope! Thanks for making this."](https://old.reddit.com/r/ObsidianMD/comments/11s0oxb/chat_with_your_notes_now_available_in_the_smart/jcdpwsg/?context=3#:~:text=Tried%20it%2C%20and%20it%20worked%20as%20well%20as%20I%20could%20hope!%20Thanks%20for%20making%20this.)
- ["This is an amazing extension."](https://github.com/brianpetro/obsidian-smart-connections/issues/32#issuecomment-1435798970:~:text=This%20is%20an%20amazing%20extension.)
- [This is really cool...](https://twitter.com/rcvd_io/status/1638271532932780035?s=20)
- ["This is an amazing plugin!"](https://github.com/brianpetro/obsidian-smart-connections/issues/20#:~:text=This%20is%20an%20amazing%20plugin!)
- ["With smart connections, by just opening one such note, I can find all the others that reference the concept"](https://discord.com/channels/686053708261228577/694233507500916796/1091167414865109012)
- ["Has amazing potential to unlock lots of new info that can be added to your vault"](https://github.com/brianpetro/obsidian-smart-connections/issues/19#issue-1533699525:~:text=has%20amazing%20potential%20to%20unlock%20lots%20of%20new%20info%20that%20can%20be%20added%20to%20your%20vault)
- ["Great plugin!"](https://github.com/brianpetro/obsidian-smart-connections/issues/1#issue-1511238131:~:text=Dec%2026%2C%202022-,Great%20plugin!,-My%20request%20is)
- ["Loving the plugin so far!"](https://github.com/brianpetro/obsidian-smart-connections/issues/2#issue-1511288845:~:text=Loving%20the%20plugin%20so%20far!)
- ["Smart Connections is so cool. I'm noticing similarities between notes that talk about the same thing but don't share any words."](https://discord.com/channels/686053708261228577/694233507500916796/1065057689949982870#:~:text=Smart%20Connections%20plugin%3F%20It%27s%20so%20cool.%20I%27m%20noticing%20similarities%20between%20notes%20that%20talk%20about%20the%20same%20thing%20but%20don%27t%20share%20any%20words.)
- ["Thanks for doing this. I love the idea to have OpenAI help look through my notes to find connections"](https://github.com/brianpetro/obsidian-smart-connections/issues/47#issue-1609765217:~:text=Thanks%20for%20doing%20this.%20I%20love%20the%20idea%20to%20have%20OpenAI%20help%20look%20through%20my%20notes%20to%20find%20connections.)
</details>

[Even more love for Smart Connections 🥰](https://smartconnections.app/smart-connections-love/)



## FAQs and troubleshooting
<details><summary><span style="--font-weight: var(--h3-weight); font-variant: var(--h3-variant); letter-spacing: var(--h3-letter-spacing); line-height: var(--h3-line-height); font-size: var(--h3-size); color: var(--h3-color); font-weight: var(--font-weight); font-style: var(--h3-style); font-family: var(--h3-font); cursor: pointer;">Does it work on mobile?</span></summary>Yes, both the Core Smart Connections and Connections Pro are mobile friendly.</details><br>
<details><summary><span style="--font-weight: var(--h3-weight); font-variant: var(--h3-variant); letter-spacing: var(--h3-letter-spacing); line-height: var(--h3-line-height); font-size: var(--h3-size); color: var(--h3-color); font-weight: var(--font-weight); font-style: var(--h3-style); font-family: var(--h3-font); cursor: pointer;">Syncthing and third party sync</span></summary>
Smart Connections works best with Obsidian Sync. If you use a third party sync tool, add the `.smart-env/` directory to its ignore patterns to avoid conflicts.</details><br>
<details><summary><span style="--font-weight: var(--h3-weight); font-variant: var(--h3-variant); letter-spacing: var(--h3-letter-spacing); line-height: var(--h3-line-height); font-size: var(--h3-size); color: var(--h3-color); font-weight: var(--font-weight); font-style: var(--h3-style); font-family: var(--h3-font); cursor: pointer;">Where is Smart Chat?</span></summary>

Smart Chat is no longer bundled inside Smart Connections, as planned in the last major release, it has been moved to its own dedicated plugin. You can now install **Smart Chat** directly from the [Obsidian Community plugins](https://obsidian.md/plugins?id=smart-chatgpt) or learn more [here](https://smartconnections.app/smart-chat/?utm_source=connections-readme).

To keep the **Core Smart Connections plugin** simple and “just works,” all **API‑based model integrations (cloud and local)** have moved into **Smart Chat Pro**, the Pro version of the Smart Chat plugin. This lets advanced model routing and multi‑provider support be maintained sustainably, while the free Smart Plugins stay focused on essential core features that work with third-party interfaces like ChatGPT, Claude and Gemini.

For more about Pro plugins, read [Introducing Pro Plugins](https://smartconnections.app/introducing-pro-plugins/?utm_source=connections-readme).
</details><br>
<details><summary><span style="--font-weight: var(--h3-weight); font-variant: var(--h3-variant); letter-spacing: var(--h3-letter-spacing); line-height: var(--h3-line-height); font-size: var(--h3-size); color: var(--h3-color); font-weight: var(--font-weight); font-style: var(--h3-style); font-family: var(--h3-font); cursor: pointer;">What is the Smart Ecosystem?</span></summary>

Smart Connections is one piece of a larger ecosystem of local first, user aligned tools.
I build Smart Plugins to explore new ideas, ship practical workflows, and keep complexity manageable inside Obsidian. Smart Connections is the piece that handles the space between notes (connections).
</details><br>

<details><summary><span style="--font-weight: var(--h3-weight); font-variant: var(--h3-variant); letter-spacing: var(--h3-letter-spacing); line-height: var(--h3-line-height); font-size: var(--h3-size); color: var(--h3-color); font-weight: var(--font-weight); font-style: var(--h3-style); font-family: var(--h3-font); cursor: pointer;">What are Pro plugins?</span></summary>

Most AI features need continuous maintenance. As providers and APIs change, deeply configurable options require far more support, testing, and refactoring than simple defaults.

[Introducing Pro plugins](https://smartconnections.app/introducing-pro-plugins/?utm_source=connections-readme): how the project stays sustainable without compromising the open core. Core Smart Plugins remain free and source available. Pro plugins sit on top of that core, built on the same open Smart Environment. They do not remove the essentials from the free plugins; instead they collect advanced options in one place and fund the work needed to maintain them.
Pro plugins (including Connections Pro) are available to all past project supporters. Not yet a supporter? [Get Pro plugins here](https://smartconnections.app/pro-plugins/?utm_source=connections-readme).
</details><br>

<details><summary><span style="--font-weight: var(--h3-weight); font-variant: var(--h3-variant); letter-spacing: var(--h3-letter-spacing); line-height: var(--h3-line-height); font-size: var(--h3-size); color: var(--h3-color); font-weight: var(--font-weight); font-style: var(--h3-style); font-family: var(--h3-font); cursor: pointer;">What is Smart Environment?</span></summary>

Smart Environment is the shared local core that powers Smart Connections, Smart Chat, and the rest of the Smart Ecosystem.

- It keeps an up to date index of your notes using embeddings.  
- It listens for Obsidian events so indexing and stats stay in sync with your vault.  
- It gives you one place to manage models, sources, and exclusions across all Smart Plugins.

Smart Environment is undergoing major upgrades to better enable local-first AI tooling. If you have joined Community Lean Coffee sessions, you have already seen glimpses of what this future looks like.

In short, Smart Environment aims to be your local-first core: a PKM inspired backend for your personal data that will eventually let you vibe code your own frontend components on top of your notes.
</details><br>

---

## Connections Pro

[![](https://smartconnections.app/assets/connections-view-pro-notes.gif)](https://smartconnections.app/smart-connections/?utm_source=connections-readme)

[Learn more about Connections Pro](https://smartconnections.app/smart-connections/?utm_source=connections-readme).

## More Smart Plugins
Quickly assemble many notes into a single prompt or document using context selectors, links, and templates with **Smart Context**. Want to know how I manage thousands of ChatGPT threads from Obsidian? Start a new thread inside of a note and come back to it later with **Smart Chat!**

[See the currently available Core Smart Plugins.](https://smartconnections.app/core-plugins/?utm_source=connections-readme)

Together with Smart Environment, Smart Plugins are an experiment in how AI can empower individuals to do extraordinary work without sacrificing privacy to data hungry giants.

> [!NOTE] Welcome to our Smart Community 😊
> Hey there! I'm 🌴 Brian. I built Smart Connections to help solve my organization problems. My hope is that it can save you from the same chaos!
> - How does it feel when you realize you forgot something that was important to you? Why capture more notes if the ideas get lost in oblivion?
> - What if you didn't spend so much time organizing? What could you have done with all that lost time spent organizing?
> 
> These are the questions I'm trying to answer. Smart Connections is one piece, albeit a corner piece, representing an important first step in exploration of how AI can empower individuals like you and I.
> 
> *Smart Connections isn't a silver-bullet*. But, it is the a key Smart Tool that can **empower us to do more!**
> 

