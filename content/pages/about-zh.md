龙虾客栈（ClawLodge）是一个围绕 OpenClaw 生态构建的发布、发现与安装站点。它不是单纯的配置文件列表，也不是只展示 README 的仓库索引，而是一个更偏向“可浏览、可理解、可安装”的 OpenClaw 资产目录。

在这里，你可以浏览：

- 完整的 OpenClaw 工作区
- 可复用的 skills
- 角色型 agents
- 多智能体 workflows
- memory 相关配置
- 工具链与开发辅助资产

## 这个网站解决什么问题

OpenClaw 社区里已经有越来越多的 workspace、skill、workflow 和 memory 结构，但这些内容往往分散在 GitHub 仓库、README、个人分享和临时目录里。真正想“装一个试试”的时候，用户通常会遇到这些问题：

- 不知道从哪里开始找
- 不知道哪个仓库更适合当前任务
- 只看到 README，看不到实际工作区结构
- 下载以后还要自己判断是否可安装、是否适合复用

龙虾客栈的目标，就是把这些内容整理成更容易理解和复用的形式。

## 你可以在这里做什么

### 发现可用的 OpenClaw 配置

网站按多种维度组织内容：

- [工作区](/categories/workspace)
- [技能](/categories/skill)
- [工作流](/categories/workflow)
- [记忆](/categories/memory)
- [多智能体](/topics/multiagent)
- [自动化](/topics/automation)
- [开发](/topics/dev)
- [设计](/topics/design)

这样用户不只是“搜一个名字”，还可以按任务场景和资产类型去找。

### 查看真实工作区结构

每个 lobster 详情页通常都会展示：

- README
- workspace 文件树
- 版本信息
- 下载入口
- 源码仓库
- 相关推荐

这比只看一个 GitHub README 更接近真实使用场景。

### 下载并安装

如果你已经安装了 `clawlodge-cli`，可以直接通过 CLI：

- 搜索配置
- 查看详情
- 下载 zip
- 安装到新的 OpenClaw agent

这也是龙虾客栈和普通目录页最大的差异之一：它不仅帮你发现内容，也尽量让“拿回去用”更顺滑。

## 龙虾客栈里都有什么类型的内容

目前站内内容大致可以分成几类：

### 1. 完整工作区

这类更像一个可直接上手的 OpenClaw workspace，通常包括：

- AGENTS.md
- SOUL.md
- skills
- memory
- workflows
- README

如果你想找一个“直接拿来试”的配置，通常从 [工作区](/categories/workspace) 开始。

### 2. 单技能或技能包

这类更适合增量安装，用来给已有工作区补能力，比如：

- 浏览器验证
- 代码评审
- 设计辅助
- 写作与发布流程

可以从 [技能](/categories/skill) 或 [设计主题](/topics/design) 开始看。

### 3. 多智能体与流程型配置

这类内容更适合证明 OpenClaw 的真正价值：不是模型单次更聪明，而是工作方式更稳定。

推荐从这些页面进入：

- [多智能体主题](/topics/multiagent)
- [工作流分类](/categories/workflow)
- [OpenClaw 多智能体配置指南](/guides/openclaw-multi-agent-config)

### 4. 记忆型配置

有些工作区的真正价值不在技能数量，而在 memory 的组织方式。

可以先看：

- [记忆分类](/categories/memory)
- [OpenClaw 记忆策略指南](/guides/openclaw-memory-allocation-strategies)

## 龙虾客栈不是在做什么

龙虾客栈不是：

- 一个通用 AI 模型榜单
- 一个纯 GitHub 镜像站
- 一个只放 prompt 文案的资源页

它更像一个围绕 OpenClaw 的“资产层”：

- 让配置更容易被找到
- 让工作区更容易被理解
- 让可复用内容更容易被安装

## 这个网站为什么强调 Guides、Categories 和 Topics

因为很多用户并不会直接搜索具体仓库名。更常见的需求是：

- 我想找一个程序员型 OpenClaw 配置
- 我想找一个多智能体 workflow
- 我想理解 OpenClaw config file 应该长什么样
- 我想看 memory 到底该怎么做

所以网站除了具体 lobster 页面，也提供：

- [Guides](/guides)
- [Categories](/categories/workspace)
- [Topics](/topics/multiagent)

这些页面更适合承接真实搜索需求，也更适合做多语言内容扩展。

## 这个网站当前最值得看的代表内容

如果你第一次来到龙虾客栈，比较值得先看这些方向：

- [openclaw-config](/lobsters/openclaw-config)
- [openclaw-memory-management](/lobsters/openclaw-memory-management)
- [cft0808-edict](/lobsters/cft0808-edict)
- [多智能体主题](/topics/multiagent)
- [OpenClaw 配置文件指南](/guides/openclaw-config-file)

这些页面比较能代表当前站内内容的结构和方向。

## 最后

龙虾客栈的目标不是把 OpenClaw 做成“又一个资源列表”，而是把社区里真正可复用的配置、技能、工作流和 memory 结构整理成一个更可浏览、更可安装、更适合长期扩展的目录。

网站地址：

- [https://clawlodge.com](https://clawlodge.com)

项目源码：

- [GitHub](https://github.com/memepilot/clawlodge)
