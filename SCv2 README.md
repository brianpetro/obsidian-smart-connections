Hey there, I'm Brian, the mind behind Smart Connections (still human, at this point 🤪). I laugh at my own jokes, like to use emojis, and think about thinking.

The journey of Smart Connections is one I directly share with you. Smart Connections isn't just about some new features in Obsidian; it's a reflection of our shared experiences, your invaluable feedback, and a testament to what we can achieve together in the Obsidian community. A journey that's been both exhilarating and profoundly educational.

Obsidian wasn't my first attempt at trying to manage and make sense of my notes. And in late 2022, like what has happened with all of my past attempts, the system I had built in Obsidian was beginning to fall apart. There were too many notes and I didn't having enough time to organize, link, tag, and otherwise manage them properly.
## Introduction to Smart Connections
### Smart View - AI Organization
![Smart View demo showing that the most relevant notes are shown at the top based on the current note.](./assets/SCv2-Smart-View-light.gif)

Smart Connections started as way for me to keep track of my thousands of notes, prevent rework, and make new connections by showing relevant notes/excerpts alongside whatever note I was currently working on via the Smart View.
### Smart Chat - AI Synthesis
By using the same embedding technology that powers the Smart View, we can now use technology like ChatGPT to answer questions based on our notes in the Smart Chat.

## Mission
### For Individuals
Open-source has been around a long time, but, over the past decade it seems that the primary beneficiary of open-source has shifted away from individuals and toward corporate interests. For example, see the many VC-funded open-source projects.

It's my belief that open-source software that serves individuals directly is one way we can prevent growing inequality from new AI technologies. Smart Connections is designed for individuals, with an emphasis on non-technical individuals.
## Testimonials
- Highlights of user feedback
## How it Works  
- Overview of plugin operation
	- Creating embeddings
	- Limitations (desktop-only, mobile support coming soon)
- more details in the features section below
## Installation  
- Installing from Obsidian community plugins  
- Configuration
	- Defaults
	- API key, file/folder exclusions, show full path, etc.  
		- Setting up OpenAI API key
			- requires pre-paying for tokens
	- Advanced settings
## Features
### Smart View
The Smart View provides real-time note suggestions based on your current note.

![Demo showing Smart View results changing based on the current note](./assets/SCv2-Smart-View-dark.gif)
##### Accessing notes in the Smart View
- Click to open a result in the Smart View 
- Preview connections using the expand/collapse (fold/unfold) button to the left of each result
- Expand/collapse all feature is displayed below

![Demo showing the fold/unfold feature which displays or hides the content of the notes in the Smart View](./assets/SCv2-fold-unfold.gif)

##### Smart View Search
Click the search icon to input a search query.
- note: it's important to remember that embedding search (semantic) does not function like a traditional keyword search (lexical).
### Smart Command (Find Notes)
- Section 'Block' Matching
	- Description of block matching feature
- Highlight to Find Smart Connections
	- Usage of highlighted text for finding connections
- Smart Chat
	- Conversations with notes
	- Information retrieval and exploration
- Interactive conversations with notes using AI  
- How it works  
- Features (GPT-4 support, context-aware responses, etc.)  
- Benefits and limitations  
### Dynamic Code Blocks
- Dedicated section for displaying relevant connections  
- How to use the dynamic code block 
	- Section 'block' matching  
	- Highlight to find Smart Connections
### Note vs Block Level Smart Connections
- Note-level embeddings
	- these embeddings are 
### Notifications and Progress Indicators
- muting notifications
## File-type Compatibility
- Markdown
- Obsidian Canvas
- PDFs (coming soon!)
## How You Can Contribute
- Invitation to GitHub discussions
	- Importance of community feedback
- Reporting issues on GitHub  
- Emphasized recording videos on how you use Smart Connections

### non-technical
Contributions to the project do not have to be technical. In fact, one of the biggest needs of Smart Connections is non-technical. Creating content that shows how you're using Smart Connections not only helps development, but also helps existing and potential users better understand how they can benefit from utilizing AI, creating an impact that extends beyond this project! 
##### Screencasts
Your contributions through video testimonials on how you use Smart Connections are invaluable. These insights not only help improve the plugin but also assist in showcasing real-world applications to the community.

Screen recording tools like Loom make it easy to record and share screencasts. If you create on of these screencasts, please share it with the community. I try to re-share this type of content on all of my available channels as much as possible. 

## Content & Resources
- Videos added to README
- SC Backlinks (third-party content)
## Under the hood
- [x] Local models
- [ ] Dependencies listed in SC Readme
	- [ ] first-party
	- [x] third-party
- [x] Themes & Styles
### Local Models
- Local models are an important development because they enable utilizing AI without sending potentially sensitive data to third-party providers like OpenAI.
- Smart Connections `v2.0` introduced built-in local embedding models. Built-in models are easy-to-use and do not require installing or configuring third-party software. The default embedding model for new users is a local model.
- Smart Connections `v2.1` introduced advanced chat model configurations so that the Smart Chat to can utilize local chat models running locally.
### Dependencies
*Minimizing dependencies has been a key principle in the development of Smart Connections.* 
##### First-party Dependencies
These are modules that I developed with the same principle of minimizing dependencies.
- [ ] DO: Introduction to Smart Modules
	- [ ] SmartCollections
	- [ ] SmartEmbed
	- [ ] SmartChat
	- [ ] SmartChunks
	- [ ] SmartEntities
##### Third-party Dependencies
- `ejs`: a template engine used for rendering UI components
	- Uses `ejs.min`, benefiting from being a minimized, standalone file that removes unnecessary dependencies like `fs`.
- `transformer.js`: a library for running AI models by Hugging Face
	- This is *not* bundled by default and is only used if you are using local models.
	- This dependency is loaded within an iframe which "sandboxes" the code.  
### Themes & Styles
Styles are designed to inherit from the user's theme whenever possible.

## Developers  
- Benefits of using Smart Connections embeddings in your plug-in
	- lowers cost for users
		- prevents being double charged for API embeddings
		- reduces processing times for local embeddings
	- reduce development time
- Smart Connections search can be accessed via the window
	- `window['SmartSearch'].search(text, filter={})`
	- more details will be provided in the future
		- until then, I encourage you to create an issue with your desired use case and I will to help with guidance through the development process.
## Commercial use
*Businesses and other organizations are welcome to use Smart Connections. In the near future, Smart Connections will follow suit with Obsidian and provide a special commercial license for business users.*
## About the Author  
- [ ] TODO
## Supporter License Clarification
- [ ] TODO