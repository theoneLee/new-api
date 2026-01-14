# New-API 项目分析报告

阅读项目代码后，针对您提出的四个问题，整理如下：

## 1. Key 管理的调用链和交互过程

Key（在代码中称为 Token）的管理和验证主要发生在 Gin 中间件层。

### 调用链：
1.  **入口点**：`middleware/auth.go` 中的 `TokenAuth()` 函数。
2.  **提取 Key**：从请求头 `Authorization` 中提取 `Bearer` 令牌，或从 `mj-api-secret`、`x-api-key` (Anthropic)、Query 参数 `key` (Gemini) 等位置提取。
3.  **解析与验证**：
    -   调用 `model.ValidateUserToken(key)`：在数据库中查找令牌，验证其是否存在、是否过期、是否达到额度限制。
    -   **特殊处理**：如果 Key 格式为 `sk-xxx-channelId`，且用户是管理员，则会解析出指定的 `channelId`，用于后续强制路由到特定渠道。
4.  **IP 限制检查**：调用 `token.GetIpLimits()` 检查请求 IP 是否在允许列表中。
5.  **用户信息获取**：调用 `model.GetUserCache(token.UserId)` 获取所属用户的状态（如是否被封禁）。
6.  **上下文注入**：验证通过后，将 `token_id`, `token_key`, `token_quota`, `group` 等信息注入到 Gin 的上下文 (`c *gin.Context`) 中，供后续业务逻辑（如路由、计费）使用。
7.  **后续转发**：交给 `controller/relay.go` 中的 `Relay` 处理器执行。

## 2. Key 是怎么计费的？

计费逻辑核心位于 `service/quota.go` 和 `service/pre_consume_quota.go` 中。计费单位为内部的 `quota`（通常 500,000 quota 等于 1 美元）。

### 计费过程：
1.  **预扣费 (Pre-consume)**：
    -   在请求发送到上游渠道之前，调用 `service.PreConsumeQuota`。
    -   根据请求中的 `max_tokens`（或默认最大值）估算出可能消耗的最大 quota。
    -   从用户的 `quota` 余额和令牌的 `remain_quota` 中扣除。
2.  **实际计费 (Post-consume)**：
    -   请求完成后，在 `defer` 块（或异步回调）中根据上游返回的实际 `usage` (Token 数) 计算实际消耗。
    -   调用 `service.PostConsumeQuota`：
        -   如果实际消耗小于预扣，则返还差额。
        -   如果实际消耗大于预扣，则补扣差额。
    -   更新用户已用额度、请求次数及令牌剩余额度。

### 计费公式：
-   **非按量计费（Token 计费）**：
    `quota = (promptTokens + completionTokens * completionRatio) * modelRatio * groupRatio`
-   **固定价格计费**：
    `quota = modelPrice * groupRatio * QuotaPerUnit`

其中 `groupRatio`（分组倍率）、`modelRatio`（模型倍率）、`completionRatio`（补全倍率）均可在系统后台配置。

## 3. 怎么对接的渠道？

项目采用了 **适配器模式 (Adaptor Pattern)** 来对接各种不同的上游渠道（如 OpenAI, Anthropic, Gemini, 阿里, 腾讯等）。

### 核心机制：
1.  **接口定义**：在 `relay/channel/adapter.go` 中定义了 `Adaptor` 接口，规定了每个渠道必须实现的方法，包括获取请求 URL、设置请求头、转换请求格式、处理响应等。
2.  **具体实现**：在 `relay/channel/` 目录下，每个渠道都有独立的文件夹实现该接口。例如：
    -   `openai/`：实现 OpenAI 标准接口适配。
    -   `claude/`：实现 Anthropic Claude 接口适配。
    -   `ali/`：实现通义千问接口适配。
### 适配器代码位置：
-   **接口定义**：`relay/channel/adapter.go` (定义了 `Adaptor` 接口)。
-   **具体实现**：位于 `relay/channel/` 的子目录下，每个渠道有独立文件夹：
    -   OpenAI: `relay/channel/openai/`
    -   Claude (Anthropic): `relay/channel/claude/`
    -   Gemini: `relay/channel/gemini/`
    -   国内渠道 (如阿里、百度、深言): `relay/channel/ali/`, `relay/channel/baidu/`, `relay/channel/deepseek/` 等。

## 4. New-API 提供的接口都是 OpenAI 格式的么？

不全是。虽然项目以兼容 OpenAI 格式为核心，但也提供了多种原生接口的接入能力：

1.  **OpenAI 标准接口**：主要在 `/v1/*` 路径下（如 `/v1/chat/completions`）。
2.  **Anthropic (Claude) 原生接口**：支持 `/v1/messages` 路径。
3.  **Google Gemini 原生接口**：支持 `/v1beta/models/*` 路径。
4.  **Midjourney/Suno 专用接口**：分别支持 `/mj/*` 和 `/suno/*` 路径。

## 5. 如果使用 Claude Code 发送请求，能够识别么？怎么识别的？

**能够正确识别。**

### 识别机制：
1.  **路径识别 (Path-based Routing)**：
    在 `router/relay-router.go` 中，路由引擎通过请求的 **URL 路径** 进行识别：
    -   如果请求发送到 `/v1/messages`，路由会将其标记为 `types.RelayFormatClaude`。
    -   这是 Anthropic 官方 SDK（包括 Claude Code）默认使用的 API 路径。
2.  **特征头识别 (Header Sniffing)**：
    在某些入口点（如获取模型列表），代码会检查是否存在 `x-api-key` 和 `anthropic-version` 等 Anthropic 特有的 HTTP Header。如果存在，系统会自动切换到 Anthropic 的处理逻辑。
3.  **中转处理流程**：
    当识别为 Claude 格式后，系统会调用 `GenRelayInfoClaude` 初始化上下文，并使用 `claude.Adaptor` 进行后续的请求转换。这意味着即使你用 Claude Code 直接请求 New-API，它也能像 Anthropic 官方服务器一样接收并解析请求，然后再将其转发给你配置的实际后端渠道（可能是真正的 Claude，也可能是转换后的 OpenAI 渠道）。

## 6. 渠道的缓存实现是什么？

New-API 采用了**两级代理/缓存机制**来保证高性能：

1.  **内存缓存 (Local Memory Cache)**：
    -   **实现文件**：`model/channel_cache.go`。
    -   **原理**：在程序启动时，将所有启用的渠道及其支持的模型、优先级、权重等配置通过 `InitChannelCache` 加载到内存中的全局变量（如 `group2model2channels`）。
    -   **同步方式**：通过 `SyncChannelCache` 定期（默认 60 秒）从数据库拉取最新配置进行刷新。这保证了在转发请求选择渠道时，不需要重复查询数据库。

2.  **Redis 缓存 (Distributed Redis Cache)**：
    -   **实现文件**：`model/token_cache.go` 和 `model/user_cache.go`。
    -   **原理**：将令牌（Token）的剩余额度、用户的余额、状态等动态数据存储在 Redis 中。
    -   **优势**：Redis 支持原子性操作（如 `INCRBY`），在分布式部署多个 New-API 实例时能够保证额度扣费的一致性。

## 7. 为什么能用 Redis/内存来模拟 LLM 的缓存命中？

这里的“模拟缓存命中”主要指对 **Prompt Caching（提示词缓存）** 的计费与响应模拟：

1.  **计费模拟**：
    -   **实现文件**：`setting/ratio_setting/cache_ratio.go`。
    -   **机制**：由于上游 LLM（如 OpenAI, DeepSeek, Claude）对缓存命中部分会提供极低的价格（通常是原价的 10%-50%），New-API 在内存中维护了一套 `CacheRatio`（缓存倍率表）。
2.  **数据流转**：
    -   当上游返回响应时，适配器（如 `relay-openai.go`）会提取 `usage` 中的 `cached_tokens`（或类似字段）。
    -   系统通过内存中预设的倍率进行计算，并在 Redis 中原子性地更新额度。
3.  **模拟意义**：
    -   通过在 **内存** 中读取倍率和在 **Redis** 中管理额度，New-API 能够像真实 LLM 一样，即时地向用户反馈“缓存命中”后的优惠计费结果，而不需要等待繁重的数据库事务，从而在经济模型上完美“模拟”了 LLM 的原生缓存行为。
