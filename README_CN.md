# 🧩 Smart Connections: AI驱动的笔记关联插件 `v2.3`

减少花在**链接**、**打标签**和**整理**上的时间， 因为 Smart Connections 会自动找到相关笔记

- 支持本地Chat模型，如通过 Ollama、LM Studio 运行的 Llama 3 等多种模型。
- 支持数百种 API 模型，包括 Anthropic 的 Claude、Google的 Gemini、OpenAI 的 GPT-4o。
- 支持本地嵌入(embedding)模型。
- 支持将**聊天保存为笔记**（Markdown格式）和画布（Canvas还处于早期发布阶段）。
- 查看 [用户评价](#user-testimonials)。


> [!TIP]
> 加入下一次的[Lean Coffee session](https://lu.ma/calendar/cal-ZJtdnzAdURyouM7) 讨论未来的功能和改进。

Hey there, 我是 Brian, Smart Connections 的创造者（仍然是一个人类，至少现在还是 🤪）。我喜欢开自己的玩笑，喜欢使用表情符号，喜欢思考。

Smart Connections 是一个由用户支持的使命驱动软件。它是由个人设计，旨在增强个人能力，帮助你实现目标并实现你的愿景。关注 [@wfhbrian](https://x.com/wfhbrian) 获取功能预览和其他关于开发 Smart Connections 过程的更新。

![Easy to install and use](./assets/smart-connections-install.gif)
![Easy to install and use](./assets/using-smart-connections.gif)

> [!NOTE]
> 开始使用 AI:
> - 对技术文档不感兴趣？使用 [Smart Guide GPT](https://chatgpt.com/g/g-681225c25d188191a356a73e7ab6da0b-smart-guide) 获取个性化帮助。
> 
> 文档网站:
> - [入门指南](https://docs.smartconnections.app/Smart-Connections/Getting-started)
>- [连接看板](https://docs.smartconnections.app/Smart-Connections/Connections-pane-filters)
>- [连接看板过滤器](https://docs.smartconnections.app/Smart-Connections/Connections-pane)
>- [查找看板](https://docs.smartconnections.app/Smart-Connections/Lookup-pane)
>- [智能聊天](https://docs.smartconnections.app/Smart-Connections/Smart-Chat)

## 简短的历史介绍
Smart Connections 的发展历程是我与你直接分享的故事。它不仅仅是 Obsidian 的一个新功能，更是我们共同经历、你宝贵反馈的结晶，也是 Obsidian 社区合作成果的见证。这个旅程既激动人心，也极具教育意义。

Obsidian 并不是我管理笔记的第一次尝试。
2022 年末，我在 Obsidian 中建立的系统开始崩溃，笔记太多，整理、链接、标记的时间不够……Smart Connections 最初是我为管理成千上万的笔记、防止重复劳动、通过智能视图显示相关笔记/摘录来建立新联系的工具。

发布不久后，社区看到了 Smart Chat 的潜力，现在你可以用同样的技术与笔记对话。

从此，Smart Connections 社区一直积极参与测试、提出新功能建议、解决问题，并支持我投入更多时间开发这款赋能个人的 AI 软件！

## 使命
Smart Connections 不只是技术，更是社区、协作和提升笔记体验的共同旅程。以下简述其动机及用户真情反馈。
Smart Connections 致力于为个人打造 AI 技术，强调易用性和社区驱动开发。与许多以企业利益为先的工具不同，Smart Connections 是开源、用户支持的软件，旨在让先进技术惠及每个人。

开源存在已久，但过去十年，开源的主要受益者逐渐从个人转向企业，这在众多风投支持的“开源”项目中可见一斑。
相比之下，Smart Connections 设计为面向个人，强调对非技术用户的可访问性，且由用户直接资助。

> "I believe that open-source software that serves individuals directly, like Smart Connections, is one of the best ways we can ensure equitable access to AI-provided opportunities."
> "我相信，像 Smart Connections 这样的直接服务于个人的开源软件，是确保人人平等获得 AI 机会的最佳途径之一"
> 🌴 Brian

## 亮点介绍
Smart Connections 不仅是一个插件，更是连接你在 Obsidian 中的思想、笔记和洞见的桥梁，让信息管理变得无缝且直观。以下是它的亮点:

### Smart View: 利用AI发现最相关的笔记
智能视图根据你当前的笔记动态实时推荐相关笔记，利用 AI 嵌入技术根据上下文显示相关内容，提升创造力和生产力，发现你可能未察觉的联系。

![和当前笔记最相关的笔记会在顶部展示](./assets/SCv2-Smart-View-light.gif)

### Smart Chat: 利用AI和你的笔记对话
直接和你的笔记对话，让你的笔记变得更有趣。”不管是头脑风暴、查找资料，还是用新角度翻看笔记，智能聊天都能帮你轻松搞定。

![基于你的obsidian笔记回答"我是谁"这样的问题](./assets/smart-connections-chat-who-am-i.gif)

*支持的AI模型列表如下*

## 用户评价
使用 Smart Connections 的人们的真实反馈，让我们看到了它对个人工作流程和创造力的巨大影响。

以下是一些他们的评价：
- "Smart Connections 对我管理几十年散乱笔记、日志等过程是革命性的。期待它不断进化。" - Ronny
- ["我发现了这个插件就不在使用Mem了"](https://discord.com/channels/686053708261228577/694233507500916796/1091164112425320538)
- ["我是因为这个插件才开始使用obsidian"](https://github.com/brianpetro/obsidian-smart-connections/issues/441#:~:text=I%20actually%20decided%20to%20start%20using%20Obsidian%20BECAUSE%20of%20Smart%20Connections.)
- - [让我借此机会说一句，你开发的这个插件真是太棒了，彻底改变了我使用笔记的方式。](https://github.com/brianpetro/obsidian-smart-connections/issues/592#issuecomment-2104332746:~:text=Let%20me%20take%20the%20opportunity%20to%20say%20what%20a%20brilliant%20plug%20in%20you%20have%20created%20it%20has%20completely%20transformed%20the%20way%20I%20am%20able%20to%20use%20notes)  
- [我已经能看出这将彻底改变我的研究和个人笔记整理方式。](https://github.com/brianpetro/obsidian-smart-connections/issues/589#issuecomment-2104948387:~:text=I%20can%20already%20see%20this%20will%20be%20a%20game%2Dchanger%20for%20my%20research%20and%20personal%20note%2Dtaking.)  
- [嗨 Brian，你开发了 Obsidian 最强大的插件之一，代表所有 Obsidian 用户，真心感谢你！它让我们的生活更轻松、更有创造力 ❤️](https://www.youtube.com/watch?v=tGZ6J63UZmw&lc=UgwRE_J-yZ5QVC6b6yJ4AaABAg)  
- [非常感谢你和这个出色的插件。](https://www.youtube.com/watch?v=tGZ6J63UZmw&lc=UgzgQhv2CA0easzk7np4AaABAg)  
- [“这是一个极具变革性的实用插件。”](https://github.com/brianpetro/obsidian-smart-connections/issues/329#issuecomment-2002162224:~:text=This%20is%20such%20a%20game%2Dchangingly%20helpful%20plugin)  
- [“这个插件已经成为我生活中不可或缺的一部分。”](https://github.com/brianpetro/obsidian-smart-connections/issues/120#issuecomment-1492842117:~:text=This%20plugin%20has%20become%20a%20vital%20part%20of%20my%20life)  
- [“这是我迄今为止最喜欢的 Obsidian 插件，帮了我大忙。我还准备做个完整视频讲如何用它做博士研究。”](https://github.com/brianpetro/obsidian-smart-connections/discussions/371#discussioncomment-7977910:~:text=This%20is%20by%20far%20my%20favourite%20Obsidian%20plug%2Din%20and%20it%20is%20immensely%20helpful.%20I%27ll%20be%20doing%20a%20full%20video%20about%20using%20it%20for%20PhD%20research)  
- [“它在处理科学研究和论文方面的能力令人惊讶。”](https://github.com/brianpetro/obsidian-smart-connections/issues/250#issuecomment-1595108987:~:text=It%27s%20astonishing%20the%20power%20it%20provids%20to%20deal%20with%20scientific%20research%20and%20scientific%20articles%20included%20in%20the%20vault.)  
- [“Smart Connections 绝对是我最喜欢的前三大插件之一，彻底改变了我使用 Obsidian 的方式，非常感谢。”](https://github.com/brianpetro/obsidian-smart-connections/issues/64#issuecomment-1484212168:~:text=Smart%20connections%20is%20easily%20in%20my%20Top%203%2C%20it%20changes%20radically%20the%20use%20of%20the%20Soft%2C%20many%20thanks%20for%20that.)  
- [“[Smart Connections] 大大改变了我管理个人知识库的方式。”](https://discord.com/channels/686053708261228577/710585052769157141/1091163849190801468)  
- [“这是个超棒的小插件，谢谢分享。”](https://forum.obsidian.md/t/introducing-smart-chat-a-game-changer-for-your-obsidian-notes-smart-connections-plugin/56391/8?u=wfh#:~:text=This%20is%20an%20AWESOME%20little%20plugin.%20Thanks%20for%20sharing.)  
- [“顺便说声谢谢。自从90年代读到 Tad Starner 的记忆代理后，我一直想要这样的功能！而这个插件甚至更棒。”](https://github.com/brianpetro/obsidian-smart-connections/issues/47#issuecomment-1471441869:~:text=Hopping%20on%20to%20also%20say%20thanks.%20I%20have%20been%20wanting%20this%20feature%20in%20something%20ever%20since%20reading%20about%20tad%20starners%20remembrance%20agent%20in%20the%2090s!%20And%20this%20is%20even%20better.)  
- [“用你的聊天插件搜索笔记和获取洞见真是太有趣了。”](https://github.com/brianpetro/obsidian-smart-connections/issues/57#:~:text=Hi%2C-,I%27m%20having%20so%20much%20fun%20using%20your%20chat%20plugin%20to%20search%20my%20notes%20better%20and%20get%20insights,-.%20I%20was%20just)  
- [“毫无疑问，这是一个极好的插件，显著提升了我们与笔记互动的方式。”](https://github.com/brianpetro/obsidian-smart-connections/pull/219#issuecomment-1562572364:~:text=This%20is%20undoubtedly%20an%20excellent%20plugin%20that%20makes%20a%20significant%20improvement%20in%20how%20we%20interact%20with%20our%20notes.)  
- “我一直在用 Smart Connections 配合 Obsidian，效果很棒，发现了越来越多的用法。我对能用本地嵌入模型特别感兴趣。” - Eamonn  
- “我是 Smart Connections 的超级粉丝，还写了一篇文章介绍我如何用它大幅节省法律案例摘要的时间（还讲了我的工作流程和其他工具，但特别提到了 SC）。” - Carey  
- “我很喜欢 Smart Connections 的最新版本，刚用它做了个超棒的案例：用 Obsidian 笔记帮我准备年度绩效评估。” - Jarrett  
- “感谢你们的出色工作--我是一名表演者和声音艺术家，你们的插件帮我最大化利用 Obsidian，建立各种有价值的联系。” - Adrienne  
- “我正在写书，这个插件在过程中帮了大忙。” - Michael  
- “喜欢这个插件！我一直在用，还为我的社区做了一个网络研讨会。” - Alex  
- “我每天都用你的应用。我是产品经理，有一个产品知识库，写作和做用户故事时经常参考。” - Todd  
- “说句私心话，要是我读博士时能用上这样的工具该多好！” - Mikey

<details><summary>更多关于 Smart Connections 的正面评价 😊</summary>

- “Smart Connections 真的是今年最棒的新插件。请继续加油！” - Larry  
- “Brian，你干得真棒。Smart Connections 是有史以来最好的 Obsidian 插件。” - Es  
- “我真的很喜欢这个应用。它让我不用买 Mems，继续用 Obsidian。” - Greg  
- “感谢你开发了 Smart Connections。我每天都在用，它彻底改变了游戏规则。” - Joe  
- “很高兴看到你在新年对 Smart Connections 的更新。谢谢你无私的付出。” - 嘿然笑道  
- “喜欢这个应用！V2 看起来也有超棒的功能。继续保持出色的工作。” - Austin  
- “我想表达对 Smart Connections 的支持，也希望能提前体验 2.0 版本，并尽我所能帮忙。谢谢！” - Danny  
- “很棒的插件，我把它当作标准的右侧面板使用。” - Guenter  
- “我相信这是 Obsidian 最好的插件之一！” - Viktor  
- “感谢这个出色的插件，我一定要投票支持 :)” - Marc  
- “祝插件开发顺利，做得很棒！” - Harpreet  
- “再次感谢你这款惊人的插件。” - Eduardo  
- “嘿，谢谢你带来这么棒的应用。” - Robert  
- “Smart Connections 是个非常棒的程序，我期待着使用 2.0 版本。” - Jarrett  
- “继续加油 ♡” - Duke  
- “真是个了不起的插件，谢谢你让我的笔记更有活力！” - Simon  
- “感谢这个插件！看起来很有潜力，我还在继续探索。” - Damien  
- “非常感谢你打造这么流畅的工具，期待它的未来发展！” - Khael  
- “谢谢你带来这么棒的工具！” - Pablo  
- “继续保持好工作 :-)" - Dorian  
- “感谢你为 Smart Connections 所做的努力，期待 2.0。” - Eli  
- “我非常喜欢你们的工作，迫不及待想看这个插件明年如何继续成长！” - Ryan  
- “你太厉害了！” - Chad  
- “干得漂亮，Brian。Smart Connections 真棒！” - Arne  
- “非常感谢你为这款工具付出的努力！” - Marcelo  
- “顺便说一句，感谢这个出色的插件。” - Ali  
- “感谢这个插件！它真的帮了我很多 :)” - Jordan  
- “我刚开始用，但到目前为止很喜欢！” - Nick  
- “感谢你为 Smart Connections 所做的一切。” - Ed  
- “这是我最有用的前三个插件之一。” - Mickaël  
- “感谢你的辛勤付出。--来自韩国” - 오송인  
- [“我非常喜欢这个扩展，潜力巨大。”](https://github.com/brianpetro/obsidian-smart-connections/issues/48#issuecomment-1459929611:~:text=I%20love%20this%20extension%0Aso%20much.%20So%20many%20potential%20features%20by%20the%20way.)  
- [“这个插件棒极了。”](https://github.com/brianpetro/obsidian-smart-connections/issues/47#:~:text=This%20plugin%20is%20fantastic)  
- [“这是个绝妙的想法。”](https://github.com/brianpetro/obsidian-smart-connections/issues/54#:~:text=This%20is%20a%20terrific%20idea)  
- [“这个插件可能是个游戏规则改变者！”](https://github.com/brianpetro/obsidian-smart-connections/issues/54#:~:text=This%20plugins%20could%20be%20a%20Game%20changer!)  
- [“我个人很喜欢这个应用。”](https://old.reddit.com/r/ObsidianMD/comments/11s0oxb/chat_with_your_notes_now_available_in_the_smart/jcd73y8/?context=3#:~:text=I%20personally%20love%20the%20app)  
- [“这个应用真的是个游戏规则改变者。”](https://github.com/brianpetro/obsidian-smart-connections/discussions/203#discussioncomment-5854265:~:text=This%20app%20is%20such%20a%20game%20changer.)  
- [“完全爱上这个插件。”](https://github.com/brianpetro/obsidian-smart-connections/issues/202#issue-1702708828:~:text=Absolutely%20LOVE%20this%20plugin.)  
- [“Smart Connections 是个很棒的插件。”](https://github.com/brianpetro/obsidian-smart-connections/issues/280#issuecomment-1630047763:~:text=Smart%2Dconnections%20is%20a%20fantastic%20plugin)  
- [“嗨，太棒的插件！🔥”](https://github.com/brianpetro/obsidian-smart-connections/issues/57#issuecomment-1488187361:~:text=Hi%2C%20amazing%20plugin,%F0%9F%94%A5)  
- [“简直令人震惊。”](https://twitter.com/micka_dore/status/1641527570867822615?s=20)  
- [“我喜欢这个插件。”](https://github.com/brianpetro/obsidian-smart-connections/issues/496#issuecomment-1996755512:~:text=interest%20of%20course.-,I%20love%20this%20plugin,-.)  
- [“现在它帮我头脑风暴潜在的联系，过去几个月我看到很大进步。我特别喜欢用它来整理和关联书籍内容。”](https://old.reddit.com/r/ObsidianMD/comments/11s0oxb/chat_with_your_notes_now_available_in_the_smart/jcczwiq/?context=3#:~:text=Now%20it%20serves%20me%20as%20a%20way%20to%20brainstorm%20potential%20connections%2C%20and%20I%20have%20seen%20major%20improvements%20over%20the%20past%20few%20months.%20I%20especially%20enjoy%20using%20it%20as%20part%20of%20my%20book%20digestion%20and%20relation%20process.)  
- [“这真是个令人难以置信的插件！”](https://github.com/brianpetro/obsidian-smart-connections/issues/244#issuecomment-1595765101:~:text=this%20is%20just%20such%20an%20incredible%20plugin)  
- [“试了，效果和我预期的一样好！谢谢你开发这个。”](https://old.reddit.com/r/ObsidianMD/comments/11s0oxb/chat_with_your_notes_now_available_in_the_smart/jcdpwsg/?context=3#:~:text=Tried%20it%2C%20and%20it%20worked%20as%20well%20as%20I%20could%20hope!%20Thanks%20for%20making%20this.)  
- [“这是个了不起的扩展。”](https://github.com/brianpetro/obsidian-smart-connections/issues/32#issuecomment-1435798970:~:text=This%20is%20an%20amazing%20extension.)  
- [“这真酷...”](https://twitter.com/rcvd_io/status/1638271532932780035?s=20)  
- [“这是个了不起的插件！”](https://github.com/brianpetro/obsidian-smart-connections/issues/20#:~:text=This%20is%20an%20amazing%20plugin!)  
- [“有了 Smart Connections，只要打开一个笔记，我就能找到所有引用这个概念的其他笔记。”](https://discord.com/channels/686053708261228577/694233507500916796/1091167414865109012)  
- [“它有巨大的潜力，能帮你发掘很多可以添加到你的知识库的新信息。”](https://github.com/brianpetro/obsidian-smart-connections/issues/19#issue-1533699525:~:text=has%20amazing%20potential%20to%20unlock%20lots%20of%20new%20info%20that%20can%20be%20added%20to%20your%20vault)  
- [“很棒的插件！”](https://github.com/brianpetro/obsidian-smart-connections/issues/1#issue-1511238131:~:text=Dec%2026%2C%202022-,Great%20plugin!,-My%20request%20is)  
- [“到目前为止很喜欢这个插件！”](https://github.com/brianpetro/obsidian-smart-connections/issues/2#issue-1511288845:~:text=Loving%20the%20plugin%20so%20far!)  
- [“Smart Connections 真酷。我发现它能识别内容相似但用词不同的笔记。”](https://discord.com/channels/686053708261228577/694233507500916796/1065057689949982870#:~:text=Smart%20Connections%20plugin%3F%20It%27s%20so%20cool.%20I%27m%20noticing%20similarities%20between%20notes%20that%20talk%20about%20the%20same%20thing%20but%20don%27t%20share%20any%20words.)  
- [“感谢你做了这个。我喜欢让 OpenAI 帮我在笔记中寻找联系的想法。”](https://github.com/brianpetro/obsidian-smart-connections/issues/47#issue-1609765217:~:text=Thanks%20for%20doing%20this.%20I%20love%20the%20idea%20to%20have%20OpenAI%20help%20look%20through%20my%20notes%20to%20find%20connections.)
</details>

[Even more love for Smart Connections 🥰](https://smartconnections.app/smart-connections-love/)
  

## 原理实现

Smart Connections 利用先进的 AI 技术来分析并连接你在 Obsidian 中的笔记。以下是该插件的工作原理概述：

### 创建 embeddings
- 当你首次安装 Smart Connections 时，它会处理你所有的笔记，生成“嵌入向量”--即对笔记内容的数值化表示。
- 这些嵌入向量会被存储在你笔记库中的一个隐藏文件夹 `.smart-env`。
- 插件会通过文件的修改时间来判断是否需要重新处理某条笔记，从而保证效率。

## 安装指南
开始使用 Smart Connections 很简单。只需从 Obsidian 社区插件中安装 Smart Connections，就能体验 AI 助力的笔记功能，提升你的 Obsidian 使用体验。

### 从obsidian社区插件安装
![](./assets/obsidian-community-smart-connections-install.png)

## 设置
### 默认设置
##### Local embedding models
本地嵌入模型让你在不将数据发送给第三方处理的情况下，依然能充分利用 Smart Connections 的强大功能。



`BGE-micro-v2` 是一个体积小且可靠的本地嵌入模型。
这意味着 Smart Connections 开箱即用--无需 API 密钥、额外软件或复杂设置！

### 额外设置
#### 文件/文件夹排除
你可以排除特定的文件或文件夹，不让 Smart Connections 处理它们。这对于忽略无关或敏感信息非常有用。

#### 更换AI模型
Smart Connections 支持多种 AI 模型用于嵌入和聊天。你可以在插件设置中更换这些模型，以满足你的需求和偏好。

##### OpenAI API Key
- 如果你选择使用 OpenAI 的模型，需要提前购买 API 积分。

## 功能介绍

### Smart View
Smart View 根据你当前的笔记实时提供相关笔记建议。

![Demo showing Smart View results changing based on the current note](./assets/SCv2-Smart-View-dark.gif)

##### 访问Smart View中的笔记
- 点击结果即可打开笔记
- 使用展开/折叠按钮（位于每个结果左侧）预览连接
- 展开/折叠所有功能（显示在下方）

![该功能可以显示或隐藏笔记内容，让你在 Smart View 中更灵活地浏览相关笔记。点击折叠按钮即可收起笔记内容，点击展开按钮则显示详细内容，帮助你快速聚焦或查看笔记细节w](./assets/SCv2-fold-unfold.gif)

##### Smart View搜索
点击搜索图标输入搜索查询。
- 注意：嵌入搜索（语义）并不像传统的关键词搜索（词法）那样工作。

### Smart Chat
当你在对话中输入“我的笔记”等自指代代词时，笔记会被检索并作为上下文使用。

##### ChatMD (new in `v2.1`)
聊天历史被保存为每个对话的新笔记。
###### `sc-context`代码块
- 防止在聊天历史中重复使用笔记作为上下文
- 渲染一个包含笔记或摘录的Smart View

##### chat models
![Access model settings in the Smart Chat](./assets/smart-chat-settings.png)
###### v2.1 (current)
- OpenAI
	- `GPT-4o` (128K)
	- `GPT-4-turbo` (128K)
	- `GPT-4` (8K)
	- `GPT-3.5-turbo` (16K)
- Google
	- `gemini-1.0-pro` (30K)
	- `gemini-1.5-pro-latest` (1MM)
- Anthropic
	- `claude-3-opus` (200K)
	- `claude-3-sonnet` (200K)
	- `claude-3-haiku` (200K)
- OpenRouter
	- `llama-3-70b`
	- *太多模型，这里就不列了*
- Cohere
	- `command-r` (128K)
	- `command-r-plus` (128K)
- Custom Local
	- Ollama
	- LM Studio
- Custom API
### 随机一篇笔记
跳转到一篇不太随机的笔记。
- 限制可能的随机笔记为当前笔记的 Smart Connections。
- 打开到笔记中的特定部分。
### 找到一篇笔记
- Section 'Block' Matching
	- 块匹配功能描述
- Highlight to Find Smart Connections
	- 使用高亮文本查找 Smart Connections
- Smart Chat
	- 与笔记的对话
	- 信息检索和探索
- 使用 AI 与笔记进行交互  
- 如何工作  
- 功能（GPT-4 支持，上下文感知响应等）  
- 优点和限制  
### 动态代码块
- 专门用于显示相关连接的部分  
- 如何使用动态代码块
	- Section 'block' matching  
	- Highlight to find Smart Connections
### 笔记与块级 Smart Connections
[Smart Connections 中的笔记级嵌入（Note-Level Embeddings）与区块级嵌入（Block-Level Embeddings）：有什么区别？](https://youtu.be/9YG8gwihz3Q)
### 通知和进度指示器
- 静音通知

## 配套插件

### Smart Connections Visualizer (智能连接可视化器)

[![Visualizer](./assets/SCViz.png)](https://www.youtube.com/watch?v=dbFRyJBkxS0)
这个 [开源插件](https://github.com/Mossy1022/Smart-Connections-Visualizer) 无缝集成到 Smart Connections 中，提供了一种先进、交互式的可视化连接方式。目的是增强你发现笔记中关系和见解的能力，同时改变你与信息互动和理解的方式。未来将添加更多功能。Evan Moscoso 是这个插件的开发者。  

[Demo展示](https://www.youtube.com/watch?v=dbFRyJBkxS0)

[安装智能连接可视化器](https://obsidian.md/plugins?id=smart-connections-visualizer)

## 文件类型兼容性
- Markdown
- Obsidian Canvas
- PDFs (coming soon!)


## 加入我们的社区
你的参与对于 Smart Connections 的发展至关重要。从解决问题的过程中，到添加新功能或分享你独特的使用方法，每一份贡献都丰富了我们的社区，并推动了项目的发展。

有许多方式可以为 Smart Connections 项目做出贡献，我们重视所有形式的贡献。无论你是在帮助解决问题的过程中，添加新功能，还是分享你如何使用 Smart Connections 来激励他人，你的支持都是推动这个项目发展的关键。

- [Public Discussions on GitHub](https://github.com/brianpetro/obsidian-smart-connections/discussions)
### 如何贡献（非技术）
贡献到项目并不需要是技术性的。事实上，Smart Connections 最大的需求之一是非技术性的。创建内容展示你如何使用 Smart Connections 不仅有助于开发，而且有助于现有和潜在用户更好地理解他们如何从利用 AI 中受益，从而创造出超越这个项目的影响。
##### Screencasts
通过视频测试展示你如何使用 Smart Connections 是非常宝贵的。这些见解不仅有助于改进插件，而且有助于向社区展示实际应用。

使用像 Loom 这样的屏幕录制工具，可以轻松录制和分享视频测试。如果你创建了这样的视频测试，请与社区分享。我尽可能多地分享这类内容。

## 内容和资源
- 添加到 README 的视频
- SC 反向链接（第三方内容）

## Smart Connections 架构
深入了解 Smart Connections 的架构，设计时考虑了效率和用户利益。关键设计原则包括：
- 最小化外部依赖，以便轻松审计代码
- 开箱即用，最大化易用性
- 模块化开源组件，可用于其他项目
### 本地模型
- 本地模型是一个重要的发展，因为它们使在不将潜在敏感数据发送给第三方提供商（如 OpenAI）的情况下利用 AI 成为可能。
- Smart Connections `v2.0` 引入了内置的本地嵌入模型。内置模型易于使用，不需要安装或配置第三方软件。新用户的默认嵌入模型是本地模型。
- Smart Connections `v2.1` 引入了高级聊天模型配置，使 Smart Chat 可以利用本地运行的聊天模型。
### 依赖
*最小化依赖一直是 Smart Connections 开发的关键原则。*
##### 第一方依赖
这些是我开发时遵循相同原则的模块。
- [`smart-environment`](https://github.com/brianpetro/jsbrains/tree/main/smart-environment)
- [`smart-collections`](https://github.com/brianpetro/jsbrains/tree/main/smart-collections)
- [`smart-entities`](https://github.com/brianpetro/jsbrains/tree/main/smart-entities)
- [`smart-sources`](https://github.com/brianpetro/jsbrains/tree/main/smart-sources)
- [`smart-blocks`](https://github.com/brianpetro/jsbrains/tree/main/smart-blocks)
- [`smart-chat-model`](https://github.com/brianpetro/jsbrains/tree/main/smart-chat-model)
- [`smart-embed-model`](https://github.com/brianpetro/jsbrains/tree/main/smart-embed-model)
##### 第三方依赖
- `transformer.js`: a library for running AI models by Hugging Face
	- 该库默认**不包含**，仅在使用本地模型时才会加载。
	- 该依赖会在 iframe 中加载，从而实现**代码的沙箱隔离**。
### 主题和样式
样式设计尽可能继承用户的主题。

## 常见问题排查

### 嵌入过程不断重启或很慢
- 这不是正常行为。首先，尝试在设置中切换到可靠的 BGE-micro 嵌入模型。
- 如果问题仍然存在，请检查开发者控制台中的任何错误消息，并分享错误截图以获得进一步帮助。

### OpenAI API 错误
- 确保你在 OpenAI 账户中预先支付了 API 积分。OpenAI 最近改变了他们的计费系统，要求预先支付积分。
- 检查你在 Smart Connections 设置中输入的 API 密钥是否与添加积分到的账户匹配。嵌入和聊天分别有独立的 API 密钥设置。
- 分享开发者控制台中特定 API 错误的截图以获得更针对性的故障排除帮助。

最快支持，请始终包含截图，尤其是开发者控制台中的任何错误（View -> Toggle Developer Tools）。搜索 GitHub 上的现有问题也是解决 Obsidian 插件问题的推荐方法。
- [Report an issue on GitHub](https://github.com/brianpetro/obsidian-smart-connections/issues)

## 开发者
- 使用 Smart Connections 嵌入的优点
	- 降低用户成本
		- 防止被双重收取 API 嵌入费用
		- 减少本地嵌入的处理时间
	- 减少开发时间
- Smart Connections 搜索可以通过 window 访问
	- `window['SmartSearch'].search(text, filter={})`
	- 未来将提供更多细节
		- 在此之前，我鼓励你创建一个你想要使用的情况的问题，我会帮助你通过开发过程进行指导。
## Supporter License Clarification
- [ ] TODO

<details><summary>Testimonials from Smart Connections Supporters 😊</summary>

- [我成为 Smart Connections 支持者的原因是] “我喜欢支持那些背后有真实创意和愿景团队的项目。我喜欢开发者和维护者敢于直言问题和改进需求。而且这是一个很棒的插件。”  
- [我成为 Smart Connections 支持者的原因是] “我最初接触个人知识管理和 Obsidian 是因为《打造第二大脑》这本书。ChatGPT 火起来时，我想‘如果能用它来训练我的笔记该多好？’当我发现 Smart Connections 时，我知道它会改变我的生活方式。”  
- [我成为 Smart Connections 支持者的原因是] 利用我庞大的 Obsidian 笔记库结合 ChatGPT 的能力，以及我在 1.x 版本中获得的出色体验。  
- [我成为 Smart Connections 支持者的原因是] 支持本地嵌入模型和优质的界面设计。  
- [我成为 Smart Connections 支持者的原因是] 看好 Smart Connections 的未来潜力。  
- [我成为 Smart Connections 支持者的原因是] 这是我见过的最好的 GPT 与 Obsidian 集成。  
- [我成为 Smart Connections 支持者的原因是] Smart Connections 很棒。  
- [我成为 Smart Connections 支持者的原因是] 我觉得这个 Obsidian 插件很有帮助。  
- [我成为 Smart Connections 支持者的原因是] 这是一个非常实用的插件。  
- [我成为 Smart Connections 支持者的原因是] 我看到了这个工具的潜力，想支持它的加速开发。  
- [我成为 Smart Connections 支持者的原因是] 它是最好的 Obsidian 插件。  
- [我成为 Smart Connections 支持者的原因是] 想看看它是否适合我的研究。  
- [我成为 Smart Connections 支持者的原因是] 绝对是最棒的 ChatGPT 和 Obsidian 集成。  
- [我成为 Smart Connections 支持者的原因是] 很棒的产品；了解嵌入式/微调大型语言模型的工作原理；能与 Brian 及其他支持者互动。  
- [我成为 Smart Connections 支持者的原因是] 我真的很喜欢这个插件，迫不及待想看到接下来的更新！  
- [我成为 Smart Connections 支持者的原因是] 看到了 ChatGPT 和 Obsidian 结合的无限可能。  
- [我成为 Smart Connections 支持者的原因是] 能够和我的 Obsidian 笔记库对话，以及将 ChatGPT 连接到我的笔记库的能力。  
- [我成为 Smart Connections 支持者的原因是] 想看看这个项目的发展。我以前有很多 Obsidian 笔记，但“挖掘”它们太费劲了，希望借此重新整理笔记库再试一次。  
- [我成为 Smart Connections 支持者的原因是] 这个软件太棒了！  
- [我成为 Smart Connections 支持者的原因是] 想充分利用 ChatGPT 来使用我的笔记库。  
- [我成为 Smart Connections 支持者的原因是] 我很看重你们的工作，想支持你们继续下去。  
- [我成为 Smart Connections 支持者的原因是] 很棒的产品，我很喜欢。我是软件开发和市场营销人员，喜欢 AI 和自动化。  
- [我成为 Smart Connections 支持者的原因是] 我本来想自己做一个，但你们帮我做了，而且比我用前端技能做得更好。谢谢！  
- [我成为 Smart Connections 支持者的原因是] 想支持开发，这是个很棒的工具，特别是连接功能非常快。  
- [我成为 Smart Connections 支持者的原因是] 我认为这个插件跟生成式 AI 的发展趋势非常契合。它已经是我在 Obsidian 中用得最多的插件，是我个人知识管理的首选应用。虽然现在功能还不够完善，但我看好它的未来。  
- [我成为 Smart Connections 支持者的原因是] 能够测试 Ollama，并感谢这里所做的工作。谢谢。  
- [我成为 Smart Connections 支持者的原因是] 我喜欢它流畅的界面、集成和整体愿景。  
- [我成为 Smart Connections 支持者的原因是] 这是一个了不起的工具，能对我的研究和生活产生真正影响。  
- [我成为 Smart Connections 支持者的原因是] 我非常喜欢这个插件，想尽快体验你们接下来的计划。  
- [我成为 Smart Connections 支持者的原因是] 支持这个项目。  
- [我成为 Smart Connections 支持者的原因是] 我一直在用这个工具，觉得值得支持。而且我希望能提出一些改进建议 :D  
- [我成为 Smart Connections 支持者的原因是] 想使用智能聊天功能，这对我来说很新鲜也很有趣。  
- [我成为 Smart Connections 支持者的原因是] 个人知识管理对个人和社会都有重大影响，你们的工作很有价值。  
- [我成为 Smart Connections 支持者的原因是] 这是一个我非常感兴趣的项目，想支持 Brian 和他所有的出色工作。  
- [我成为 Smart Connections 支持者的原因是] 提升我的工作流程价值。  
- [我成为 Smart Connections 支持者的原因是] 支持这个事业。  
- [我成为 Smart Connections 支持者的原因是] 我是 ChatGPT 的重度用户，能从 Obsidian 访问我的笔记太棒了。  
- [我成为 Smart Connections 支持者的原因是] 它看起来很有趣，我想用完整功能对比它和 Copilot。  
- [我成为 Smart Connections 支持者的原因是] 我想能向 ChatGPT 询问我的 Obsidian 笔记库内容。  
- [我成为 Smart Connections 支持者的原因是] Smart Connections 很棒，值得支持 :) 希望我的支持能推动完全转向本地模型（包括响应），随着它们变得更强大。请增加本地 Mistral 模型支持以响应提示。  
- [我成为 Smart Connections 支持者的原因是] 我是一名博士研究生，一直用 Smart Connections 做研究。感谢你们开发这个应用！  
- [我成为 Smart Connections 支持者的原因是] 我热爱你们的工作。  
- [我成为 Smart Connections 支持者的原因是] 1 版本对我来说是个游戏规则改变者，能支持你们的项目我很激动，也非常感谢你们的产品。  
- [我成为 Smart Connections 支持者的原因是] ChatGPT 集成：你们是个人用户“聊天你的数据”领域唯一的有力竞争者。  
- [我成为 Smart Connections 支持者的原因是] 这正是我想要的。原本打算花几个月学编程自己做，现在已经完成了！  
- [我成为 Smart Connections 支持者的原因是] 因为我喜欢做 Smart Connections！  
- [我成为 Smart Connections 支持者的原因是] 我想把 GPT 系统集成到我的笔记中。  
- [我成为 Smart Connections 支持者的原因是] Obsidian 与 OpenAI 的集成。  
- [我成为 Smart Connections 支持者的原因是] 我想和我的笔记内容对话，并从中创建新闻通讯和其他内容。  
- [我成为 Smart Connections 支持者的原因是] 你们工作的质量和 ChatGPT 集成。  
- [我成为 Smart Connections 支持者的原因是] 利用 Obsidian 笔记在 GPT 中的价值。  
- [我成为 Smart Connections 支持者的原因是] 我觉得 AI 帮我整理零散的思绪非常有价值，想支持这方面的努力。  
- [我成为 Smart Connections 支持者的原因是] 希望实现与 Obsidian 和自定义 GPT 的无缝集成功能。  
- [我成为 Smart Connections 支持者的原因是] 想支持开发。
</details>


## 商业使用
*企业和其他组织欢迎使用 Smart Connections。未来不久，Smart Connections 将效仿 Obsidian，为商业用户提供专门的商业许可证。*

## 认识开发者

Smart Connections 背后有一个愿景，那就是改变我们与笔记和数据的互动方式。了解更多关于 Smart Connections 开发者 Brian 的故事，以及他打造这款创新工具的历程。l:

- [ ] TODO
- [Brian on Founderoo](https://www.founderoo.co/posts/smart-connections-brian-petro)
