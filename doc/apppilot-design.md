# AppPilot 设计

AppPilot 是面向代码助手和 App 工程的本地验证运行时。它负责接收外部验证资产和本次运行参数，构建和启动 App，调度设备或可选 Editor 会话，执行验证流程，采集执行证据，抽取结构化执行事实，并在人工确认后产出可供外部系统消费的回流与写回材料。

## 1. 职责边界

### 1.1 AppPilot 负责范围

AppPilot 负责：

- 按结构化 `ValidatorAsset` 执行 iOS、Android 和可选 Editor 验证流程。
- 通过 Codex Agent SDK 控制验证任务，由 agent 理解输入、编排执行、检查证据、生成反馈并提示人工确认。
- 通过本地 SQLite 状态数据库管理验证任务状态、检查点、重试、取消、恢复索引和审计事件。
- 通过本地 Run Event Bus 承载 step 级、系统级、timer / observation window、外部输入和人工确认事件；日志、App WebSocket、UI 观测和截图默认作为证据或 ReAct observation 记录。
- 在单次 run 内执行定时等待、观察窗口和事件驱动 step；这些机制只推进当前验证流程，不创建外部长期调度。
- 安装、启动、停止和控制真实设备或 Unity Editor 会话。
- 采集日志、App 侧结构化信号、业务事件、App WebSocket 证据、API/SQL 结果、线上数据快照、UI 观测、截图和设备状态。
- 支持一个验证 run 下的多个 `ValidationInstance`，并为每个实例产出独立证据链。
- 产出 instance 级 `ExecutionResult`、`EvidenceBundle`、`ExecutionFact`，以及 run 级聚合结果。
- 产出执行证据、诊断信号、本机运行摘要和人工确认后的写回材料。
- 在人工确认后产出 `ValidatorAssetGenerationMaterial` 和 `ValidationWritebackPackage`。
- 通过 MCP tools 和 CLI fallback 对代码助手暴露能力。

### 1.2 AppPilot 不负责范围

AppPilot 不负责：

- 外部知识资产的发布、版本治理、索引构建、路由策略或消费快照管理。
- 外部资产关系图、覆盖矩阵、长期运行历史和趋势分析的维护。
- 外部资产的采纳、废弃、替换、裁剪或发布决策。
- 外部系统中的用户、权限、协作流程、审核流或资产生命周期管理。

## 2. 运行时主链路

### 2.1 主链路概览

```text
ValidatorAsset + run options
  -> 创建 Validation Task
  -> 初始化 Codex Agent SDK session
  -> 编译或命中 RuntimeExecutionPlan
  -> 初始化 SQLite checkpoint / Run Event Bus / Internal Scheduler
  -> 创建 ValidationInstance(s)
  -> 构建 App 或复用构建产物
  -> 每个 instance 执行 install / launch / attach
  -> 每个 instance 连接 device / Editor / app-side RPC / app_ws / evidence tools
  -> Runtime 执行 ReAct step / 处理事件 / 创建 timer 或进入观察窗口
  -> 采集证据并生成 ExecutionResult / EvidenceBundle / ExecutionFact
  -> run 级聚合与诊断
  -> agent 检查证据 / 解释结果 / 生成反馈 / 提示人工确认
  -> 人工确认执行结果、证据范围和回流材料
  -> 生成可供外部消费的回流与写回材料
```

AppPilot 采用本地优先的运行方式。运行文件写入 `~/.apppilot`。资产导入、资产发布和长期治理由调用方或外部系统基于 AppPilot 产出的回流与写回材料完成。

### 2.2 外部输入

`ValidatorAsset` 是外部系统提供给 AppPilot 的稳定输入契约。它描述验证意图、声明式流程、证据要求和结果解释口径，不直接暴露 AppPilot 内部 runtime step、Run Event Bus、timer、SQLite checkpoint 或具体 MCP tool。

run options 是本次执行的临时运行参数，不是稳定外部资产契约。它可以承载目标设备、构建/启动约束、多实例声明、App WebSocket 配置、Agent 控制配置、运行策略和证据保留策略。

`Validation Task` 是 AppPilot 为本次验证创建的本地任务容器。它持有当前 task 的所有运行状态，包括 `ValidatorAsset` 快照、run options 快照、任务状态、执行计划引用、实例状态、检查点、事件游标、证据索引、人工确认状态和输出材料引用。它不属于外部资产契约，也不表达长期资产治理结论。

```yaml
# Validator Asset 稳定 ID
validator_id: validator:<domain>/<platform>/<scenario>
# 资产类型固定为 validator_asset
asset_type: validator_asset
# 验证流程身份，用于判定是否同一验证流程
flow_identity:
  # 规范化后的任务目标
  normalized_task_goal:
  # 验证平台
  platform:
  # 场景消歧字段
  scenario:
  # 能力消歧字段
  capability:
  # 关联验证事实 ID，用于目标过宽时消歧
  validation_fact_ids:
  # 基于身份字段生成的稳定 hash
  identity_hash:
# 当前 Validator 验证的验证事实列表
validates:
  - validation:<domain>/<validation_fact_name>
# 当前 Validator 可执行或可采集的 BDD 场景资产
bdd_refs:
  - bdd:<domain>/<scenario_name>
# 适用平台
platform:
# 适用验证场景
scenario:
# Validator 执行所需组件
components:
  # 关联 Skill Asset
  skill:
  # 执行时需要调用的工具能力，不绑定 AppPilot 内部工具 schema
  tools:
  # 执行时需要的资源
  resources:
  # 执行配置
  config:
# 设备侧要求
device_requirements:
  # 支持平台
  platforms:
  # 最低系统版本
  min_os_versions:
  # 需要设备数量
  device_count:
# 验证执行步骤
execution_steps:
  # 单个执行步骤
  - step_id:
    # 动作语义
    action:
    # 执行动作的工具能力
    tool:
    # 工具输入
    inputs:
    # 该步骤预期采集到的证据
    expected_evidence:
# 证据提取器
evidence_extractors:
  # 单个证据提取器
  - extractor_id:
    # 证据来源
    source: log | app_signal | business_event | app_ws | api | sql | data_snapshot | ui | screenshot | device_state
    # 证据选择器
    selector:
    # 提取后的执行事实类型
    output_fact_type:
# 结果解释规则
result_interpretation:
  # 判定通过条件
  pass_when:
  # 判定失败条件
  fail_when:
# 输出 schema
outputs:
  # Execution Fact schema 引用
  execution_fact_schema:
  # 证据摘要 schema 引用
  evidence_summary_schema:
```

run options 不在 `ValidatorAsset` 中展开为稳定字段。它只作为 `Validation Task` 的输入快照保存，不形成独立的长期契约。

AppPilot 运行所需的启动参数、构建参数、多实例目标、App WebSocket 配置、设备控制配置等，不写入 `ValidatorAsset` 输入契约。它们应由 run options、`RuntimeExecutionPlan` 或内部工具配置承载。

### 2.3 Agent Session

AppPilot 的验证任务控制固定由 Codex Agent SDK 承载。AppPilot 不把 Codex Agent SDK 的内部会话协议暴露为外部资产契约，但会把 agent session 的输入、输出、工具调用、检查反馈和人工确认提示作为 run 内审计材料保存。

初始化 Codex Agent SDK session 时，AppPilot 必须准备并落盘以下内容：

- 当前 `Validation Task` 的 `taskId`、`runId`、run 目录和状态数据库引用。
- 本次实际使用的 `ValidatorAsset` 快照和 hash。
- run options 快照，包括目标设备、构建/启动约束、多实例声明、运行策略和证据保留策略。
- 可授权给 agent 调用的 AppPilot MCP tools、权限边界和参数约束。
- `RuntimeExecutionPlan` 缓存命中信息；未命中时提供编译执行计划所需上下文。
- Run Event Bus、checkpoint、Evidence Store 和 artifact 索引的读取/写入入口。
- Agent 预算、心跳策略、异常响应策略和人工确认要求。

启动 Codex Agent SDK session 时，AppPilot 先写入 agent session 初始化记录，再向 agent 提交任务输入。agent 的第一阶段输出应是可审计的计划或计划修正建议；后续所有工具调用、事件响应、证据检查、反馈和人工确认提示都必须写入 `Validation Task` 状态和 run 目录。

Agent 在验证任务中负责理解输入、辅助生成或调整执行计划、调用授权工具、检查证据、生成反馈并提示人工确认。AppPilot runtime 负责持久化任务状态、检查点和事件记录，agent session 中断后不得导致 run 状态丢失。

恢复时，AppPilot 以本地状态数据库和 run 目录为准。如果 Codex Agent SDK session 仍可恢复，则绑定原 session 继续；如果不能恢复，则用已落盘的输入快照、checkpoint、event cursor 和证据索引创建新的 Codex Agent SDK session，并把前一次 session 记录为历史审计材料。

### 2.4 Runtime Plan

AppPilot 基于 `ValidatorAsset`、run options、目标设备、构建配置、证据要求和运行策略，编译或命中内部 `RuntimeExecutionPlan`。

`RuntimeExecutionPlan` 是可持久化、可序列化、可缓存的内部执行计划。它把外部声明式步骤转换为 runtime step、事件绑定、timer 模板、观察窗口和工具调用约束。它不属于外部资产契约，也不得原样写回为外部资产。

AppPilot 编译流程：

```text
ValidatorAsset.executionSteps: ValidatorFlowStep[]
  -> Agent / plan compiler 理解外部声明式意图
  -> RuntimeExecutionPlan
  -> RuntimeExecutionStep / ReactTaskSpec / RunTimer / ObservationWindowConfig
  -> device driver / app rpc / evidence collector / scheduler / event bus
```

```ts
// AppPilot 支持的执行平台
type Platform =
  // iOS 真实设备或模拟器
  | "ios"
  // Android 真实设备或模拟器
  | "android"
  // 可选 Editor 会话
  | "unity_editor";

// AppPilot 证据通道类型；用于 RuntimeExecutionPlan、证据采集、artifact 索引和 ExecutionFact 来源
type EvidenceChannel =
  // 设备或 App 日志
  | "log"
  // App 侧结构化信号，例如状态、指标或调试 payload
  | "app_signal"
  // App 或业务系统产生的业务事件
  | "business_event"
  // App WebSocket 主动反馈或 RPC 返回
  | "app_ws"
  // HTTP/API 查询结果
  | "api"
  // SQL 查询结果
  | "sql"
  // 线上数据、监控、配置或后端状态快照
  | "data_snapshot"
  // UI 树、节点状态或可见性观测
  | "ui"
  // 截图
  | "screenshot"
  // 设备状态，例如系统版本、前后台、电量、网络或安装状态
  | "device_state";

// Evidence Store 中保存的 artifact 类型
type ArtifactType =
  // 证据 artifact
  | EvidenceChannel
  // 构建产物
  | "build_artifact"
  // agent 输入、输出、计划或 review 记录
  | "agent_record"
  // runtime plan JSON
  | "runtime_plan"
  // 人工确认记录
  | "human_confirmation"
  // 回流或写回材料
  | "writeback_material";

// RuntimeExecutionPlan 中声明的证据要求
type EvidenceRequirement = {
  // 证据要求 ID；为空时由 AppPilot 生成
  requirementId?: string;
  // 证据通道
  channel: EvidenceChannel;
  // 证据选择器，例如日志关键字、JSON path、UI query、API endpoint 或 SQL query
  selector?: string;
  // 是否为判定结果必需的证据
  required?: boolean;
  // 证据用途
  purpose?: "assertion" | "diagnostic" | "context" | "audit";
  // 采集范围
  scope?: "run" | "instance" | "step";
  // 关联的验证事实 ID 列表
  validationFactIds?: string[];
  // 证据通道长时间无信号的诊断阈值；用于 ReAct 观察和诊断，不直接发布 Event Bus 心跳
  stallThresholdMs?: number;
};

// 内部 runtime 执行步骤类型
type RuntimeExecutionStepKind =
  // ReAct 任务，由 Agent 在授权工具内自主推理达成 successCriteria
  | "react_task"
  // Runtime 直接执行的确定性步骤，不进入 ReAct 循环
  | "runtime_action";

// Runtime 验证规则
type VerificationRule = {
  // 规则 ID，在同一个 step 内唯一
  ruleId: string;
  // 证据通道
  channel: EvidenceChannel;
  // 证据选择器，例如日志关键字、UI query、App WebSocket JSON path、API endpoint 或 SQL query
  selector: string;
  // 规则是否必须通过；required 为 true 的规则决定 step 是否可以通过
  required: boolean;
  // 规则用途
  purpose: "assertion" | "context";
  // 规则可读描述
  description?: string;
};

// step 完成条件；Runtime 只能依据 verificationRules 判定 step 是否通过
type StepSuccessCriteria = {
  // 给 Agent 看的意图描述，仅用于驱动 ReAct 推理；Runtime 不得依据该字段判定 step 是否通过
  intentDescription: string;
  // Runtime 独立验证规则；必须至少包含一条 required 为 true 的规则
  verificationRules: VerificationRule[];
};

// 观察窗口配置
type ObservationWindowConfig = {
  // 观察窗口 ID；为空时由 AppPilot 生成
  windowId?: string;
  // 观察总时长
  durationMs: number;
  // 采样间隔；为空时只在窗口开始和结束采集
  sampleIntervalMs?: number;
  // 观察窗口内需要采集的证据
  collectors: EvidenceRequirement[];
  // 窗口开始时发布的事件类型；发布时 payload 必须包含 windowId
  startEvent: "observe_window_started";
  // 窗口结束时发布的事件类型；发布时 payload 必须包含 windowId
  finishEvent: "observe_window_finished";
};

// 观察窗口开始或结束事件的 payload
type ObservationWindowEventPayload = {
  // 观察窗口 ID，用于多实例和并发窗口消歧
  windowId: string;
  // 单次验证 run ID
  runId: string;
  // 验证实例 ID；run 级观察窗口为空
  instanceId?: string;
  // 关联步骤 ID
  stepId: string;
  // 事件阶段
  phase: "started" | "finished";
  // 计划触发时间
  scheduledAt?: string;
  // 实际发生时间
  occurredAt: string;
};

// ReAct 任务规约
type ReactTaskSpec = {
  // 给 Agent 看的意图描述，用于驱动 ReAct 推理
  intent: string;
  // Runtime 独立验证的完成条件
  successCriteria: StepSuccessCriteria;
  // 授权给 Agent 的工具名称列表
  availableTools: string[];
  // ReAct 循环最大轮数
  maxIterations: number;
  // 单次 observation 最大等待时间
  observationTimeoutMs?: number;
  // 该 step 的预算上限，例如 token、cost 或 time
  stepBudget?: Record<string, number>;
};

// Runtime 直接执行的确定性步骤规约
type RuntimeActionSpec = {
  // 确定性步骤子类型
  kind: "wait" | "observe_window" | "collect_evidence" | "human_confirmation";
  // 等待时长；kind 为 wait 时使用
  durationMs?: number;
  // 观察窗口配置；kind 为 observe_window 时使用
  observe?: ObservationWindowConfig;
  // 证据采集要求；kind 为 collect_evidence 时使用
  collect?: EvidenceRequirement[];
  // 人工确认提示类型；kind 为 human_confirmation 时使用
  humanPromptType?: "confirm_result" | "confirm_evidence_scope" | "confirm_writeback_material" | "manual_intervention";
};

// 目标环境签名输入；用于生成 RuntimePlanCacheKey.targetSignatureHash
type TargetSignatureInput = {
  // 执行平台
  platform: Platform;
  // 验证场景
  scenario?: string;
  // 能力消歧字段
  capability?: string;
  // 设备数量要求
  deviceCount?: number;
  // 设备能力要求；按字典序排序后参与 hash
  deviceCapabilities?: string[];
  // 最低 OS 版本要求；对象 key 按字典序排序后参与 hash
  minOsVersions?: Record<string, string>;
  // 设备控制后端；例如 iOS 为 wda，Android 为 uiautomator2
  deviceControlBackend?: "wda" | "uiautomator2";
  // 构建 adapter 名称
  buildAdapter?: string;
  // 构建配置
  buildConfiguration?: BuildConfiguration;
  // 证据通道组合；去重并按字典序排序后参与 hash
  evidenceChannels: EvidenceChannel[];
  // 是否需要 App WebSocket bridge
  appWebSocketRequired?: boolean;
  // 是否需要可选 Editor 会话
  editorRequired?: boolean;
};

// RuntimeExecutionPlan 的复用匹配键
type RuntimePlanCacheKey = {
  // ValidatorAsset ID
  validatorId: string;
  // ValidatorFlowIdentity.identityHash，用于快速命中候选 plan
  flowIdentityHash: string;
  // ValidatorAsset 内容 hash，用于确认外部契约正文未变化
  validatorAssetHash: string;
  // Runtime plan schema 版本
  planSchemaVersion: string;
  // AppPilot compiler 版本
  compilerVersion: string;
  // 目标环境签名 hash；由 TargetSignatureInput 的 canonical JSON 计算
  targetSignatureHash: string;
};

// RuntimeExecutionPlan 的 timer 模板；实例化为 run 时才生成 RunTimer
type RuntimeTimerTemplate = {
  // timer 模板 ID，在 RuntimeExecutionPlan 内唯一
  timerTemplateId: string;
  // 关联的内部 runtime step ID
  stepId: string;
  // timer 调度方式
  schedule: RunTimer["schedule"];
  // 到期后发布的事件类型
  emits: "timer_fired";
};

// AppPilot 内部编译出的执行计划
type RuntimeExecutionPlan = {
  // 内部执行计划 ID
  planId: string;
  // Runtime plan schema 版本
  planSchemaVersion: string;
  // 计划复用匹配键
  cacheKey: RuntimePlanCacheKey;
  // 单次验证 run ID；缓存态 plan 为空，run 内实例化后填充
  runId?: string;
  // ValidatorAsset ID
  validatorId: string;
  // 原始 ValidatorAsset 引用
  validatorAssetRef: string;
  // 原始 ValidatorAsset 内容 hash
  validatorAssetHash: string;
  // ValidatorFlowIdentity 快照
  flowIdentity: ValidatorFlowIdentity;
  // AppPilot compiler 版本
  compilerVersion: string;
  // Agent 任务计划引用
  agentPlanRef?: string;
  // 内部 runtime 执行步骤列表
  steps: RuntimeExecutionStep[];
  // 计划级 timer 模板列表；不得保存 run 内 timer 状态
  timerTemplates?: RuntimeTimerTemplate[];
  // 计划级证据要求列表；step 可以继承或覆盖
  evidenceRequirements?: EvidenceRequirement[];
  // runtime 安全策略
  safetyPolicy: RuntimeSafetyPolicy;
  // 编译诊断信息
  diagnostics?: Diagnostic[];
  // 序列化内容 hash，用于缓存完整性校验
  planContentHash: string;
  // 是否允许作为缓存复用
  cacheable: boolean;
  // 执行计划生成时间
  generatedAt: string;
};

// 单个内部 runtime 执行步骤
type RuntimeExecutionStep = {
  // 内部步骤稳定 ID，在同一个 RuntimeExecutionPlan 内唯一
  stepId: string;
  // 对应的外部 ValidatorFlowStep ID
  validatorStepId?: string;
  // 步骤类型
  kind: RuntimeExecutionStepKind;
  // ReAct 任务规约；kind 为 react_task 时必填
  reactTask?: ReactTaskSpec;
  // Runtime 确定性步骤规约；kind 为 runtime_action 时必填
  runtimeAction?: RuntimeActionSpec;
  // step 通过后仍要采集或绑定的诊断、审计证据；不参与 step 通过判定
  expectedEvidence?: EvidenceRequirement[];
  // 步骤超时时间
  timeoutMs?: number;
};
```

- `RuntimeExecutionPlan` 缓存命中后，AppPilot 可以跳过外部 `ValidatorAsset` 的重新解析和 step 编译。
- 缓存直接复用必须同时满足 `flowIdentityHash`、`validatorAssetHash`、`planSchemaVersion`、`compilerVersion` 和 `targetSignatureHash` 完全一致。
- 缓存态 `RuntimeExecutionPlan` 不保存 run 内事件序号、timer 状态、step consumption、checkpoint 或 artifact 引用。
- `targetSignatureHash` 必须使用 `TargetSignatureInput` 生成 canonical JSON 后计算 hash。canonical JSON 规则是：移除 `undefined` 字段、对象 key 按字典序排序、字符串数组去重后按字典序排序、布尔和数字保持原始类型，再对 UTF-8 JSON 字符串计算 `sha256`。
- 每个 `react_task` 的 `successCriteria.verificationRules` 必须至少包含一条 `required: true` 的规则，否则 plan 编译失败。
- `verificationRules` 决定 step 是否通过；`expectedEvidence` 只表达 step 通过后的诊断或审计证据，不参与通过判定。

### 2.5 Run 聚合与结果解释

run 级聚合只汇总本次 run 内所有 instance 的执行结果、证据质量、诊断信号和观察到的覆盖组合。

run 聚合不得把一次设备运行结果扩大解释为未执行的平台、SDK 版本、App 版本、OS 版本或环境范围。长期趋势、全局覆盖和资产治理判断由外部系统完成。

结果状态解释：

- `passed`：必要通过条件满足，并且没有命中失败条件。
- `failed`：至少一个失败条件被满足。
- `partial`：只采集到部分必要证据，或只执行了部分确认范围。
- `blocked`：验证流程未到达验证触点。

```ts
// 单次 run 观察到的平台覆盖组合；只表达本次 run 的事实
type PlatformCoverageRecord = {
  // 覆盖记录 ID
  coverageRecordId: string;
  // 单次验证 run ID
  runId: string;
  // 参与该覆盖记录的验证实例 ID 列表
  instanceIds: string[];
  // 执行平台
  platform: Platform;
  // 验证场景
  scenario?: string;
  // OS 版本
  osVersion?: string;
  // SDK 版本
  sdkVersion?: string;
  // App 版本
  appVersion?: string;
  // 网络或环境配置
  environmentProfile?: string;
  // 覆盖结果
  result: "passed" | "failed" | "partial" | "blocked";
  // 支撑该覆盖记录的证据引用
  evidenceRefs: string[];
  // 观察时间
  observedAt: string;
};

// 单个证据通道的充分性评分
type EvidenceChannelSufficiency = {
  // 证据通道
  channel: EvidenceChannel;
  // 该通道是否必需
  required: boolean;
  // 该通道是否采集到证据
  collected: boolean;
  // 该通道是否满足结果解释需要
  sufficient: boolean;
  // 充分性评分，范围 0 到 1
  score: number;
  // 缺失或不足的说明
  reason?: string;
  // 支撑评分的证据引用
  evidenceRefs?: string[];
};

// 单次 run 的证据充分性评分
type EvidenceSufficiencyScore = {
  // 评分记录 ID
  scoreId: string;
  // 单次验证 run ID
  runId: string;
  // 验证实例 ID；run 级评分为空
  instanceId?: string;
  // 总体充分性评分，范围 0 到 1
  overallScore: number;
  // 是否满足所有 required evidence
  allRequiredEvidenceSatisfied: boolean;
  // 按证据通道拆分的评分
  channels: EvidenceChannelSufficiency[];
  // 缺失的证据要求 ID 列表
  missingRequirementIds?: string[];
  // 评分生成时间
  generatedAt: string;
};

// 失败或异常结果的归因分类
type FlakinessClassification = {
  // 归因记录 ID
  classificationId: string;
  // 单次验证 run ID
  runId: string;
  // 验证实例 ID；run 级归因为空
  instanceId?: string;
  // 归因类型
  category: "product_failure" | "test_flake" | "environment_issue" | "device_issue" | "tooling_issue" | "insufficient_evidence" | "unknown";
  // 归因置信度，范围 0 到 1
  confidence: number;
  // 可读说明
  reason: string;
  // 建议动作
  recommendedAction: "accept_result" | "retry" | "collect_more_evidence" | "degrade" | "stop" | "prompt_human";
  // 支撑归因的证据引用
  evidenceRefs: string[];
  // 归因生成时间
  generatedAt: string;
};

// 单次 run 产出的诊断信号；供外部系统消费，但不表达长期趋势
type EvalSignal = {
  // 诊断信号 ID
  evalSignalId: string;
  // 单次验证 run ID
  runId: string;
  // 信号类型
  signalType: "evidence_gap" | "runtime_instability" | "product_regression" | "environment_risk" | "coverage_observed" | "writeback_ready";
  // 信号级别
  severity: "info" | "warning" | "error";
  // 信号摘要
  summary: string;
  // 关联诊断记录引用
  diagnosticRefs?: string[];
  // 关联证据引用
  evidenceRefs?: string[];
  // 信号生成时间
  generatedAt: string;
};

// 单次 run 的聚合结果；不得替代外部长期覆盖或资产治理判断
type RunAggregationResult = {
  // 聚合结果 ID
  aggregationId: string;
  // 单次验证 run ID
  runId: string;
  // 本地任务 ID
  taskId: string;
  // ValidatorAsset ID
  validatorAssetId: string;
  // 参与聚合的验证实例 ID 列表
  instanceIds: string[];
  // run 级结果
  result: "passed" | "failed" | "partial" | "blocked";
  // instance 级结果引用列表
  instanceResultRefs: string[];
  // run 级证据充分性评分
  evidenceSufficiency: EvidenceSufficiencyScore;
  // 失败或异常归因；无失败或无异常时为空
  flakinessClassification?: FlakinessClassification;
  // 本次 run 观察到的覆盖组合
  platformCoverage: PlatformCoverageRecord[];
  // 本次 run 产出的诊断信号
  evalSignals: EvalSignal[];
  // 结果解释说明
  interpretationSummary: string;
  // 支撑 run 级结论的证据引用
  evidenceRefs: string[];
  // 聚合时间
  aggregatedAt: string;
};
```

### 2.6 回流与写回

人工确认后，AppPilot 生成可供外部系统消费的回流与写回材料，包括执行结果、证据摘要、结构化执行事实、诊断信号、本机运行摘要和 Validator Asset 更新候选。

AppPilot 只产出材料，不决定外部系统是否采纳、发布、替换、废弃或长期治理这些材料。

```ts
// 验证流程身份，用于判断两个验证资产是否表达同一个验证流程
type ValidatorFlowIdentity = {
  // 规范化后的任务目标，例如 account_cross_device_sync
  normalizedTaskGoal: string;
  // 验证平台
  platform: Platform;
  // 场景消歧字段
  scenario?: string;
  // 能力消歧字段
  capability?: string;
  // 关联验证事实 ID，用于目标过宽时消歧
  validationFactIds?: string[];
  // 基于上述字段生成的稳定 hash
  identityHash: string;
};

// 生成 Validator Asset 候选材料时使用的人工确认摘要
type ValidatorAssetManualConfirmationSummary = {
  // 确认人
  confirmedBy: string;
  // 确认时间
  confirmedAt: string;
  // 人工确认的结果
  result: "passed" | "failed" | "partial";
  // 人工确认覆盖的范围
  scopeConfirmed: HumanConfirmationScope;
  // 人工备注
  notes?: string;
};

// 支撑生成 Validator Asset 的证据引用
type ValidatorAssetSupportingEvidence = {
  // ExecutionResult 引用
  executionResultRef: string;
  // EvidenceBundle 引用
  evidenceBundleRef: string;
  // ExecutionFact 引用列表
  executionFactRefs: string[];
  // 原始 artifact 引用列表
  artifactRefs: string[];
};

// 从执行过程归纳出的验证流程材料
type ValidatorObservedFlowMaterial = {
  // 执行步骤材料
  executionSteps: unknown[];
  // 需要的工具
  tools: string[];
  // 需要的资源
  resources: string[];
  // 设备要求
  deviceRequirements: unknown;
  // 证据来源
  evidenceSources: EvidenceChannel[];
  // 通过信号
  passSignals: string[];
  // 失败信号
  failSignals: string[];
};

// Validator Asset 生成资料确认检查项
type ValidatorAssetConfirmationChecklistItem = {
  // 检查项 ID
  id: string;
  // 检查对象
  objectRef: "flowIdentity" | "observedFlow" | "supportingEvidence";
  // yes/no 检查问题
  question: string;
  // 是否必须确认
  required: boolean;
};

// 从已确认 run 生成的 Validator Asset 候选材料
type ValidatorAssetGenerationMaterial = {
  // 生成资料 ID
  materialId: string;
  // 单次验证 run ID
  runId: string;
  // 原始任务目标
  taskGoal: string;
  // 验证流程身份
  flowIdentity: ValidatorFlowIdentity;
  // 关联 Validation Fact ID 列表
  validationFactIds: string[];
  // 执行环境
  environment: ExecutionResult["environment"];
  // 本次人工确认结果
  manualConfirmation: ValidatorAssetManualConfirmationSummary;
  // 支撑生成 Validator Asset 的证据
  supportingEvidence: ValidatorAssetSupportingEvidence;
  // 从执行过程归纳出的验证流程材料
  observedFlow: ValidatorObservedFlowMaterial;
  // 人工确认检查项，只确认生成资料是否正确
  confirmationChecklist: ValidatorAssetConfirmationChecklistItem[];
};

// Validator Asset 写回目标；字段内容由外部契约解释
type ValidatorAssetWriteTarget = {
  // 写回目标名称
  target: string;
  // 写回动作
  action: "create_candidate" | "reference_existing";
  // 写回内容引用
  contentRef: string;
  // 写回内容 hash
  contentHash?: string;
};

// 写入阶段材料，描述准备提供给外部系统的 Validator Asset 写回候选
type ValidatorAssetBuildMaterial = {
  // 生成资料 ID
  materialId: string;
  // 验证流程身份
  flowIdentity: ValidatorFlowIdentity;
  // 新 Validator Asset ID
  validatorAssetId: string;
  // 候选正文引用；正文按 ValidatorAsset 字段生成
  validatorAssetBodyRef: string;
  // 候选写回目标列表
  writeTargets: ValidatorAssetWriteTarget[];
  // provenance 引用；包含 run、确认范围和证据引用
  provenanceRef?: string;
};

// Validation Fact 写入候选；AppPilot 只产出候选，不决定是否采纳
type ValidationFactCandidate = {
  // 候选 ID
  candidateId: string;
  // 单次验证 run ID
  runId: string;
  // 目标 Validation Fact ID；新事实可为空
  validationFactId?: string;
  // 候选动作
  action: "create" | "update" | "deprecate" | "no_change";
  // 候选事实主体
  subject: string;
  // 候选事实谓词
  predicate: string;
  // 候选事实值
  value: unknown;
  // 候选事实摘要
  summary: string;
  // 支撑该候选的执行事实引用
  executionFactRefs: string[];
  // 支撑该候选的证据引用
  evidenceRefs: string[];
  // 候选生成时间
  generatedAt: string;
};

// Validator Asset 更新候选；AppPilot 只产出建议材料，不决定资产版本治理
type ValidatorAssetCandidate = {
  // 候选 ID
  candidateId: string;
  // 单次验证 run ID
  runId: string;
  // 原 ValidatorAsset ID
  validatorAssetId: string;
  // 原 ValidatorAsset 内容 hash
  baseValidatorAssetHash: string;
  // 候选动作；不表达原地更新旧资产
  action: "create_candidate" | "no_change";
  // 候选材料引用
  materialRef: string;
  // 候选正文引用；保存按 ValidatorAsset 字段生成的内容
  candidateBodyRef?: string;
  // 候选变更摘要
  changeSummary: string;
  // 支撑该候选的证据引用
  evidenceRefs: string[];
  // 候选生成时间
  generatedAt: string;
};

// 人工确认后的写回材料包；供外部系统消费
type ValidationWritebackPackage = {
  // 写回材料包 ID
  packageId: string;
  // 单次验证 run ID
  runId: string;
  // 本地任务 ID
  taskId: string;
  // ValidatorAsset ID
  validatorAssetId: string;
  // ValidatorAsset 内容 hash
  validatorAssetHash: string;
  // 生成时间
  generatedAt: string;
  // 人工确认记录引用；必须存在
  confirmationRef: string;
  // run 级聚合结果引用
  runAggregationResultRef: string;
  // 本机运行摘要；只表达本机观察记录
  localRunSummary: LocalRunSummary;
  // ExecutionResult 引用列表
  executionResultRefs: string[];
  // EvidenceBundle 引用列表
  evidenceBundleRefs: string[];
  // ExecutionFact 引用列表
  executionFactRefs: string[];
  // 原始或脱敏 artifact 引用列表
  artifactRefs: string[];
  // Validation Fact 写入候选列表
  validationFactCandidates: ValidationFactCandidate[];
  // ValidatorAsset 更新候选；没有更新建议时为空
  validatorAssetCandidate?: ValidatorAssetCandidate;
  // 对外导出引用
  exportRef?: string;
};
```

- 已确认材料包必须引用 run、evidence bundle、execution facts、artifacts、确认人和确认范围。
- `ValidationWritebackPackage` 不复制 `RunAggregationResult` 的聚合字段；外部系统需要证据充分性、失败归因、覆盖范围和诊断信号时，必须通过 `runAggregationResultRef` 读取。
- AppPilot 可以生成验证事实候选和 Validator Asset 候选，但不决定外部系统如何创建、修订、替换、发布或裁剪资产。
- `failed / partial / blocked` run 仍然可以产出证据和 diagnostics。它们只有在显式确认后才可以产出写回材料包。

## 3. Agent 控制

### 3.1 控制边界

Agent 控制层基于 Codex Agent SDK 实现，负责理解 `ValidatorAsset` 和 run options、辅助生成或调整 `RuntimeExecutionPlan`、调用授权工具、检查证据、生成反馈并提示人工确认。

Agent 不持有长期资产状态，不直接写入外部资产，也不替代人工确认。AppPilot runtime 必须持久化任务状态、事件、checkpoint、证据索引和确认记录，agent session 中断后不得导致 run 状态丢失。

### 3.2 初始化与启动

Codex Agent SDK session 的初始化由 AppPilot runtime 触发。初始化必须发生在 `Validation Task` 创建之后、`RuntimeExecutionPlan` 编译或命中之前。

初始化阶段必须完成：

- 记录 agent session ID、关联 `taskId` 和 `runId`。
- 写入 `ValidatorAsset` 快照、run options 快照和输入 hash。
- 加载 AppPilot MCP tools 的授权清单。
- 注册 event bus、checkpoint、Evidence Store 和 artifact 索引入口。
- 写入 agent 预算、心跳策略、异常响应策略和人工确认策略。
- 记录 session 启动时间、SDK 版本和 AppPilot runtime 版本。

启动阶段必须向 Codex Agent SDK 提交本次验证输入，并要求 agent 先产出可审计的计划或计划修正建议。agent 不能绕过 AppPilot runtime 直接修改 step 状态、timer、checkpoint、数据库记录或写回材料。

### 3.3 Codex SDK 接入

AppPilot 使用 `@openai/codex-sdk` 的 TypeScript 接口接入 Codex agent。接入模型是 `Codex -> Thread -> run / runStreamed`。AppPilot 不直接暴露 Codex SDK 的原始 thread 给外部系统，而是封装成内部 `AgentSession`。

Codex SDK 当前没有显式 `dispose()` 方法。AppPilot 的 Dispose 语义定义为：终止当前进行中的 turn、写入审计记录、清理本地 session 引用。未完成的 run 状态仍以 SQLite checkpoint、Run Event Bus 游标和 Evidence Store 索引为准。

初始化代码：

```ts
import { Codex, type Thread, type ThreadEvent } from "@openai/codex-sdk";

type CodexAgentInitInput = {
  // 本地任务 ID
  taskId: string;
  // 单次验证 run ID
  runId: string;
  // AppPilot 工作目录，通常是被验证 App 工程根目录
  workingDirectory: string;
  // 需要恢复的 Codex thread ID；为空时创建新 thread
  resumeThreadId?: string;
  // Codex 模型名称；为空时使用 Codex CLI 默认模型
  model?: string;
  // Codex CLI 可执行文件路径覆盖；为空时由 SDK 自动解析
  codexPathOverride?: string;
  // 传给 Codex CLI 的环境变量；提供后不继承宿主进程环境
  env?: Record<string, string>;
  // 可授权给 Codex agent 访问的额外目录
  additionalDirectories?: string[];
};

type AgentAuditWriter = {
  // 写入 agent session 启动审计
  writeAgentSessionStarted(record: unknown): Promise<void>;
  // 写入 agent session 结束审计
  writeAgentSessionDisposed(record: unknown): Promise<void>;
  // 写入单个 agent 事件审计
  writeAgentEvent(record: unknown): Promise<void>;
};

type CodexAgentSession = {
  // 本地任务 ID
  taskId: string;
  // 单次验证 run ID
  runId: string;
  // Codex SDK client
  codex: Codex;
  // Codex thread；同一个 Validation Task 内连续 request 复用它
  thread: Thread;
  // 当前 Codex thread ID；第一次 turn started 后才一定存在
  threadId?: string;
  // 当前 turn 的中止控制器
  activeAbortController?: AbortController;
  // session 是否已经被 AppPilot dispose
  disposed: boolean;
  // 审计写入器
  audit: AgentAuditWriter;
};

async function initializeCodexAgentSession(
  input: CodexAgentInitInput,
  audit: AgentAuditWriter,
): Promise<CodexAgentSession> {
  const codex = new Codex({
    codexPathOverride: input.codexPathOverride,
    env: input.env,
    config: {
      // AppPilot 不允许 agent 绕过 runtime 权限边界
      approval_policy: "on-request",
    },
  });

  const threadOptions = {
    model: input.model,
    workingDirectory: input.workingDirectory,
    sandboxMode: "workspace-write" as const,
    approvalPolicy: "on-request" as const,
    modelReasoningEffort: "high" as const,
    networkAccessEnabled: false,
    additionalDirectories: input.additionalDirectories,
  };

  const thread = input.resumeThreadId
    ? codex.resumeThread(input.resumeThreadId, threadOptions)
    : codex.startThread(threadOptions);

  const session: CodexAgentSession = {
    taskId: input.taskId,
    runId: input.runId,
    codex,
    thread,
    threadId: input.resumeThreadId,
    disposed: false,
    audit,
  };

  await audit.writeAgentSessionStarted({
    taskId: input.taskId,
    runId: input.runId,
    threadId: input.resumeThreadId,
    workingDirectory: input.workingDirectory,
    startedAt: new Date().toISOString(),
  });

  return session;
}
```

Dispose 代码：

```ts
async function disposeCodexAgentSession(
  session: CodexAgentSession,
  reason: "completed" | "cancelled" | "failed" | "runtime_shutdown",
): Promise<void> {
  if (session.disposed) {
    return;
  }

  session.disposed = true;

  // Codex SDK 没有显式 dispose API；中止当前 turn 是 AppPilot 的释放动作。
  session.activeAbortController?.abort(reason);
  session.activeAbortController = undefined;

  await session.audit.writeAgentSessionDisposed({
    taskId: session.taskId,
    runId: session.runId,
    threadId: session.threadId ?? session.thread.id,
    reason,
    disposedAt: new Date().toISOString(),
  });
}
```

Build Plan 代码：

```ts
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

type PlanBuildSkillRef = {
  // skill 稳定 ID
  skillId: "apppilot.plan-build";
  // skill 版本
  version: string;
  // skill 来源
  source:
    | {
        // AppPilot 内置 skill
        kind: "built_in";
        // 内置 skill 文件路径或内置资源 ID
        path: string;
      }
    | {
        // 本地 skill 文件
        kind: "local_file";
        // 本地 skill 文件路径
        path: string;
      }
    | {
        // 远端 skill URL，需要先下载到本地缓存
        kind: "remote_url";
        // 远端 skill 下载地址
        url: string;
      };
  // 期望内容 hash；为空时只记录实际 hash，不做强校验
  expectedContentHash?: string;
};

type PlanBuildSkill = {
  // skill 稳定 ID
  skillId: "apppilot.plan-build";
  // skill 版本
  version: string;
  // skill 来源引用
  sourceRef: PlanBuildSkillRef["source"];
  // skill 本地缓存路径
  localPath: string;
  // skill 内容 hash
  contentHash: string;
  // 注入给 Codex agent 的 skill 指令正文
  instructions: string;
  // 下载或加载时间
  loadedAt: string;
};

const DEFAULT_PLAN_BUILD_SKILL_REF: PlanBuildSkillRef = {
  skillId: "apppilot.plan-build",
  version: "1",
  source: {
    kind: "built_in",
    path: "skills/apppilot-plan-build/SKILL.md",
  },
};

type RuntimePlanBuildInput = {
  // 本地任务 ID
  taskId: string;
  // 单次验证 run ID
  runId: string;
  // plan-build skill 引用；为空时使用 AppPilot 默认 skill
  planBuildSkillRef?: PlanBuildSkillRef;
  // plan-build skill 本地缓存目录
  skillCacheDir: string;
  // ValidatorAsset 快照
  validatorAssetSnapshot: unknown;
  // ValidatorAsset 内容 hash
  validatorAssetHash: string;
  // 本次 run options 快照
  runOptionsSnapshot: unknown;
  // 目标设备、构建、证据、事件和安全约束
  runtimeContext: {
    // 允许使用的内部 MCP tools 清单
    authorizedTools: unknown[];
    // 目标设备或 Editor 实例声明
    targetInstances: unknown[];
    // 允许使用的证据通道
    evidenceChannels: EvidenceChannel[];
    // Event Bus schema 引用
    eventSchemaRef: string;
    // Timer 与 Scheduler schema 引用
    timerSchemaRef: string;
    // 本地 checkpoint schema 引用
    checkpointSchemaRef: string;
    // 设备控制后端约束
    deviceBackends: {
      // iOS UI 控制后端固定为 WDA
      ios: "wda";
      // Android UI 控制后端固定为 uiautomator2
      android: "uiautomator2";
    };
  };
  // RuntimeExecutionPlan 输出 schema
  runtimeExecutionPlanSchema: unknown;
  // 本次编译超时时间
  timeoutMs?: number;
};

type RuntimePlanBuildResult = {
  // Codex thread ID
  threadId: string;
  // 编译出的内部 RuntimeExecutionPlan
  runtimeExecutionPlan: RuntimeExecutionPlan;
  // agent 原始最终响应
  rawAgentResponse: string;
  // Codex SDK 返回的完成项
  items: unknown[];
  // 本次 build plan 的审计事件数量
  eventCount: number;
  // 本次使用的 plan-build skill
  planBuildSkill: PlanBuildSkill;
};

function sha256Text(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function downloadPlanBuildSkill(
  ref: PlanBuildSkillRef,
  cacheDir: string,
): Promise<PlanBuildSkill> {
  const localPath = join(cacheDir, ref.skillId, ref.version, "SKILL.md");
  let instructions: string;

  if (ref.source.kind === "remote_url") {
    const response = await fetch(ref.source.url);
    if (!response.ok) {
      throw new Error(`Failed to download plan-build skill: ${response.status}`);
    }

    instructions = await response.text();
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, instructions, "utf8");
  } else {
    instructions = await readFile(ref.source.path, "utf8");
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, instructions, "utf8");
  }

  const contentHash = sha256Text(instructions);
  if (ref.expectedContentHash && ref.expectedContentHash !== contentHash) {
    throw new Error("plan-build skill content hash mismatch");
  }

  return {
    skillId: ref.skillId,
    version: ref.version,
    sourceRef: ref.source,
    localPath,
    contentHash,
    instructions,
    loadedAt: new Date().toISOString(),
  };
}

function buildRuntimePlanPrompt(
  input: RuntimePlanBuildInput,
  skill: PlanBuildSkill,
): string {
  return [
    "你是 AppPilot 的 Runtime Plan Builder。",
    "你必须先遵循 <plan_build_skill> 中的规则，再把 ValidatorAsset 和 run options 编译成具体 RuntimeExecutionPlan。",
    "输出必须是一个 JSON object，且必须符合提供的 RuntimeExecutionPlan schema。",
    "不要输出 Markdown，不要解释过程，不要写外部资产，不要生成 ValidationWritebackPackage。",
    "RuntimeExecutionPlan 是 AppPilot 内部执行计划，不属于外部 ValidatorAsset 契约。",
    "一个 run 只表达一个验证场景；多个 targetInstances 只表示同一场景下的多设备或 Editor 执行。",
    "Run Event Bus 只表达 step 级、系统级、timer / observation window、外部输入和人工确认事件；App WebSocket、日志 watcher、UI 观测和截图默认编译为证据采集或 ReAct observation。",
    "iOS UI 控制必须使用 WDA，Android UI 控制必须使用 uiautomator2。",
    "证据要求必须规范化为 EvidenceRequirement，并绑定到 plan 或 step 的 expectedEvidence。",
    "可缓存 plan 不得包含 run 内事件序号、timer 状态、checkpoint 状态或 artifact 实例引用。",
    "<plan_build_skill>",
    skill.instructions,
    "</plan_build_skill>",
    "<validator_asset_snapshot_json>",
    JSON.stringify(input.validatorAssetSnapshot),
    "</validator_asset_snapshot_json>",
    "<run_options_snapshot_json>",
    JSON.stringify(input.runOptionsSnapshot),
    "</run_options_snapshot_json>",
    "<runtime_context_json>",
    JSON.stringify(input.runtimeContext),
    "</runtime_context_json>",
    "<runtime_execution_plan_schema_json>",
    JSON.stringify(input.runtimeExecutionPlanSchema),
    "</runtime_execution_plan_schema_json>",
  ].join("\n");
}

function parseRuntimeExecutionPlan(rawAgentResponse: string): RuntimeExecutionPlan {
  return JSON.parse(rawAgentResponse) as RuntimeExecutionPlan;
}

async function buildRuntimeExecutionPlanWithCodex(
  session: CodexAgentSession,
  input: RuntimePlanBuildInput,
): Promise<RuntimePlanBuildResult> {
  if (session.disposed) {
    throw new Error("Codex agent session has been disposed");
  }

  const skill = await downloadPlanBuildSkill(
    input.planBuildSkillRef ?? DEFAULT_PLAN_BUILD_SKILL_REF,
    input.skillCacheDir,
  );
  const prompt = buildRuntimePlanPrompt(input, skill);

  const abortController = new AbortController();
  session.activeAbortController = abortController;

  const timeout = input.timeoutMs
    ? setTimeout(() => abortController.abort("build_plan_timeout"), input.timeoutMs)
    : undefined;

  const items: unknown[] = [];
  let rawAgentResponse = "";
  let eventCount = 0;

  try {
    const { events } = await session.thread.runStreamed(
      [
        {
          type: "text",
          text: prompt,
        },
      ],
      {
        outputSchema: input.runtimeExecutionPlanSchema,
        signal: abortController.signal,
      },
    );

    for await (const event of events as AsyncGenerator<ThreadEvent>) {
      eventCount += 1;

      if (event.type === "thread.started") {
        session.threadId = event.thread_id;
      }

      await session.audit.writeAgentEvent({
        taskId: input.taskId,
        runId: input.runId,
        threadId: session.threadId ?? session.thread.id,
        purpose: "build_runtime_plan",
        planBuildSkill: {
          skillId: skill.skillId,
          version: skill.version,
          contentHash: skill.contentHash,
          localPath: skill.localPath,
        },
        event,
        observedAt: new Date().toISOString(),
      });

      if (event.type === "item.completed") {
        items.push(event.item);

        if (event.item.type === "agent_message") {
          rawAgentResponse = event.item.text;
        }
      }

      if (event.type === "turn.failed") {
        throw new Error(event.error.message);
      }
    }

    const threadId = session.threadId ?? session.thread.id;
    if (!threadId) {
      throw new Error("Codex thread ID was not established");
    }

    const runtimeExecutionPlan = parseRuntimeExecutionPlan(rawAgentResponse);

    return {
      threadId,
      runtimeExecutionPlan,
      rawAgentResponse,
      items,
      eventCount,
      planBuildSkill: skill,
    };
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }

    if (session.activeAbortController === abortController) {
      session.activeAbortController = undefined;
    }
  }
}
```

### 3.4 Agent 响应模式

Agent 在 run 内响应三类事件：

- 进度事件：理解 step 级进展，例如 `step_started`、`step_completed` 或 `step_blocked`，并给出下一步建议；原子动作不通过 Event Bus 驱动。
- 心跳事件：检查 ReAct 循环是否长时间没有新迭代、step 预算和 run 预算是否接近耗尽。
- 异常事件：对 step 级失败、工具系统性不可用、Runtime 状态不一致或 run 级预算耗尽做恢复决策。

### 3.5 Agent Review

证据产出后，agent 检查证据是否充分、结果解释是否成立、失败是否可能来自环境或不稳定因素，并生成反馈。

agent review 可以建议补采证据、重新执行 ReAct step、停止 run 或提示人工介入，但这些建议仍必须通过 AppPilot runtime 记录，并进入人工确认流程。Agent 的检查反馈不能替代人工确认。

### 3.6 恢复规则

Agent session 恢复以 AppPilot 本地状态为准。恢复时必须先读取 SQLite checkpoint、Run Event Bus 游标、未完成 timer、已处理事件记录、证据索引和 agent 历史输出。

如果原 Codex Agent SDK session 可恢复，AppPilot 绑定原 session 并继续执行。如果原 session 不可恢复，AppPilot 创建新的 Codex Agent SDK session，并把历史 session 的输入、输出、工具调用、检查反馈和人工确认提示作为上下文恢复材料。

### 3.7 Agent Schema

Agent schema 只表达 AppPilot runtime 内部的 agent 控制状态、请求、审计、检查反馈、决策记录和人工提示。

```ts
// agent session 状态
type AgentSessionState =
  // 已创建，尚未开始执行
  | "created"
  // 正在运行
  | "running"
  // 被 AppPilot 中止
  | "aborted"
  // 已完成
  | "completed"
  // 失败
  | "failed"
  // 已释放本地引用
  | "disposed";

// agent request 用途
type AgentRequestPurpose =
  // 编译 RuntimeExecutionPlan
  | "build_runtime_plan"
  // 响应 run 内事件
  | "handle_event"
  // 检查证据和结果解释
  | "review_evidence"
  // 生成恢复决策
  | "decide_recovery"
  // 准备人工确认提示
  | "prepare_human_confirmation";

// agent session 本地记录
type AgentSessionRecord = {
  // agent session ID
  agentSessionId: string;
  // 本地任务 ID
  taskId: string;
  // 单次验证 run ID
  runId: string;
  // Codex thread ID
  codexThreadId?: string;
  // Codex 模型名称
  model?: string;
  // Codex SDK 版本
  codexSdkVersion?: string;
  // AppPilot runtime 版本
  appPilotRuntimeVersion: string;
  // AppPilot 工作目录
  workingDirectory: string;
  // 允许 agent 访问的额外目录
  additionalDirectories?: string[];
  // session 状态
  state: AgentSessionState;
  // agent 权限策略引用
  permissionPolicyRef: string;
  // agent 预算策略引用
  budgetPolicyRef?: string;
  // 关联的 plan-build skill hash
  planBuildSkillHash?: string;
  // session 创建时间
  createdAt: string;
  // session 启动时间
  startedAt?: string;
  // session 结束时间
  finishedAt?: string;
  // session dispose 时间
  disposedAt?: string;
  // 最近一次错误
  lastError?: string;
};

// agent request 本地记录
type AgentRequestRecord = {
  // agent request ID
  agentRequestId: string;
  // agent session ID
  agentSessionId: string;
  // 本地任务 ID
  taskId: string;
  // 单次验证 run ID
  runId: string;
  // 请求用途
  purpose: AgentRequestPurpose;
  // 关联事件 ID；非事件驱动请求为空
  eventId?: string;
  // 关联 step ID；无法归属到单个 step 时为空
  stepId?: string;
  // prompt artifact 引用
  promptRef: string;
  // output schema 引用
  outputSchemaRef?: string;
  // agent 原始响应 artifact 引用
  responseRef?: string;
  // Codex thread ID
  codexThreadId?: string;
  // Codex turn ID
  codexTurnId?: string;
  // 请求状态
  state: "pending" | "running" | "completed" | "failed" | "aborted";
  // 请求超时时间
  timeoutMs?: number;
  // 请求创建时间
  createdAt: string;
  // 请求开始时间
  startedAt?: string;
  // 请求完成时间
  completedAt?: string;
  // 请求错误
  error?: string;
};

// agent 事件审计记录
type AgentEventAuditRecord = {
  // 审计记录 ID
  auditId: string;
  // agent session ID
  agentSessionId: string;
  // agent request ID
  agentRequestId?: string;
  // 本地任务 ID
  taskId: string;
  // 单次验证 run ID
  runId: string;
  // Codex thread ID
  codexThreadId?: string;
  // Codex 事件类型
  codexEventType: string;
  // Codex 事件 payload 引用
  payloadRef?: string;
  // 小型结构化摘要
  summary?: Record<string, unknown>;
  // 事件观察时间
  observedAt: string;
};

// agent 决策记录
type AgentDecisionRecord = {
  // 决策 ID
  decisionId: string;
  // agent request ID
  agentRequestId: string;
  // 单次验证 run ID
  runId: string;
  // 关联事件 ID
  eventId?: string;
  // 关联 step ID
  stepId?: string;
  // 决策类型
  decisionType: "next_action" | "recovery" | "evidence_review" | "human_prompt";
  // 建议动作
  action: "advance" | "retry" | "degrade" | "stop" | "collect_more_evidence" | "prompt_human";
  // 决策理由
  reason: string;
  // 支撑证据引用
  evidenceRefs?: string[];
  // 决策置信度
  confidence?: number;
  // 是否已被 runtime 应用
  appliedByRuntime: boolean;
  // runtime 应用时间
  appliedAt?: string;
  // 决策创建时间
  createdAt: string;
};

// agent 证据检查结果
type AgentReviewResult = {
  // review ID
  reviewId: string;
  // agent request ID
  agentRequestId: string;
  // 单次验证 run ID
  runId: string;
  // 检查范围
  scope: "run" | "instance" | "step";
  // 验证实例 ID；run 级 review 为空
  instanceId?: string;
  // 关联 step ID；非 step 级 review 为空
  stepId?: string;
  // 证据是否充分
  evidenceSufficient: boolean;
  // 缺失证据要求 ID 列表
  missingEvidenceRequirementIds?: string[];
  // 结果解释是否成立
  interpretationValid: boolean;
  // 失败是否可能来自环境或不稳定因素
  possibleFlakyOrEnvironmental: boolean;
  // 建议动作列表
  recommendedActions: AgentDecisionRecord["action"][];
  // 支撑证据引用
  evidenceRefs: string[];
  // review 摘要
  summary: string;
  // review 创建时间
  createdAt: string;
};

// agent 生成人工确认提示
type AgentHumanPromptQuestion = {
  // 问题 ID
  questionId: string;
  // 问题文本
  text: string;
  // 是否必须回答
  required: boolean;
};

// agent 生成人工确认提示
type AgentHumanPrompt = {
  // 人工提示 ID
  promptId: string;
  // agent request ID
  agentRequestId: string;
  // 单次验证 run ID
  runId: string;
  // 提示类型
  promptType: "confirm_result" | "confirm_evidence_scope" | "confirm_writeback_material" | "manual_intervention";
  // 提示标题
  title: string;
  // 提示正文
  message: string;
  // 需要人工确认的问题
  questions: AgentHumanPromptQuestion[];
  // 关联证据引用
  evidenceRefs?: string[];
  // 关联写回材料引用
  writebackMaterialRefs?: string[];
  // 提示状态
  state: "pending" | "answered" | "dismissed";
  // 创建时间
  createdAt: string;
  // 回答时间
  answeredAt?: string;
};
```

## 4. ReAct 执行层

### 4.1 执行层边界

ReAct 执行层负责执行 `RuntimeExecutionStep.kind: "react_task"` 的步骤。每个 ReAct step 都是一个任务目标，Agent 在 Runtime 授权的原子工具内执行 `Reasoning -> Acting -> Observing` 循环，直到 Runtime 独立验证 `successCriteria.verificationRules` 通过，或达到退出态。

ReAct 内部 observation 不写入 Run Event Bus。找不到按钮、坐标不准、工具返回空、单次工具调用错误、verification feedback 都只是 ReAct 循环的 observation，由 Agent 在下一轮继续调整策略。

Run Event Bus 只承载 step 级、系统级和外部输入级事件。ReAct step 失败、超时、被阻塞或通过 Runtime 验证时，Runtime 才发布 step 级事件。

每一轮 ReAct 迭代必须持久化为 `ReactIterationRecord`，写入 run 目录的 `agent/` 目录，并把产生的 artifact 同步登记到 Evidence Store。默认只保存 `reasoningSummary`，不要求保存完整内部思维链；`fullReasoningRef` 仅在策略允许且 SDK 可提供时写入。

step 是否完成只由 Runtime 重新采证并验证 `verificationRules` 决定。Agent 自评、自然语言声明或 `successCriteria.intentDescription` 都不能作为通过结论。

### 4.2 执行流程

```text
RuntimeExecutionStep(kind: react_task)
  -> 初始化 ReAct 循环：intent + successCriteria.intentDescription + availableTools + budget
  -> Agent 执行 reasoningSummary / action / observation
  -> 每轮写入 ReactIterationRecord
  -> Agent 认为已完成或 Runtime 到达检查点
  -> Runtime 独立采集证据并验证 verificationRules
       -> 通过：发布 step_completed
       -> 不通过：生成 VerificationFeedback，作为下一轮 observation
       -> 无法判定：根据 unknownRules 决定继续、blocked 或诊断记录
  -> 循环直到 runtime_verified、max_iterations、timeout 或 agent_blocked
```

普通工具失败不是异常。只有 ReAct 预算耗尽、step 超时、Agent 主动声明 blocked、工具系统性不可用或 Runtime 状态不一致，才进入 step 级失败、blocked 或异常路径。

### 4.3 ReAct 迭代记录 Schema

```ts
// 单轮 ReAct 迭代记录，强制持久化到 agent/ 目录
type ReactIterationRecord = {
  // 迭代 ID
  iterationId: string;
  // 关联步骤 ID
  stepId: string;
  // 单次验证 run ID
  runId: string;
  // 验证实例 ID；run 级 step 为空
  instanceId?: string;
  // 同一 step 内递增的迭代序号
  iterationNumber: number;
  // 本轮决策的可审计摘要；说明为什么选择该工具、期望达成什么，不保存完整内部思维链
  reasoningSummary: string;
  // 完整推理过程引用；仅在 ReactPolicy.persistFullReasoning 为 true 且 SDK 可提供时写入
  fullReasoningRef?: string;
  // 调用的工具名称
  action: string;
  // 工具输入
  actionInput: unknown;
  // observation 来源
  observationSource: "tool_call" | "verification_feedback";
  // 给下一轮 Agent 看的简要 observation 文本
  observation: string;
  // 大体积或结构化 observation 引用
  observationRef?: string;
  // 该轮产出的 artifact 引用列表
  artifactRefs?: string[];
  // 工具调用本身的错误；这是 ReAct observation，不是 step 级失败
  toolError?: {
    // 工具错误码
    code: string;
    // 工具错误描述
    message: string;
  };
  // Runtime 验证反馈；observationSource 为 verification_feedback 时填写
  verificationFeedback?: VerificationFeedback;
  // 迭代开始时间
  startedAt: string;
  // 迭代结束时间
  finishedAt: string;
  // 写入时间
  persistedAt: string;
};
```

### 4.4 验证反馈 Schema

```ts
// Runtime 验证 successCriteria 的反馈
type VerificationFeedback = {
  // 验证尝试 ID，同一 step 内多次验证可追溯
  verificationAttemptId: string;
  // 验证执行时间
  performedAt: string;
  // 通过的规则 ID 列表
  passedRules: string[];
  // 未通过的规则列表
  failedRules: Array<{
    // 规则 ID
    ruleId: string;
    // 期望描述
    expected: string;
    // 实际采集到的描述
    actual: string;
    // 采集到的原始证据引用
    evidenceRef?: string;
  }>;
  // 因采证失败而无法判定的规则列表
  unknownRules?: Array<{
    // 规则 ID
    ruleId: string;
    // 采证失败原因
    reason: string;
    // 采证错误码
    errorCode?: string;
  }>;
};
```

`unknownRules` 包含 required 规则时，step 不能进入 `step_completed`。Runtime 应把 `VerificationFeedback` 回喂给 ReAct 循环，Agent 可以继续尝试、换策略或通过 `internal.react.declare_blocked` 声明 blocked。仅 context 规则 unknown 时，不阻断 step completed，但必须记录到诊断信号或审计材料中。

verification feedback 作为一轮 ReAct observation 计入 `maxIterations`，避免把 Runtime 验证当成免费探测工具。

### 4.5 Step 退出态

```ts
// ReAct 任务退出原因
type StepReactExitReason =
  // Runtime 独立验证通过
  | "runtime_verified"
  // ReAct 预算耗尽
  | "max_iterations"
  // step 超时
  | "timeout"
  // Agent 主动声明前提不成立或无法继续
  | "agent_blocked";

// Agent 声明 blocked 的原因分类
type AgentBlockedReason =
  // App 闪退或不可用
  | "app_crashed"
  // 目标 UI 元素被隐藏或不存在
  | "ui_unreachable"
  // 授权工具集不足以完成 successCriteria
  | "tool_missing"
  // ValidatorAsset 描述的前提条件未达成
  | "precondition_failed"
  // 其他原因，必须配合自由文本说明
  | "other";

// Agent 主动声明 blocked 的输入
type ReactDeclareBlockedInput = {
  // blocked 原因分类
  reason: AgentBlockedReason;
  // 可读说明
  message: string;
  // 支撑 blocked 判断的证据引用
  evidenceRefs?: string[];
};
```

Agent 只能通过 `internal.react.declare_blocked` 声明 blocked。该工具的语义是退出当前 ReAct 循环，并由 Runtime 将 step 转为 `step_blocked`，再发布 step 级事件。它不是普通 observation，也不参与后续 ReAct 推理。

## 5. Event Bus

### 5.1 事件总线边界

Run Event Bus 是单次 `ValidationRun` 内的本地事件总线。它只记录和分发 run 内发生过的 step 级、系统级和外部输入级事实，例如 step 开始或完成、定时器到期、观察窗口开始或结束、设备安装、外部 hook 输入到达或人工确认完成。事件本身不直接表达 run 的最终通过或失败；验证结论由 runtime step、extractor、result interpretation 和 agent review 基于证据共同判断。

`Run Event Bus` 是内部 runtime 的事件层，不属于外部 `ValidatorAsset` 输入契约。它负责事件写入、排序、持久化、查询和幂等读取；它不直接解释事件，也不直接修改 step 状态。

`RuntimeExecutionPlan` 确定后，AppPilot 初始化 Run Event Bus、timer templates 和观察窗口。device watcher、外部 hook、scheduler、Runtime step executor 和人工确认流程可以写入 Run Event Bus；ReAct 内部 observation 不写入 Run Event Bus。

Run Event Bus 中的事件分为三类：

* 进度事件，用于推进执行计划；
* 心跳事件，用于检查 ReAct 循环卡顿、step 预算和 run 预算；
* 异常事件，用于触发 agent 在重试、降级、停止和提示人工之间做决策。心跳由 runtime monitor 根据条件触发，`intervalMs` 只作为兜底。

`runtime_tick` 不写入 Run Event Bus。它只在 AppPilot runtime monitor 内部消费，用于证据采集、状态检查、stall 检测、预算检查和调度健康检查。只有当 `HeartbeatPolicy` 或异常策略判断出有意义信号时，才向 Run Event Bus 写入 Agent 可见的 `heartbeat` 或 `exception` 事件。

职责拆分：

- Event Bus：写入、排序、持久化、读取事件。
- Scheduler：把 timer、观察窗口和心跳条件变成事件。
- Watcher / Hook：把外部输入、设备生命周期、App 安装状态和人工确认变成事件；日志与 App WebSocket 默认写入证据或 ReAct observation。
- Step Dispatcher：根据 `RuntimeExecutionPlan`、ReAct 退出态和 Runtime 验证结果推进 step。
- Agent：对进度、心跳、异常事件做策略响应。

### 5.2 事件 Schema

```ts
// run 内事件分类
type ValidationEventCategory =
  // 正常进度事件，用于推进执行计划
  | "progress"
  // 心跳事件，用于检查预算、卡顿和策略调整
  | "heartbeat"
  // 异常事件，用于触发重试、降级、停止或人工提示
  | "exception";

// run 内事件严重级别
type ValidationEventSeverity =
  // 信息级事件
  | "info"
  // 警告级事件
  | "warning"
  // 错误级事件
  | "error"
  // 致命事件，通常需要停止或人工介入
  | "fatal";

// agent 对事件的响应模式
type AgentEventResponseMode =
  // 正常推进执行计划
  | "advance_plan"
  // 检查预算、卡顿和策略
  | "review_health"
  // 对异常做重试、降级、停止或人工提示决策
  | "decide_recovery";

// 异常事件建议动作
type ExceptionEventAction =
  // 立即重试当前步骤或工具调用
  | "retry"
  // 降级执行策略，例如减少采样、换证据通道或跳过非必需步骤
  | "degrade"
  // 停止当前 run
  | "stop"
  // 提示人工确认或人工介入
  | "prompt_human";

// run 内事件类型；事件只表达 Runtime 可观测的事实，不直接表达验证结论
type ValidationEventType =
  // step 已开始
  | "step_started"
  // step 已完成；Runtime 验证 successCriteria 通过
  | "step_completed"
  // step 失败；通常由预算耗尽或超时触发
  | "step_failed"
  // step 卡住；心跳检测到 ReAct 循环无进展
  | "step_stalled"
  // step 被阻塞；Agent 主动声明前提不成立或无法继续
  | "step_blocked"
  // 工具系统性不可用，例如 WDA、uiautomator2 或 App WebSocket bridge 不可用
  | "tool_system_unavailable"
  // Runtime 状态不一致，例如 checkpoint 或数据库状态不一致
  | "runtime_state_inconsistent"
  // run 级总预算耗尽
  | "budget_exhausted"
  // 心跳已发出
  | "heartbeat_emitted"
  // 内部定时器到期
  | "timer_fired"
  // 观察窗口开始
  | "observe_window_started"
  // 观察窗口结束
  | "observe_window_finished"
  // 设备已连接
  | "device_connected"
  // 设备已断开
  | "device_disconnected"
  // App 已安装
  | "app_installed"
  // App 已卸载
  | "app_uninstalled"
  // App 被覆盖安装或替换
  | "app_replaced"
  // 外部输入事件已收到
  | "external_event_received"
  // 人工已确认
  | "human_confirmed"
  // 人工已拒绝
  | "human_rejected"
  // Agent 已完成 run 级或材料级检查
  | "agent_review_completed";

// run 内事件来源
type ValidationEventSource =
  // runtime 安全监控器
  | "runtime_monitor"
  // 内部 scheduler
  | "scheduler"
  // step executor
  | "step_executor"
  // 设备 watcher
  | "device_watcher"
  // 外部输入函数
  | "external_input"
  // 人工确认流程
  | "human"
  // Agent review 或 agent plan
  | "agent";

// run 内事件
type ValidationEvent = {
  // 事件唯一 ID，用于幂等和审计
  eventId: string;
  // 单次验证 run ID
  runId: string;
  // 长任务 ID
  taskId: string;
  // 验证实例 ID；run 级事件为空
  instanceId?: string;
  // 关联步骤 ID；无法归属到单个步骤时为空
  stepId?: string;
  // run 内递增事件序号
  sequence: number;
  // 事件类型
  type: ValidationEventType;
  // 事件分类
  category: ValidationEventCategory;
  // 事件严重级别
  severity: ValidationEventSeverity;
  // agent 响应模式
  agentResponseMode: AgentEventResponseMode;
  // 事件来源
  source: ValidationEventSource;
  // 事件发生时间
  occurredAt: string;
  // AppPilot 接收或写入事件时间
  receivedAt: string;
  // 事件 payload 引用；大型 payload 不直接进入数据库
  payloadRef?: string;
  // 小型结构化 payload；仅用于轻量匹配和状态展示
  payload?: Record<string, unknown>;
  // 关联证据引用
  evidenceRefs?: string[];
  // 外部幂等键；外部输入事件可提供
  idempotencyKey?: string;
};

// 心跳事件 payload
type HeartbeatEventPayload = {
  // 心跳触发原因
  reason: "interval" | "step_react_stall" | "step_budget_usage" | "run_budget_usage";
  // 当前步骤 ID
  currentStepId?: string;
  // 当前步骤已运行时间
  stepElapsedMs?: number;
  // 最近一轮 ReAct 迭代 ID
  lastReactIterationId?: string;
  // 距离最近一轮 ReAct 迭代过去多久
  reactSilentMs?: number;
  // step 预算使用比例
  stepBudgetUsageRatio?: number;
  // run 预算使用比例
  runBudgetUsageRatio?: number;
  // 建议 agent 或 runtime 检查的项目
  recommendedChecks: Array<"step_progress" | "step_budget" | "run_budget">;
};

// 异常事件 payload
type ExceptionEventPayload = {
  // 异常码
  code:
    | "STEP_REACT_STALLED"
    | "STEP_BUDGET_EXHAUSTED"
    | "RUN_BUDGET_EXHAUSTED"
    | "TOOL_SYSTEM_UNAVAILABLE"
    | "RUNTIME_STATE_INCONSISTENT";
  // 异常描述
  message: string;
  // 关联步骤 ID
  stepId?: string;
  // 关联内部工具名称
  tool?: string;
  // 建议动作候选
  actionCandidates: ExceptionEventAction[];
  // runtime 选出的默认建议动作
  recommendedAction?: ExceptionEventAction;
  // 最近一次进度事件 ID
  lastProgressEventId?: string;
  // 最近一次心跳事件 ID
  lastHeartbeatEventId?: string;
  // 最近一轮 ReAct 迭代 ID
  lastReactIterationId?: string;
  // 关联证据引用
  evidenceRefs?: string[];
};
```

### 5.3 事件生成和消费规则

- Run Event Bus 只接收 step 级、系统级、timer / observation window、外部输入和人工确认事件。
- ReAct 内部 observation 不写入 Run Event Bus；工具单次失败、查找 UI 失败、verification feedback 和普通策略调整都写入 `ReactIterationRecord`。
- `step_started` 在 Runtime 开始执行一个 `RuntimeExecutionStep` 时写入。
- `step_completed` 只能由 Runtime 独立验证 `successCriteria.verificationRules` 通过后写入，Agent 自评不能触发该事件。
- `step_failed` 用于 ReAct 预算耗尽、step 超时或连续 verification 失败超过策略阈值。
- `step_blocked` 只能由 `internal.react.declare_blocked` 或 Runtime 确认前提不成立后写入。
- `tool_system_unavailable` 只表达工具系统性不可用，例如 WDA、uiautomator2、App WebSocket bridge 或关键构建工具不可用；单次工具调用错误不是该事件。
- `runtime_state_inconsistent` 表达 checkpoint、SQLite、artifact 索引或 run 状态不一致。
- `heartbeat_emitted` 必须设置 `agentResponseMode: "review_health"`，用于检查 step ReAct 循环是否长时间无新迭代、step 预算或 run 预算是否接近耗尽。
- `exception` 类事件必须设置 `agentResponseMode: "decide_recovery"`，并在 payload 中记录建议动作、关联 step、最近进度事件、最近 ReAct 迭代和支撑证据引用。
- timer 到期由 scheduler 发布 `timer_fired`，并更新 timer 状态；是否影响当前 step 由 Runtime 按当前 step 状态决定。
- 观察窗口由 scheduler 发布 `observe_window_started` 和 `observe_window_finished`；事件 payload 必须包含 `windowId`，并尽量携带 `instanceId` 和 `stepId` 用于并发窗口消歧。
- device watcher 只发布设备生命周期事件和 App 安装、卸载、覆盖安装事件。App 前后台、日志命中、App WebSocket 消息、UI tree、截图和工具结果都作为 ReAct observation 或 evidence artifact 记录，不作为 Run Event Bus 事件。
- `external_input` 只通过 `external.event.emit` 写入 `external_event_received`，不直接修改 step 状态。
- 每个事件处理结果必须落库，避免恢复后重复处理同一 step 级或系统级事件。
- agent 决策不能直接修改 step 状态；它只能产出 recovery decision、review 或 blocked 声明，由 Runtime 记录并推进状态。

## 6. Timer 与 Scheduler

### 6.1 调度边界

Timer 与 Scheduler 是 run 内部机制。它们用于延迟检查、跨小时或跨天观察窗口、心跳触发和事件唤醒，不创建外部长期调度任务。

`RuntimeExecutionPlan` 确定后，AppPilot 初始化 Internal Scheduler。scheduler 负责把 timer 到期、观察窗口和心跳条件转换为 run 内事件；runtime tick 只驱动内部轮询和健康检查，不转换为 run 内事件。

Scheduler 只把 timer 到期、心跳条件和观察窗口边界转换为事件，并更新本地调度状态。是否推进 step 由 Runtime 根据当前 step 状态、ReAct 退出态和 Runtime 验证结果决定。

### 6.2 Timer Schema

```ts
// run 内定时器
type RunTimer = {
  // 定时器 ID
  timerId: string;
  // 单次验证 run ID
  runId: string;
  // 验证实例 ID；run 级定时器为空
  instanceId?: string;
  // 定时器关联步骤 ID
  stepId: string;
  // 定时器调度方式
  schedule: {
    // 调度类型
    kind: "delay" | "at" | "interval";
    // 延迟触发毫秒数；kind 为 delay 时使用
    delayMs?: number;
    // 指定触发时间；kind 为 at 时使用
    fireAt?: string;
    // 周期触发间隔毫秒数；kind 为 interval 时使用
    intervalMs?: number;
    // 最大触发次数；kind 为 interval 时使用
    maxFires?: number;
  };
  // 定时器状态
  status: "scheduled" | "fired" | "cancelled" | "expired";
  // 下一次触发时间
  nextFireAt?: string;
  // 已触发次数
  firedCount: number;
  // 到期后发布的事件类型
  emits: "timer_fired";
  // 定时器创建时间
  createdAt: string;
  // 最近更新时间
  updatedAt: string;
};
```

### 6.3 调度规则

- `intervalMs` 只是心跳兜底；`step_react_stall`、`step_budget_usage` 和 `run_budget_usage` 应作为 `HeartbeatEventPayload.reason` 触发 heartbeat。
- Event Bus 积压超过 `EventBusBackpressurePolicy.pauseThreshold` 时，scheduler 和 watcher 应暂停非关键进度事件、证据采样事件和诊断噪声事件；积压低于 `EventBusBackpressurePolicy.resumeThreshold` 后恢复。关键异常事件仍可写入，但必须去重或限流。
- timer 到期时，scheduler 必须以事务方式同时更新 timer 状态并写入 `timer_fired` 事件。
- 观察窗口开始和结束时，scheduler 必须分别写入 `observe_window_started` 和 `observe_window_finished` 事件，事件 payload 必须包含 `windowId`。

## 7. 长任务与 Checkpoint

### 7.1 长任务状态 Schema

AppPilot 验证任务是长任务，只能在阶段边界安全恢复。

```ts
// 验证长任务状态枚举
type ValidationTaskState =
  // 任务已创建
  | "created"
  // 任务已进入队列
  | "queued"
  // 任务运行中
  | "running"
  // Agent 正在理解任务并生成计划
  | "agent_planning"
  // Agent 正在调用授权工具执行非 ReAct 任务
  | "agent_executing"
  // Agent 正在执行 ReAct 循环
  | "react_executing"
  // Agent 正在检查证据并生成反馈
  | "agent_reviewing"
  // 等待 agent 反馈或人工确认提示落盘
  | "waiting_agent_feedback"
  // 等待外部 artifact、设备或工具结果
  | "waiting_artifacts"
  // 等待 Runtime 处理 run 内事件
  | "waiting_event"
  // Runtime 正在观察窗口内采集证据
  | "observing"
  // 正在抽取证据
  | "extracting_evidence"
  // 正在生成 ExecutionFact
  | "building_execution_facts"
  // 等待人工确认执行结果
  | "waiting_result_confirmation"
  // 执行结果已确认
  | "result_confirmed"
  // 等待是否生成写回材料的决策
  | "waiting_backflow_decision"
  // 正在生成 ValidatorAssetGenerationMaterial
  | "building_validator_asset_material"
  // 等待人工确认生成材料
  | "waiting_material_confirmation"
  // 正在生成 ValidationWritebackPackage
  | "generating_writeback_package"
  // 写回材料包已写入
  | "writeback_package_written"
  // 任务完成
  | "completed"
  // 任务失败
  | "failed"
  // 任务取消
  | "cancelled"
  // 任务中断，可从 checkpoint 恢复
  | "interrupted";

// 单次验证长任务中的阶段检查点
type ValidationTaskCheckpoint = {
  // 检查点 ID
  checkpointId: string;
  // 阶段名称
  phase: string;
  // 阶段输入 hash
  inputHash: string;
  // 阶段输出引用列表
  outputRefs: string[];
  // 阶段完成时间
  completedAt: string;
};

// 单次验证长任务的持久化状态
type ValidationTask = {
  // 长任务 ID
  taskId: string;
  // 单次验证 run ID
  runId: string;
  // 本次运行参数快照 ID
  runOptionsId?: string;
  // 本次执行使用的 ValidatorAsset ID
  validatorAssetId: string;
  // 本次执行关联的外部验证事实 ID 列表
  validationFactIds: string[];
  // 当前任务状态
  state: ValidationTaskState;
  // 当前阶段名称
  currentPhase?: string;
  // 本任务在本地状态数据库中的记录引用
  stateDbRef?: string;
  // 任务输入引用
  inputs: {
    // 本次运行参数快照引用
    runOptionsRef: string;
    // 本次实际使用的 ValidatorAsset 存储引用
    validatorAssetRef: string;
    // Agent 控制配置存储引用
    agentControlRef?: string;
    // 设备或 Editor 会话引用列表
    deviceSessionRefs: string[];
  };
  // 任务输出引用
  outputs: {
    // ValidationInstance 存储引用列表
    validationInstanceRefs?: string[];
    // RunAggregationResult 存储引用
    runAggregationResultRef?: string;
    // ExecutionResult 存储引用
    executionResultRef?: string;
    // EvidenceBundle 存储引用
    evidenceBundleRef?: string;
    // ExecutionFact 存储引用列表
    executionFactRefs?: string[];
    // ValidatorAssetGenerationMaterial 存储引用
    validatorAssetMaterialRef?: string;
    // ValidationWritebackPackage 存储引用
    writebackPackageRef?: string;
    // 证据摘要存储引用
    evidenceSummaryRef?: string;
    // AgentSessionRecord 存储引用
    agentSessionRef?: string;
    // agent 计划 artifact 存储引用
    agentPlanRef?: string;
    // RuntimeExecutionPlan 存储引用
    runtimePlanRef?: string;
    // AgentReviewResult 存储引用列表
    agentReviewRefs?: string[];
    // AgentHumanPrompt 存储引用列表
    humanPromptRefs?: string[];
  };
  // 已完成阶段的检查点
  checkpoints: ValidationTaskCheckpoint[];
  // 最近一个可恢复检查点 ID
  lastCheckpointId?: string;
  // 当前任务尝试次数
  attempts: number;
  // 是否已请求取消
  cancelRequested?: boolean;
  // 当前错误信息
  error?: {
    // 稳定错误码
    code: string;
    // 错误描述
    message: string;
    // 是否可从当前阶段恢复
    recoverable: boolean;
  };
};
```

### 7.2 检查点规则

- `RuntimeExecutionPlan` 确定后，AppPilot 初始化 SQLite checkpoint。checkpoint 负责恢复边界，必须和任务状态、事件游标、timer 状态、artifact 引用保持一致。
- 任务只能从已完成的阶段边界恢复。
- 已经生成稳定 output ref 的写入动作不得重复执行。
- 已确认的 `ExecutionFact` 不做原地覆盖。
- 验证需求或验证流程变化时，调用方必须启动新的 run。
- 检查点、任务状态和事件索引必须先写入本地状态数据库，再暴露给 `validation_status` 和恢复调度。
- scheduler 到期必须以事务方式同时更新 timer 状态并写入 `timer_fired` 事件；被唤醒 step 和状态推进由 Runtime 事件处理记录表达。
- 外部输入事件必须支持 `idempotencyKey` 去重，避免 hook 重放导致重复推进。
- Runtime 处理 step 级或系统级事件后必须写入 `DbEventProcessingRecord`；恢复时以该记录判断事件处理是否已经执行。

## 8. 本地数据库

### 8.1 数据库边界

AppPilot 使用小型本地 SQLite 数据库作为任务控制的状态核心。数据库负责 run、validation instance、evidence instance、checkpoint、状态恢复、任务审计事件、run 内事件 bus、timer、runtime 健康状态、事件处理记录、runtime plan cache 索引和 artifact 引用索引；大体积 artifact 正文仍然保存在 run 目录中。

### 8.2 数据库路径

数据库路径：

```text
~/.apppilot/state/apppilot.sqlite
```

### 8.3 数据库记录 Schema

数据库使用 WAL 模式。每个阶段边界必须在同一个事务中写入任务状态、任务审计事件、run 内事件、timer 状态、事件处理记录、checkpoint 记录和新增 artifact 引用。这样即使进程中断，恢复流程也能从数据库中找到最后一个一致的 checkpoint。

```ts
// 本地状态数据库配置
type LocalStateDatabaseConfig = {
  // 数据库引擎，固定为 sqlite
  engine: "sqlite";
  // SQLite 数据库文件路径
  path: string;
  // journal 模式，默认使用 WAL
  journalMode: "wal";
  // busy timeout，避免短时间并发读写直接失败
  busyTimeoutMs?: number;
  // 是否在启动时执行恢复扫描
  recoverOnStartup: boolean;
};

// 数据库中的验证 run 记录
type DbValidationRunRecord = {
  // 单次验证 run ID
  runId: string;
  // 长任务 ID
  taskId: string;
  // 本次运行参数快照 ID
  runOptionsId?: string;
  // ValidatorAsset ID
  validatorAssetId: string;
  // 本次 run 使用的 RuntimeExecutionPlan ID
  runtimePlanId?: string;
  // 本次 run 是否命中 RuntimeExecutionPlan 缓存
  runtimePlanCacheHit: boolean;
  // 命中的 RuntimeExecutionPlan 缓存记录 ID
  runtimePlanCacheRecordId?: string;
  // 当前任务状态
  state: ValidationTaskState;
  // 当前阶段名称
  currentPhase?: string;
  // run 目录路径
  runDir: string;
  // 最近一个可恢复检查点 ID
  lastCheckpointId?: string;
  // 当前任务尝试次数
  attempts: number;
  // 是否已请求取消
  cancelRequested: boolean;
  // 任务创建时间
  createdAt: string;
  // 最近更新时间
  updatedAt: string;
  // 任务结束时间
  finishedAt?: string;
};

// 数据库中的任务审计事件记录
type DbTaskEventRecord = {
  // 事件 ID
  eventId: string;
  // 单次验证 run ID
  runId: string;
  // 长任务 ID
  taskId: string;
  // 验证实例 ID；run 级事件为空
  instanceId?: string;
  // run 内递增序号
  sequence: number;
  // 事件类型
  type:
    | "task.created"
    | "phase.started"
    | "phase.completed"
    | "tool.called"
    | "artifact.written"
    | "checkpoint.written"
    | "agent.reviewed"
    | "human.prompted"
    | "task.completed"
    | "task.failed"
    | "task.interrupted";
  // 事件所属阶段
  phase?: string;
  // 事件 payload 引用；大型 payload 不直接进入数据库
  payloadRef?: string;
  // 事件关联证据引用
  evidenceRefs?: string[];
  // 事件创建时间
  createdAt: string;
};

// 数据库中的 run 内事件记录；用于本地 Event Bus 驱动 step
type DbRunEventRecord = {
  // 事件唯一 ID
  eventId: string;
  // 单次验证 run ID
  runId: string;
  // 长任务 ID
  taskId: string;
  // 验证实例 ID；run 级事件为空
  instanceId?: string;
  // 关联步骤 ID；无法归属到单个步骤时为空
  stepId?: string;
  // run 内递增序号
  sequence: number;
  // 事件类型
  type: ValidationEventType;
  // 事件分类
  category: ValidationEventCategory;
  // 事件严重级别
  severity: ValidationEventSeverity;
  // agent 响应模式
  agentResponseMode: AgentEventResponseMode;
  // 事件来源
  source: ValidationEventSource;
  // 事件 payload 引用；大型 payload 不直接进入数据库
  payloadRef?: string;
  // 小型结构化 payload；仅用于轻量匹配和状态展示
  payload?: Record<string, unknown>;
  // 关联证据引用
  evidenceRefs?: string[];
  // 外部幂等键；外部输入事件可提供
  idempotencyKey?: string;
  // 事件发生时间
  occurredAt: string;
  // 事件写入数据库时间
  receivedAt: string;
  // 事件是否已被至少一个 step 消费
  consumed: boolean;
};

// 数据库中的 runtime 健康状态记录
type DbRuntimeHealthRecord = {
  // 健康状态记录 ID
  healthRecordId: string;
  // 单次验证 run ID
  runId: string;
  // 长任务 ID
  taskId: string;
  // 验证实例 ID；run 级健康状态为空
  instanceId?: string;
  // 当前步骤 ID
  currentStepId?: string;
  // 当前步骤开始时间
  currentStepStartedAt?: string;
  // 最近一次 tick 时间
  lastTickAt?: string;
  // 最近一次心跳时间
  lastHeartbeatAt?: string;
  // 最近一次进度事件 ID
  lastProgressEventId?: string;
  // 最近一次证据事件 ID
  lastEvidenceEventId?: string;
  // Agent 或 run 预算使用比例
  budgetUsageRatio?: number;
  // Event Bus 待处理事件数量
  eventBusBacklog?: number;
  // runtime 健康状态
  state: "healthy" | "watching" | "stalled" | "exception";
  // 最近一次异常事件 ID
  lastExceptionEventId?: string;
  // 最近更新时间
  updatedAt: string;
};

// 数据库中的 run 内定时器记录
type DbRunTimerRecord = {
  // 定时器 ID
  timerId: string;
  // 单次验证 run ID
  runId: string;
  // 长任务 ID
  taskId: string;
  // 验证实例 ID；run 级定时器为空
  instanceId?: string;
  // 定时器关联步骤 ID
  stepId: string;
  // 定时器调度配置引用
  scheduleRef: string;
  // 定时器状态
  status: "scheduled" | "fired" | "cancelled" | "expired";
  // 下一次触发时间
  nextFireAt?: string;
  // 已触发次数
  firedCount: number;
  // 最近一次触发生成的事件 ID
  lastEventId?: string;
  // 定时器创建时间
  createdAt: string;
  // 最近更新时间
  updatedAt: string;
};

// 数据库中的事件处理记录
type DbEventProcessingRecord = {
  // 处理记录 ID
  processingId: string;
  // 单次验证 run ID
  runId: string;
  // 长任务 ID
  taskId: string;
  // 验证实例 ID；run 级事件为空
  instanceId?: string;
  // 处理事件的步骤 ID；系统级事件为空
  stepId?: string;
  // 被处理的事件 ID
  eventId: string;
  // 处理状态
  status: "ignored" | "processed" | "failed";
  // 处理产生的输出引用列表
  outputRefs?: string[];
  // 处理失败或忽略原因
  reason?: string;
  // 处理时间
  processedAt: string;
};

// 数据库中的 RuntimeExecutionPlan 缓存索引记录
type DbRuntimePlanCacheRecord = {
  // plan 缓存记录 ID
  cacheRecordId: string;
  // 内部执行计划 ID
  planId: string;
  // ValidatorAsset ID
  validatorId: string;
  // ValidatorFlowIdentity.identityHash
  flowIdentityHash: string;
  // ValidatorAsset 内容 hash
  validatorAssetHash: string;
  // Runtime plan schema 版本
  planSchemaVersion: string;
  // AppPilot compiler 版本
  compilerVersion: string;
  // 目标环境签名 hash
  targetSignatureHash: string;
  // RuntimeExecutionPlan JSON artifact 引用
  planArtifactRef: string;
  // RuntimeExecutionPlan 内容 hash
  planContentHash: string;
  // 是否允许直接复用
  reusable: boolean;
  // 失效原因；reusable 为 false 时填写
  invalidationReason?: "asset_changed" | "compiler_changed" | "schema_changed" | "target_changed" | "manual_invalidated";
  // 计划生成时间
  generatedAt: string;
  // 最近命中时间
  lastHitAt?: string;
  // 命中次数
  hitCount: number;
};

// 数据库中的检查点记录
type DbCheckpointRecord = {
  // 检查点 ID
  checkpointId: string;
  // 单次验证 run ID
  runId: string;
  // 长任务 ID
  taskId: string;
  // 验证实例 ID；run 级 checkpoint 为空
  instanceId?: string;
  // 完成的阶段名称
  phase: string;
  // 阶段输入 hash
  inputHash: string;
  // 阶段输出引用列表
  outputRefs: string[];
  // 检查点写入前的任务状态
  stateBefore: ValidationTaskState;
  // 检查点写入后的任务状态
  stateAfter: ValidationTaskState;
  // 是否可作为恢复起点
  resumable: boolean;
  // 检查点完成时间
  completedAt: string;
};

// 数据库中的 artifact 引用记录
type DbArtifactRecord = {
  // artifact ID
  artifactId: string;
  // 单次验证 run ID
  runId: string;
  // 验证实例 ID；run 级 artifact 为空
  instanceId?: string;
  // 证据实例 ID；非证据 artifact 可为空
  evidenceInstanceId?: string;
  // artifact 类型
  type: ArtifactType;
  // artifact 存储 URI 或本地相对路径
  uri: string;
  // 内容 hash
  contentHash?: string;
  // artifact 大小
  sizeBytes?: number;
  // artifact 创建时间
  createdAt: string;
};

// 验证实例状态
type ValidationInstanceState =
  // 实例已创建
  | "created"
  // 正在准备设备、构建或启动条件
  | "preparing"
  // 正在运行
  | "running"
  // 正在等待事件、timer、观察窗口或人工确认
  | "waiting"
  // 实例已通过
  | "passed"
  // 实例已失败
  | "failed"
  // 实例只完成了部分验证
  | "partial"
  // 实例被阻塞
  | "blocked"
  // 实例已取消
  | "cancelled";

// 数据库中的验证实例记录
type DbValidationInstanceRecord = {
  // 验证实例 ID
  instanceId: string;
  // 单次验证 run ID
  runId: string;
  // 长任务 ID
  taskId: string;
  // 实例序号
  index: number;
  // 实例目标平台
  platform: Platform;
  // 真实设备 ID
  deviceId?: string;
  // 模拟器 ID
  simulatorId?: string;
  // run 级场景快照；同一个 run 下所有实例必须相同
  scenario?: string;
  // 实例状态
  state: ValidationInstanceState;
  // 该实例是否参与 required 聚合
  required: boolean;
  // 最近一个可恢复检查点 ID
  lastCheckpointId?: string;
  // 实例创建时间
  createdAt: string;
  // 最近更新时间
  updatedAt: string;
  // 实例结束时间
  finishedAt?: string;
};

// 数据库中的证据实例记录
type DbEvidenceInstanceRecord = {
  // 证据实例 ID
  evidenceInstanceId: string;
  // 单次验证 run ID
  runId: string;
  // 验证实例 ID
  instanceId: string;
  // 证据通道
  channel: EvidenceChannel;
  // 证据来源摘要
  sourceLabel: string;
  // 证据实例状态
  status: "collected" | "partial" | "missing" | "invalid";
  // artifact 引用列表
  artifactRefs: string[];
  // ExecutionFact 引用列表
  executionFactRefs?: string[];
  // 证据实例创建时间
  createdAt: string;
  // 最近更新时间
  updatedAt: string;
};

// 数据库中的恢复任务记录
type DbRecoveryRecord = {
  // 恢复记录 ID
  recoveryId: string;
  // 单次验证 run ID
  runId: string;
  // 触发恢复的原因
  reason: "startup_scan" | "manual_resume" | "process_interrupted" | "control_channel_reconnected";
  // 用于恢复的检查点 ID
  checkpointId?: string;
  // 恢复状态
  state: "pending" | "running" | "completed" | "failed";
  // 恢复尝试次数
  attempts: number;
  // 最近一次恢复错误
  lastError?: string;
  // 恢复记录创建时间
  createdAt: string;
  // 最近更新时间
  updatedAt: string;
};

// AppPilot 本地 SQLite 中存储的运行记录；只是本机索引，不代表全局运行历史
type LocalRunRecord = {
  // 单次验证 run ID
  runId: string;
  // ValidatorAsset ID
  validatorId: string;
  // 执行时使用的 ValidatorAsset 版本 hash
  validatorAssetHash: string;
  // 执行时间
  ranAt: string;
  // 执行平台
  platform: Platform;
  // App 版本
  appVersion: string;
  // SDK 版本
  sdkVersion: string;
  // OS 版本
  osVersion: string;
  // 执行结果
  result: "passed" | "failed" | "partial" | "blocked";
  // 是否已产出写回材料包
  wroteBack: boolean;
  // 诊断信号引用
  diagnosticSignalRef?: string;
};

// 本机观察到的覆盖组合；只表达本机历史 run 记录中的事实
type LocalObservedCombination = {
  // 执行平台
  platform: Platform;
  // OS 版本
  osVersion?: string;
  // SDK 版本
  sdkVersion?: string;
  // App 版本
  appVersion?: string;
  // 观察来源 run ID
  runId: string;
};

// AppPilot 可导出的本机运行摘要；供外部系统聚合，不是权威判断
type LocalRunSummary = {
  // ValidatorAsset ID
  validatorId: string;
  // 导出时间
  exportedAt: string;
  // 本机历史运行记录
  localRuns: LocalRunRecord[];
  // 本机观察到的覆盖组合
  observedCombinations: LocalObservedCombination[];
};
```

### 8.4 恢复规则

- AppPilot 启动时扫描数据库中 `running / interrupted` 的 run，生成 `DbRecoveryRecord`。
- 恢复只从 `resumable: true` 的最近 checkpoint 开始。
- 多实例 run 恢复时按 instance 独立恢复；已完成实例不得重复执行。
- 如果 checkpoint 指向的 output ref 已存在，恢复流程必须复用该输出，不得重复执行写入动作。
- 如果数据库记录存在但 run 目录缺失，任务进入 `failed`，错误码为 `TASK_INTERRUPTED`。
- 恢复扫描必须重新加载未完成的 `DbRunTimerRecord`，对已过期但未写入事件的 timer 补发 `timer_fired`。
- 恢复扫描必须重新读取未处理的 `DbRunEventRecord`，但不得重复执行已有 `DbEventProcessingRecord` 对应的事件处理结果。
- `events.ndjson` 是数据库事件表的可读导出，不是恢复的唯一依据。

### 8.5 实例索引规则

- `ValidationRun` 表达一次逻辑验证任务和一个唯一场景，`ValidationInstance` 表达该场景下的一次具体设备执行实例。
- 多实例验证由 run options 显式声明，只表示同一场景下的多设备或可选 Editor 会话执行。
- 同一个 run 下所有 `ValidationInstance` 必须共享同一个 run 级 `scenario`，不允许 instance 覆盖或扩展场景。
- 每个 `ValidationInstance` 必须有独立 `instanceId`，并拥有独立 `ExecutionResult / EvidenceBundle / ExecutionFact / artifact 引用`。
- 每个证据通道的一组采集结果可以建模为一个 `EvidenceInstance`，用于区分同一实例下的多组日志、截图、app_ws 消息、API 结果或数据快照。
- 多设备执行时，默认每台设备一个 `ValidationInstance`。
- 默认情况下，一个设备或一个 Editor 会话对应一个 `ValidationInstance`。
- 显式 `instances` 只用于指定设备、模拟器、required、控制配置和启动参数覆盖，不用于表达场景拆分。
- run 级 `ExecutionResult` 不是某个设备的原始结果，而是 `RunAggregationResult` 的摘要。
- 写回材料必须保留参与确认的 `instanceIds` 和 `evidenceInstanceIds`，不得把未确认实例纳入确认范围。

## 9. MCP 工具契约

### 9.1 本地入口

安装后的 agent 入口：

```bash
~/.apppilot/apppilot-mcp
~/.apppilot/apppilot-mcp-call
```

宿主代码助手可以注入 AppPilot 直连工具。未注入时，`~/.apppilot/apppilot-mcp-call` 是稳定 fallback。

### 9.2 工具边界

AppPilot MCP tools 必须严格区分对外 agent 工具和对内 AppPilot agent 工具。

对外 agent 工具是面向外部代码助手、调用方和人工确认流程的稳定入口。外部 agent 输入行为事实、验证目标、运行约束和人工确认结果，AppPilot 内部 agent 负责理解、编排、执行、检查和生成确认提示。对外 agent 不直接操作设备、日志、UI 控制、App WebSocket、SQLite checkpoint、Event Bus 处理记录或 Evidence Store 内部索引。

对内 AppPilot agent 工具是 AppPilot 内部 agent、runtime、scheduler、watcher 和 step dispatcher 使用的原子能力。它们可以通过 MCP 暴露给受控的内部 agent，但默认不作为对外主入口。已有兼容工具可以继续存在，但应逐步作为 wrapper 调用更细粒度内部工具。

两类 MCP 工具必须使用不同的命名空间、权限策略和审计标记：

- 对外 agent 工具命名空间：`external.validation.*`、`external.confirmation.*`、`external.artifact.*`。
- 对内 AppPilot agent 工具命名空间：`internal.agent.*`、`internal.build.*`、`internal.device.*`、`internal.event.*`、`internal.evidence.*`、`internal.db.*`。
- 对外 agent 工具必须返回稳定材料引用，不暴露内部 step、timer、event cursor 或数据库主键。
- 对内 AppPilot agent 工具可以返回内部引用，但必须绑定 `agentSessionId`、`runId`、权限策略和审计记录。

### 9.3 工具披露规则

- 每个会改变设备、任务、数据库或 evidence store 的工具都必须返回稳定引用。
- 每个证据采集工具都必须写入 run 证据目录，并在 SQLite 中登记 artifact 引用。
- 对外 agent 只能调用对外 MCP 工具，不得调用对内 AppPilot agent 工具。
- 对内 AppPilot agent 调用内部工具时，必须经过 `agentSessionId`、`runId`、权限策略和参数约束校验。
- 外部验证任务必须通过对外高层验证入口启动。
- 外部 hook 或外部 App 只能通过事件输入写入 run 内事件，不允许直接修改 step、timer、checkpoint 或验证结果。
- 对外工具不得返回未脱敏的原始 artifact 正文；只能返回 artifact ref、摘要、hash、确认提示或导出材料。
- 对内工具返回的原始输出必须进入 Evidence Store 或 agent audit，再由对外工具选择性导出。

### 9.4 对外 Agent 工具组

对外 agent 工具组只提供稳定、高层、可审计的验证入口：

- `external.validation.start`：输入 `ValidatorAsset`、run options 或行为事实，启动验证任务。
- `external.validation.status`：查询 task、run、instance、agent review、人工提示和导出状态。
- `external.validation.cancel`：取消当前验证任务，阻止后续动作。
- `external.validation.resume`：恢复可恢复的本地验证任务。
- `external.validation.export`：导出执行摘要、证据摘要、本机运行摘要和写回材料包。
- `external.confirmation.submit`：提交人工确认结果、确认范围和备注。
- `external.confirmation.list_prompts`：读取待处理人工确认提示。
- `external.artifact.read_summary`：读取已脱敏的 artifact 摘要和引用。
- `external.event.emit`：写入外部 hook 事件；只允许写入 `external_event_received`，不直接修改 step 状态。
- `external.coverage.advisory`：基于本机运行记录给出本地覆盖建议，不做权威覆盖判断。

### 9.5 对内 AppPilot Agent 工具组

对内 AppPilot agent 工具组是内部执行原子能力，默认只授权给 AppPilot runtime 和受控内部 agent：

- `internal.agent.build_plan`：下载 plan-build skill，生成 prompt，调用 Codex agent 编译 `RuntimeExecutionPlan`。
- `internal.agent.request`：向 Codex agent 发送事件响应、证据检查、恢复决策或人工提示请求。
- `internal.build.run`：执行 App 构建或复用构建产物。
- `internal.build.status`：读取构建任务状态和构建 artifact 引用。
- `internal.device.discover`：发现 iOS / Android 设备或 Editor 会话。
- `internal.device.install`：安装 App 到目标设备。
- `internal.device.launch`：启动或 attach App。
- `internal.device.control_ui`：通过 WDA 或 uiautomator2 执行 UI 控制和 UI 观测。
- `internal.app_ws.call`：调用 App 侧 JSON-RPC。
- `internal.app_ws.subscribe`：订阅 App WebSocket 证据流并写入 Evidence Store 或 ReAct observation。
- `internal.react.declare_blocked`：Agent 主动声明当前 ReAct step 无法继续，并请求 Runtime 转为 `step_blocked`。
- `internal.event.emit`：写入 run 内事件。
- `internal.event.read`：读取 run 内事件流。
- `internal.event.consume`：记录 Runtime 对 step 级或系统级事件的处理结果。
- `internal.timer.schedule`：创建 run 内 timer。
- `internal.timer.cancel`：取消 run 内 timer。
- `internal.evidence.collect`：采集日志、截图、UI、API/SQL、数据快照、设备状态或 app_ws artifact。
- `internal.evidence.extract`：运行 extractor 并生成 `ExecutionFact`。
- `internal.evidence.read`：读取内部 evidence artifact 或 evidence bundle。
- `internal.db.checkpoint_write`：写入 checkpoint。
- `internal.db.checkpoint_read`：读取 checkpoint 和恢复上下文。
- `internal.db.task_update`：更新 `Validation Task` 本地状态。
- `internal.audit.write`：写入 agent、工具调用、事件处理和人工确认审计记录。

### 9.6 工具 Schema

本节定义 MCP 工具函数名、调用参数和返回结构。两类 schema 不得混用：对外 schema 只接受稳定输入契约、行为事实、运行约束、人工确认和导出查询参数；对内 schema 可以接受 step、timer、event cursor、device session、agent session、checkpoint 和 artifact 内部引用。

```ts
// MCP 工具调用状态
type McpToolCallStatus =
  // 调用已接受
  | "accepted"
  // 调用正在执行
  | "running"
  // 调用已完成
  | "completed"
  // 调用失败
  | "failed";

// 对外工具通用输出字段
type ExternalToolOutputBase = {
  // 工具调用 ID
  toolCallId: string;
  // 本地任务 ID
  taskId?: string;
  // 单次验证 run ID
  runId?: string;
  // 工具调用状态
  status: McpToolCallStatus;
  // 可审计记录引用
  auditRef?: string;
  // 对外可读摘要
  summary?: string;
};

// 对内工具通用输出字段
type InternalToolOutputBase = {
  // 工具调用 ID
  toolCallId: string;
  // agent session ID
  agentSessionId?: string;
  // 本地任务 ID
  taskId?: string;
  // 单次验证 run ID
  runId?: string;
  // 工具调用状态
  status: McpToolCallStatus;
  // 内部审计记录引用
  auditRef: string;
  // 幂等键
  idempotencyKey?: string;
};

// 对外人工提示摘要
type ExternalPromptSummary = {
  // 人工提示 ID
  promptId: string;
  // 提示类型
  promptType: AgentHumanPrompt["promptType"];
  // 提示标题
  title: string;
  // 提示状态
  state: AgentHumanPrompt["state"];
};

// 对外 artifact 摘要
type ExternalArtifactSummary = {
  // artifact ID
  artifactId: string;
  // artifact 引用
  artifactRef: string;
  // artifact 类型
  type: ArtifactType;
  // 是否已脱敏
  redacted: boolean;
  // 内容 hash
  contentHash?: string;
  // 对外摘要
  summary?: string;
};

// 对外实例状态摘要
type ExternalInstanceStateSummary = {
  // 验证实例 ID
  instanceId: string;
  // 验证实例状态
  state: ValidationInstanceState;
};

// 设备发现结果摘要
type DeviceDiscoverySummary = {
  // 设备 ID
  deviceId: string;
  // 设备平台
  platform: Platform;
  // 设备可读名称
  label?: string;
  // OS 版本
  osVersion?: string;
};

// 期望覆盖组合；由调用方提供，用于和本机观察记录做 advisory 对比
type ExpectedCoverageCombination = {
  // 期望平台
  platform: Platform;
  // 期望 OS 版本
  osVersion?: string;
  // 期望 SDK 版本
  sdkVersion?: string;
  // 期望 App 版本
  appVersion?: string;
};

// 对外 agent 工具
type ExternalMcpTool =
  | {
      // 启动验证任务
      name: "external.validation.start";
      input: {
        // 外部 ValidatorAsset 输入
        validatorAsset: ValidatorAsset;
        // 本次运行参数；只作为 Validation Task 输入快照保存
        runOptions?: Record<string, unknown>;
        // 外部行为事实输入；字段由外部契约定义，AppPilot 不在本文展开
        behaviorFact?: BehaviorFact;
        // 调用方幂等键
        idempotencyKey?: string;
      };
      output: ExternalToolOutputBase & {
        // 创建的 Validation Task 状态
        taskState: ValidationTaskState;
        // agent session ID
        agentSessionId?: string;
        // 待处理人工提示摘要
        pendingPrompts?: ExternalPromptSummary[];
      };
    }
  | {
      // 查询验证任务状态
      name: "external.validation.status";
      input: {
        // 本地任务 ID
        taskId?: string;
        // 单次验证 run ID
        runId?: string;
        // 是否包含待处理人工确认提示
        includePrompts?: boolean;
        // 是否包含证据摘要
        includeEvidenceSummary?: boolean;
      };
      output: ExternalToolOutputBase & {
        // 当前任务状态
        taskState?: ValidationTaskState;
        // run 聚合结果引用
        runAggregationRef?: string;
        // 实例状态摘要
        instanceStates?: ExternalInstanceStateSummary[];
        // agent review 引用列表
        agentReviewRefs?: string[];
        // 待处理人工提示摘要
        pendingPrompts?: ExternalPromptSummary[];
        // 证据摘要引用
        evidenceSummaryRef?: string;
      };
    }
  | {
      // 取消验证任务
      name: "external.validation.cancel";
      input: {
        // 本地任务 ID
        taskId: string;
        // 取消原因
        reason?: string;
      };
      output: ExternalToolOutputBase & {
        // 取消后的任务状态
        taskState: ValidationTaskState;
        // 取消时间
        cancelledAt: string;
      };
    }
  | {
      // 恢复验证任务
      name: "external.validation.resume";
      input: {
        // 本地任务 ID
        taskId: string;
        // 指定恢复点；为空时使用最近可恢复 checkpoint
        checkpointId?: string;
      };
      output: ExternalToolOutputBase & {
        // 恢复记录 ID
        recoveryId: string;
        // 使用的 checkpoint ID
        checkpointId?: string;
        // 恢复后的任务状态
        taskState: ValidationTaskState;
      };
    }
  | {
      // 导出验证材料
      name: "external.validation.export";
      input: {
        // 单次验证 run ID
        runId: string;
        // 导出类型
        exportType: "summary" | "evidence" | "writeback_package" | "local_run_summary";
        // 是否脱敏
        redacted?: boolean;
      };
      output: ExternalToolOutputBase & {
        // 导出材料引用
        exportRef: string;
        // 导出类型
        exportType: "summary" | "evidence" | "writeback_package" | "local_run_summary";
        // 是否已脱敏
        redacted: boolean;
        // 导出内容 hash
        contentHash?: string;
      };
    }
  | {
      // 提交人工确认
      name: "external.confirmation.submit";
      input: {
        // 人工提示 ID
        promptId: string;
        // 单次验证 run ID
        runId: string;
        // 确认结果；resolved 和 escalated 仅用于 manual_intervention 提示
        result: "approved" | "rejected" | "needs_changes" | "resolved" | "escalated";
        // 确认范围
        confirmedScope?: HumanConfirmationScope;
        // 人工备注
        notes?: string;
      };
      output: ExternalToolOutputBase & {
        // 确认记录引用
        confirmationRef: string;
        // 是否接受该确认输入
        accepted: boolean;
        // 确认后的任务状态
        taskState?: ValidationTaskState;
        // 写回材料包引用
        writebackPackageRef?: string;
      };
    }
  | {
      // 查询待处理人工确认提示
      name: "external.confirmation.list_prompts";
      input: {
        // 本地任务 ID
        taskId?: string;
        // 单次验证 run ID
        runId?: string;
        // 是否只返回待处理提示
        pendingOnly?: boolean;
      };
      output: ExternalToolOutputBase & {
        // 人工提示摘要列表
        prompts: ExternalPromptSummary[];
      };
    }
  | {
      // 读取 artifact 摘要
      name: "external.artifact.read_summary";
      input: {
        // artifact ID
        artifactId: string;
        // 是否返回脱敏摘要
        redacted?: boolean;
      };
      output: ExternalToolOutputBase & {
        // artifact 摘要
        artifact: ExternalArtifactSummary;
      };
    }
  | {
      // 写入外部 hook 事件
      name: "external.event.emit";
      input: {
        // 单次验证 run ID
        runId: string;
        // 外部事件类型；对外只允许 external_event_received
        type: "external_event_received";
        // 外部事件 payload
        payload?: Record<string, unknown>;
        // 验证实例 ID
        instanceId?: string;
        // 关联步骤 ID
        stepId?: string;
        // 幂等键
        idempotencyKey?: string;
      };
      output: ExternalToolOutputBase & {
        // 写入的事件 ID
        eventId: string;
        // run 内事件序号
        sequence: number;
        // 是否因为幂等键复用了已有事件
        deduplicated?: boolean;
      };
    }
  | {
      // 本地覆盖建议
      name: "external.coverage.advisory";
      input: {
        // ValidatorAsset ID
        validatorId: string;
        // 调用方期望覆盖组合
        expectedCombinations?: ExpectedCoverageCombination[];
      };
      output: ExternalToolOutputBase & {
        // 本机观察到的覆盖组合
        observedCoverage: LocalObservedCombination[];
        // 本机从未成功通过的组合
        localGaps?: string[];
        // 本地建议
        advisory?: string;
        // 非权威声明
        disclaimer: "local_observation_only";
      };
    };

// 对内 AppPilot agent 工具
type InternalMcpTool =
  | {
      // 构建 RuntimeExecutionPlan
      name: "internal.agent.build_plan";
      input: {
        // agent session ID
        agentSessionId: string;
        // 本地任务 ID
        taskId: string;
        // 单次验证 run ID
        runId: string;
        // ValidatorAsset 快照引用
        validatorAssetRef: string;
        // run options 快照引用
        runOptionsRef: string;
        // plan-build skill 引用
        planBuildSkillRef?: PlanBuildSkillRef;
        // 幂等键
        idempotencyKey?: string;
      };
      output: InternalToolOutputBase & {
        // RuntimeExecutionPlan ID
        planId: string;
        // RuntimeExecutionPlan artifact 引用
        runtimePlanRef: string;
        // RuntimeExecutionPlan 内容 hash
        planContentHash: string;
        // agent request ID
        agentRequestId: string;
        // 使用的 plan-build skill hash
        planBuildSkillHash: string;
      };
    }
  | {
      // 发送 agent 请求
      name: "internal.agent.request";
      input: {
        // agent session ID
        agentSessionId: string;
        // 单次验证 run ID
        runId: string;
        // 请求用途
        purpose: AgentRequestPurpose;
        // prompt artifact 引用
        promptRef: string;
        // 输出 schema 引用
        outputSchemaRef?: string;
        // 关联事件 ID
        eventId?: string;
        // 关联步骤 ID
        stepId?: string;
      };
      output: InternalToolOutputBase & {
        // agent request ID
        agentRequestId: string;
        // agent 原始响应引用
        responseRef?: string;
        // agent 决策引用列表
        decisionRefs?: string[];
        // agent review 结果引用
        reviewResultRef?: string;
        // 人工提示引用
        humanPromptRef?: string;
      };
    }
  | {
      // 执行 App 构建
      name: "internal.build.run";
      input: {
        // 单次验证 run ID
        runId: string;
        // 构建 adapter
        adapter: BuildAdapter;
        // 项目路径
        projectPath: string;
        // 构建目标平台
        platform: Platform;
        // 构建参数
        buildOptions?: Record<string, unknown>;
      };
      output: InternalToolOutputBase & {
        // 构建任务 ID
        buildTaskId: string;
        // 构建任务状态
        buildState: BuildState;
        // 构建产物引用
        buildArtifactRef?: string;
        // 构建日志引用
        buildLogRef?: string;
      };
    }
  | {
      // 查询构建状态
      name: "internal.build.status";
      input: {
        // 构建任务 ID
        buildTaskId: string;
      };
      output: InternalToolOutputBase & {
        // 构建任务 ID
        buildTaskId: string;
        // 构建任务状态
        buildState: BuildState;
        // 构建产物引用
        buildArtifactRef?: string;
        // 构建日志引用
        buildLogRef?: string;
      };
    }
  | {
      // 发现设备
      name: "internal.device.discover";
      input: {
        // 平台
        platform: Platform;
        // 设备过滤条件
        filter?: Record<string, unknown>;
      };
      output: InternalToolOutputBase & {
        // 发现的设备列表
        devices: DeviceDiscoverySummary[];
      };
    }
  | {
      // 安装 App
      name: "internal.device.install";
      input: {
        // 单次验证 run ID
        runId: string;
        // 验证实例 ID
        instanceId: string;
        // 设备 ID
        deviceId: string;
        // App artifact 引用
        appArtifactRef: string;
      };
      output: InternalToolOutputBase & {
        // 安装事件 ID
        eventId: string;
        // 设备 session 引用
        deviceSessionRef?: string;
        // 是否安装成功
        installed: boolean;
      };
    }
  | {
      // 启动或 attach App
      name: "internal.device.launch";
      input: {
        // 单次验证 run ID
        runId: string;
        // 验证实例 ID
        instanceId: string;
        // 设备 ID
        deviceId: string;
        // App bundle ID 或 package name
        appId: string;
        // 启动参数
        launchOptions?: Record<string, unknown>;
      };
      output: InternalToolOutputBase & {
        // 启动事件 ID
        eventId: string;
        // 设备 session 引用
        deviceSessionRef: string;
        // App 进程引用
        appProcessRef?: string;
        // 是否启动成功
        launched: boolean;
      };
    }
  | {
      // UI 控制或观测
      name: "internal.device.control_ui";
      input: {
        // 单次验证 run ID
        runId: string;
        // 验证实例 ID
        instanceId: string;
        // 设备 ID
        deviceId: string;
        // UI 后端
        backend: "wda" | "uiautomator2";
        // UI 动作
        action: "tap" | "swipe" | "read_tree" | "screenshot";
        // 动作参数
        params?: Record<string, unknown>;
      };
      output: InternalToolOutputBase & {
        // UI 动作结果引用
        actionResultRef: string;
        // 产生的 artifact 引用列表
        artifactRefs?: string[];
        // 写入的事件 ID 列表
        eventIds?: string[];
      };
    }
  | {
      // 调用 App WebSocket RPC
      name: "internal.app_ws.call";
      input: {
        // 单次验证 run ID
        runId: string;
        // 验证实例 ID
        instanceId: string;
        // RPC 方法
        method: string;
        // RPC 参数
        params?: Record<string, unknown>;
      };
      output: InternalToolOutputBase & {
        // RPC 结果引用
        rpcResultRef: string;
        // 证据 artifact 引用
        artifactRef?: string;
        // 写入的事件 ID
        eventId?: string;
      };
    }
  | {
      // 订阅 App WebSocket
      name: "internal.app_ws.subscribe";
      input: {
        // 单次验证 run ID
        runId: string;
        // 验证实例 ID
        instanceId: string;
        // 订阅 URL
        url: string;
        // 订阅主题
        topics?: string[];
      };
      output: InternalToolOutputBase & {
        // 订阅 ID
        subscriptionId: string;
        // App WebSocket 流引用
        streamRef: string;
      };
    }
  | {
      // Agent 主动声明当前 ReAct step blocked
      name: "internal.react.declare_blocked";
      input: {
        // 单次验证 run ID
        runId: string;
        // 验证实例 ID
        instanceId?: string;
        // 当前步骤 ID
        stepId: string;
        // blocked 声明
        blocked: ReactDeclareBlockedInput;
        // 幂等键
        idempotencyKey?: string;
      };
      output: InternalToolOutputBase & {
        // 写入的 step_blocked 事件 ID
        eventId: string;
        // ReAct 退出原因
        exitReason: "agent_blocked";
        // 任务状态
        taskState: ValidationTaskState;
      };
    }
  | {
      // 写入 run 内事件
      name: "internal.event.emit";
      input: {
        // 单次验证 run ID
        runId: string;
        // 事件类型
        type: ValidationEventType;
        // 事件来源
        source: ValidationEventSource;
        // 事件分类
        category: ValidationEventCategory;
        // 事件 payload
        payload?: Record<string, unknown>;
        // 验证实例 ID
        instanceId?: string;
        // 关联步骤 ID
        stepId?: string;
        // 幂等键
        idempotencyKey?: string;
      };
      output: InternalToolOutputBase & {
        // 写入的事件 ID
        eventId: string;
        // run 内事件序号
        sequence: number;
        // 是否因为幂等键复用了已有事件
        deduplicated?: boolean;
      };
    }
  | {
      // 读取 run 内事件
      name: "internal.event.read";
      input: {
        // 单次验证 run ID
        runId: string;
        // 起始事件序号
        fromSequence?: number;
        // 最大返回数量
        limit?: number;
        // 事件类型过滤
        types?: ValidationEventType[];
      };
      output: InternalToolOutputBase & {
        // 事件摘要列表
        events: ValidationEvent[];
        // 下一次读取的起始事件序号
        nextSequence?: number;
      };
    }
  | {
      // 记录事件处理结果
      name: "internal.event.consume";
      input: {
        // 单次验证 run ID
        runId: string;
        // 事件 ID
        eventId: string;
        // 处理该事件的 step ID；系统级事件为空
        stepId?: string;
        // 处理状态
        status: "ignored" | "processed" | "failed";
        // 处理产生的输出引用列表
        outputRefs?: string[];
        // 处理失败或忽略原因
        reason?: string;
        // 幂等键
        idempotencyKey?: string;
      };
      output: InternalToolOutputBase & {
        // 事件处理记录 ID
        processingId: string;
        // 事件处理后产生的状态 patch 引用
        statePatchRef?: string;
        // 是否因为幂等键复用了已有处理记录
        deduplicated?: boolean;
      };
    }
  | {
      // 创建 run 内 timer
      name: "internal.timer.schedule";
      input: {
        // 单次验证 run ID
        runId: string;
        // 验证实例 ID
        instanceId?: string;
        // 关联 step ID
        stepId: string;
        // timer 调度配置
        schedule: RunTimer["schedule"];
      };
      output: InternalToolOutputBase & {
        // timer ID
        timerId: string;
        // 下一次触发时间
        nextFireAt?: string;
        // timer 状态
        timerStatus: RunTimer["status"];
      };
    }
  | {
      // 取消 run 内 timer
      name: "internal.timer.cancel";
      input: {
        // 单次验证 run ID
        runId: string;
        // timer ID
        timerId: string;
        // 取消原因
        reason?: string;
      };
      output: InternalToolOutputBase & {
        // timer ID
        timerId: string;
        // timer 状态
        timerStatus: RunTimer["status"];
        // 取消时间
        cancelledAt: string;
      };
    }
  | {
      // 采集证据
      name: "internal.evidence.collect";
      input: {
        // 单次验证 run ID
        runId: string;
        // 验证实例 ID
        instanceId?: string;
        // 证据通道
        channel: EvidenceChannel;
        // 证据选择器
        selector?: string;
        // 关联 step ID
        stepId?: string;
      };
      output: InternalToolOutputBase & {
        // 证据实例 ID
        evidenceInstanceId: string;
        // 采集到的 artifact 引用列表
        artifactRefs: string[];
        // 写入的事件 ID 列表
        eventIds?: string[];
      };
    }
  | {
      // 抽取执行事实
      name: "internal.evidence.extract";
      input: {
        // 单次验证 run ID
        runId: string;
        // 证据提取器 ID
        extractorId: string;
        // 来源 artifact ID
        sourceArtifactId: string;
      };
      output: InternalToolOutputBase & {
        // extractor 结果引用
        extractorResultRef: string;
        // ExecutionFact 引用列表
        executionFactRefs: string[];
        // EvidenceBundle 引用
        evidenceBundleRef?: string;
      };
    }
  | {
      // 读取内部证据
      name: "internal.evidence.read";
      input: {
        // 单次验证 run ID
        runId: string;
        // artifact ID
        artifactId?: string;
        // evidence bundle ID
        evidenceBundleId?: string;
      };
      output: InternalToolOutputBase & {
        // artifact 引用
        artifactRef?: string;
        // evidence bundle 引用
        evidenceBundleRef?: string;
        // 读取内容引用
        contentRef?: string;
      };
    }
  | {
      // 写入 checkpoint
      name: "internal.db.checkpoint_write";
      input: {
        // 单次验证 run ID
        runId: string;
        // 本地任务 ID
        taskId: string;
        // checkpoint payload 引用
        checkpointRef: string;
        // 是否可恢复
        resumable: boolean;
      };
      output: InternalToolOutputBase & {
        // checkpoint ID
        checkpointId: string;
        // checkpoint 引用
        checkpointRef: string;
        // 是否可恢复
        resumable: boolean;
      };
    }
  | {
      // 读取 checkpoint
      name: "internal.db.checkpoint_read";
      input: {
        // 单次验证 run ID
        runId: string;
        // checkpoint ID；为空时读取最近可恢复 checkpoint
        checkpointId?: string;
      };
      output: InternalToolOutputBase & {
        // checkpoint ID
        checkpointId?: string;
        // checkpoint 引用
        checkpointRef?: string;
        // 恢复上下文引用
        recoveryContextRef?: string;
      };
    }
  | {
      // 更新任务状态
      name: "internal.db.task_update";
      input: {
        // 本地任务 ID
        taskId: string;
        // 单次验证 run ID
        runId: string;
        // 任务状态
        state: ValidationTaskState;
        // 状态 patch
        patch?: Record<string, unknown>;
      };
      output: InternalToolOutputBase & {
        // 本地任务 ID
        taskId: string;
        // 更新后的任务状态
        taskState: ValidationTaskState;
        // 更新时间
        updatedAt: string;
      };
    }
  | {
      // 写入审计记录
      name: "internal.audit.write";
      input: {
        // 单次验证 run ID
        runId: string;
        // 审计类型
        auditType: "agent" | "tool_call" | "event_processing" | "human_confirmation";
        // 审计 payload 引用
        payloadRef?: string;
        // 小型审计摘要
        summary?: Record<string, unknown>;
      };
      output: InternalToolOutputBase & {
        // 审计记录 ID
        auditId: string;
        // 审计记录引用
        auditRef: string;
      };
    };
```

## 10. 构建

### 10.1 构建边界

构建产物也是普通 artifact，可以被验证 run 引用。AppPilot 的构建契约面向 App，不限定 Unity；Unity、Xcode、Gradle、Flutter、React Native 或 custom command 都通过构建能力表达。

构建使用 adapter 语义，不使用 backend 命名。adapter 表示“如何构建 App”，例如 Unity、Xcode、Gradle、Flutter、React Native 或自定义命令；设备 UI 控制后端仍由设备章节定义。

```ts
// App 构建 adapter
type BuildAdapter =
  // Unity 工程构建
  | "unity"
  // Xcode 工程构建
  | "xcode"
  // Android Gradle 工程构建
  | "gradle"
  // Flutter 工程构建
  | "flutter"
  // React Native 工程构建
  | "react_native"
  // 自定义构建命令
  | "custom";

// 构建动作
type BuildAction =
  // 构建最终可安装 App
  | "build"
  // 仅导出或生成 Xcode 工程
  | "xcode"
  // 仅复用已有构建产物
  | "reuse";

// 构建配置
type BuildConfiguration =
  // 调试构建
  | "debug"
  // 发布构建
  | "release";

// 构建请求
type BuildRequest = {
  // 构建请求 ID
  buildRequestId: string;
  // 单次验证 run ID
  runId: string;
  // 本地任务 ID
  taskId: string;
  // 构建 adapter
  adapter: BuildAdapter;
  // 构建目标平台
  platform: Platform;
  // 构建动作
  action: BuildAction;
  // 工程路径
  projectPath?: string;
  // 构建配置
  configuration?: BuildConfiguration;
  // 是否刷新构建产物；false 表示尽量复用或增量构建
  refresh?: boolean;
  // 是否构建资源
  buildResources?: boolean;
  // 是否允许复用已有构建产物
  allowReuse?: boolean;
  // 调用方提供的已有构建产物引用
  existingArtifactRef?: string;
  // adapter 透传参数
  adapterOptions?: Record<string, unknown>;
  // 构建超时时间
  timeoutMs?: number;
};

// 构建产物类型
type BuildArtifactKind =
  // iOS .app 产物
  | "ios_app"
  // Android APK
  | "android_apk"
  // Android AAB
  | "android_aab"
  // Xcode 工程
  | "xcode_project"
  // 其它构建产物
  | "custom_artifact";

// 构建产物
type BuildArtifact = {
  // 构建产物 ID
  buildArtifactId: string;
  // 构建请求 ID
  buildRequestId: string;
  // 单次验证 run ID
  runId?: string;
  // 构建 adapter
  adapter: BuildAdapter;
  // 构建目标平台
  platform: Platform;
  // 构建配置
  configuration: BuildConfiguration;
  // 构建产物类型
  kind: BuildArtifactKind;
  // 工程路径
  projectPath?: string;
  // Xcode 工程路径
  xcodeProjectPath?: string;
  // 可安装 App 路径
  appPath?: string;
  // bundle id 或 package name
  appId?: string;
  // 构建产物存储引用
  artifactRef: string;
  // 构建日志引用
  buildLogRef?: string;
  // 构建输入 hash
  inputHash: string;
  // 构建产物内容 hash
  contentHash?: string;
  // 构建时间
  builtAt: string;
};

// 构建状态
type BuildState =
  // 构建已排队
  | "pending"
  // 正在构建
  | "running"
  // 构建已完成
  | "completed"
  // 构建失败
  | "failed"
  // 已复用已有产物
  | "reused"
  // 构建已取消
  | "cancelled";

// 构建任务状态
type BuildTaskRecord = {
  // 构建任务 ID
  buildTaskId: string;
  // 构建请求 ID
  buildRequestId: string;
  // 单次验证 run ID
  runId: string;
  // 本地任务 ID
  taskId: string;
  // 构建 adapter
  adapter: BuildAdapter;
  // 构建目标平台
  platform: Platform;
  // 构建动作
  action: BuildAction;
  // 构建状态
  state: BuildState;
  // 当前构建阶段
  phase?: "prepare" | "export" | "compile" | "package" | "postprocess" | "finishing";
  // 构建产物引用
  buildArtifactRef?: string;
  // 构建日志引用
  buildLogRef?: string;
  // 最近一次错误
  lastError?: string;
  // 创建时间
  createdAt: string;
  // 开始时间
  startedAt?: string;
  // 完成时间
  finishedAt?: string;
};

// 构建缓存匹配键
type BuildCacheKey = {
  // 构建 adapter
  adapter: BuildAdapter;
  // 构建目标平台
  platform: Platform;
  // 构建配置
  configuration: BuildConfiguration;
  // 工程路径 hash
  projectPathHash?: string;
  // 构建输入 hash
  inputHash: string;
  // adapter 参数 hash
  adapterOptionsHash?: string;
};
```

### 10.2 构建策略

构建是 run 级或构建产物级动作。AppPilot 可以为本次 run 构建 App，也可以复用已存在且满足约束的构建产物。

当 run options 声明需要构建时，验证 runtime 可以先执行构建。否则它使用调用方提供的兼容构建产物，或使用 AppPilot artifact store 中最近的兼容构建产物。

## 11. 设备与 App 控制

### 11.1 支持能力

AppPilot 支持：

- 通过本地 iOS 工具发现 iOS 设备。
- 通过 adb 发现 Android 设备。
- iOS app 安装、启动和停止。
- Android APK 安装、启动和停止。
- iOS UI 控制固定使用 WDA，包括 tap、swipe、UI 层级读取和截图。
- Android UI 控制固定使用 uiautomator2，包括 tap、swipe、UI 层级读取和截图。
- iOS 启动环境变量。
- Android intent 启动参数。
- 通过 App WebSocket bridge 采集 App WebSocket 证据或调用 App 侧 JSON-RPC。
- 通过 App WebSocket bridge 接收 App WebSocket 证据。

### 11.2 设备控制后端边界

- 实例级动作负责 install、launch 或 attach。
- 每个 `ValidationInstance` 启动后，需要连接本次验证所需通道，包括 device driver、Editor、App 侧 RPC、App WebSocket 和 evidence tools。
- iOS 本地工具负责设备发现、安装、启动、停止、日志拉取和基础设备状态。
- WDA 只负责 iOS UI 交互和 UI 观测证据。
- adb 负责 Android 设备发现、安装、启动、停止、logcat 和基础设备状态。
- uiautomator2 只负责 Android UI 交互和 UI 观测证据。
- 设备控制配置未显式传入时，AppPilot 按平台选择默认后端：iOS 为 `wda`，Android 为 `uiautomator2`。

### 11.3 App WebSocket Bridge

App WebSocket bridge 是双向通信通道：

- AppPilot -> App：通过 JSON-RPC 查询 App scene hierarchy、读取 node 属性、触发调试动作、调用测试接口，或读取 App 内部日志、BI 埋点、云控数据、数据库数据和广告数据。
- App -> AppPilot：通过 `app_ws` 证据通道主动推送 scene hierarchy 片段、node 属性变化、场景、监控、调试、指标、埋点事件和自定义事件。

当 `ValidatorAsset` 把 App 侧 RPC 声明为期望证据来源时，RPC 返回值会被纳入对应 evidence artifact。当 `ValidatorAsset` 把 `app_ws` 声明为期望证据来源时，App 主动推送消息会按 run 落盘，并由 App WebSocket extractor 抽取为 `ExecutionFact`。

App WebSocket 读取到的 scene hierarchy 和 node 属性属于 App 内部观测证据。它可以辅助定位交互对象、解释 App 状态或生成结构化执行事实，但不等同于设备 UI 后端；真实设备 UI 控制仍由 WDA 或 uiautomator2 执行。

## 12. 证据获取

### 12.1 Extractor 边界

`evidence_extractors` 属于外部 `ValidatorAsset` 输入契约。AppPilot 负责执行 extractor、保存 extractor 结果并生成 `ExecutionFact`，但本章不重复定义 extractor 字段。

### 12.2 证据产出 Schema

AppPilot 在 instance 执行过程中采集日志、App 侧结构化信号、业务事件、App WebSocket 证据、API/SQL 结果、线上数据快照、UI 观测、截图和设备状态。

每个 instance 产出独立的 `ExecutionResult`、`EvidenceBundle` 和 `ExecutionFact`。证据采集和事实抽取必须保留来源、时间、实例、step 和 artifact 引用，便于后续检查、恢复和人工确认。

```ts
// 执行环境摘要
type ExecutionEnvironment = {
  // 执行平台
  platform: Platform;
  // 设备 ID 列表
  deviceIds: string[];
  // 系统版本列表
  osVersions?: string[];
  // App 版本
  appVersion?: string;
  // SDK 版本
  sdkVersion?: string;
  // 网络配置
  networkProfile?: string;
};

// 执行结果中的 artifact 摘要
type ExecutionArtifactSummary = {
  // artifact ID
  artifactId: string;
  // artifact 类型
  type: ArtifactType;
  // artifact 存储 URI
  uri: string;
  // 采集时间
  capturedAt: string;
  // artifact 内容 hash
  contentHash?: string;
};

// extractor 运行结果摘要
type ExtractorResultSummary = {
  // 证据提取器 ID
  extractorId: string;
  // 来源 artifact ID
  sourceArtifactId: string;
  // 提取时间
  extractedAt: string;
  // 提取后的输出引用
  outputRefs: string[];
};

// 一次验证执行的原始结果摘要
type ExecutionResult = {
  // 单次验证 run ID
  runId: string;
  // 长任务 ID
  taskId: string;
  // 使用的 Validator Asset ID
  validatorAssetId: string;
  // 关联的 Validation Fact ID 列表
  validationFactIds: string[];
  // 本次执行状态
  status: "passed" | "failed" | "partial" | "blocked";
  // 执行环境
  environment: ExecutionEnvironment;
  // 原始 artifact 列表
  artifacts: ExecutionArtifactSummary[];
};

// 一次执行的结构化证据包
type EvidenceBundle = {
  // 证据包 ID
  evidenceBundleId: string;
  // 单次验证 run ID
  runId: string;
  // 使用的 Validator Asset ID
  validatorAssetId: string;
  // 原始 artifact 引用列表
  artifactRefs: string[];
  // 证据提取结果
  extractorResults: ExtractorResultSummary[];
};

// 从证据中提取出来的结构化执行事实
type ExecutionFact = {
  // 执行事实 ID
  factId: string;
  // 单次验证 run ID
  runId: string;
  // 使用的 Validator Asset ID
  validatorAssetId: string;
  // 关联的 Validation Fact ID 列表
  validationFactIds: string[];
  // 事实来源通道
  source: EvidenceChannel;
  // 事实主体
  subject: string;
  // 事实谓词
  predicate: string;
  // 观测值
  observedValue: unknown;
  // 观测时间
  timestamp?: string;
  // 支撑该事实的证据引用
  evidenceRefs: string[];
  // 提取置信度
  confidence: number;
  // 关联模块
  modules?: string[];
  // 关联验证触点
  validationTouchpoints?: string[];
};

// 验证执行、证据抽取或结果解释过程中产生的诊断信息
type Diagnostic = {
  // 稳定诊断码
  code: string;
  // 诊断级别
  severity: "info" | "warning" | "error";
  // 可读诊断描述
  message: string;
  // 支撑该诊断的证据引用
  evidenceRefs?: string[];
};
```

### 12.3 典型提取方式

- 从日志 selector 提取结构化 predicate。
- 从 App 侧结构化信号提取 observed value。
- 从业务事件 schema 提取执行事实。
- 从 App WebSocket 证据中提取结构化执行事实。
- 从数据快照提取线上状态、监控指标、配置状态或后端状态事实。
- 从 UI node query 提取可见性或状态事实。
- 把截图作为证据引用绑定到事实。
- 从设备状态快照提取环境事实。

## 13. Evidence Store

### 13.1 存储边界

Evidence Store 负责保存一次 run 的原始 artifact、结构化证据包、执行事实、人工确认材料和写回材料引用。SQLite 只保存状态、索引、checkpoint 和引用；大体积 artifact 正文保存在 run 级证据目录中。

Evidence Store 采用 run 级目录结构。现有 `~/.apppilot/artifact` 可以继续作为 legacy artifact 目录或构建产物缓存；进入验证 run 后，所有证据都必须复制、链接或登记到对应 run 的 Evidence Store，并在 SQLite 中登记 artifact 引用。

### 13.2 目录结构

Evidence Store 建议目录结构：

```text
~/.apppilot/
  runs/
    <runId>/
      manifest.json
      input/
        validator-asset.json
        run-options.json
        runtime-plan.json
      agent/
        sessions/
        requests/
        reviews/
        prompts/
      events/
        events.ndjson
        consumptions.ndjson
      instances/
        <instanceId>/
          manifest.json
          evidence/
            log/
            app_signal/
            business_event/
            app_ws/
            api/
            sql/
            data_snapshot/
            ui/
            screenshot/
            device_state/
          bundles/
          facts/
      run-evidence/
        build_artifact/
        agent_record/
        runtime_plan/
        human_confirmation/
        writeback_material/
      exports/
        summary/
        evidence/
        writeback_package/
        local_run_summary/
      redaction/
        rules.json
        report.json
```

目录说明：

- `manifest.json`：run 级索引，记录 `runId`、`taskId`、`validatorAssetHash`、`runtimePlanRef`、参与的 `instanceIds`、artifact 索引摘要和导出状态。
- `input/`：保存本次 run 的输入快照。这里的 `runtime-plan.json` 是内部执行计划，不得作为外部资产写回。
- `agent/`：保存 agent session、agent request、agent review、人工提示和 agent 原始响应引用。
- `events/`：保存 Run Event Bus 的可读导出。恢复仍以 SQLite 为准，`events.ndjson` 只用于审计和重放辅助。
- `instances/<instanceId>/manifest.json`：instance 级索引，记录设备、平台、OS、App 版本、SDK 版本、实例状态、证据实例和 artifact 引用。
- `instances/<instanceId>/evidence/<channel>/`：instance 级原始证据目录。每个证据通道独立保存，避免多设备证据互相覆盖。
- `instances/<instanceId>/bundles/`：该实例生成的 `EvidenceBundle`。
- `instances/<instanceId>/facts/`：该实例生成的 `ExecutionFact`。
- `run-evidence/`：run 级 artifact 目录，用于构建产物、agent 记录、runtime plan、人工确认和写回材料。
- `exports/`：对外导出目录。导出内容只能来自已登记 artifact、bundle、fact、确认记录和写回材料。
- `redaction/`：脱敏规则和脱敏报告。原始 artifact 可以保留在内部目录中，对外导出必须引用脱敏结果或明确标记未脱敏。

命名规则：

- artifact 文件名必须包含时间戳或序号，避免同一 channel 多次采集互相覆盖。
- artifact 必须在 SQLite `DbArtifactRecord` 中登记 `artifactId`、`runId`、`instanceId`、`evidenceInstanceId`、`type`、`uri`、`contentHash` 和 `createdAt`。
- 大型 payload 不直接写入 SQLite，只写入 Evidence Store 后在数据库中保存引用。
- 多实例 run 中，instance 级 artifact 必须写入对应 `instances/<instanceId>/` 目录。
- run 级 artifact 不得伪装成 instance 级证据；如果证据来自具体设备，必须带 `instanceId`。

保留与导出策略：

- `summary` 导出只包含执行摘要、证据摘要、诊断摘要和稳定引用。
- `evidence` 导出可以包含脱敏后的 artifact、EvidenceBundle 和 ExecutionFact。
- `writeback_package` 导出必须包含人工确认引用，不得包含未确认写回材料。
- `local_run_summary` 只导出本机观察记录，不做权威覆盖判断。
- 删除或清理 Evidence Store 前必须先确认没有未导出的写回材料、未完成确认提示或可恢复 checkpoint。

## 14. 安全规则

### 14.1 Runtime Safety Policy

`RuntimeSafetyPolicy` 属于 runtime 安全策略，不属于 Timer Schema。它定义 runtime tick、ReAct 循环策略、心跳触发、Event Bus backpressure 和异常响应边界；Scheduler 只根据这些策略产出 timer、观察窗口和 heartbeat 事件，Agent 只根据 Run Event Bus 中的事件做策略响应，step 状态仍由 runtime 统一写入。

`runtime_tick` 只在 AppPilot 内部消费，不发布到 Run Event Bus。runtime monitor 在 tick 中执行证据采集、状态检查、stall 检测、预算检查和调度健康检查；只有当 `HeartbeatPolicy` 条件满足或异常策略命中时，才向 Run Event Bus 写入 Agent 可见的 heartbeat 或 exception 事件。

```ts
// runtime tick 策略
type RuntimeTickPolicy = {
  // 是否启用 runtime tick
  enabled: boolean;
  // tick 最小间隔，避免安全检查过于频繁
  minIntervalMs?: number;
  // 内部 tick 信号类型；不进入 Run Event Bus
  internalSignal: "runtime_tick";
};

// 心跳触发策略；心跳监控 step 级健康状态，不监控单次工具调用
type HeartbeatPolicy = {
  // 兜底心跳间隔
  intervalMs: number;
  // 立即触发心跳的条件
  triggers: {
    // 当前 step 的 ReAct 循环超过多久没有产出新的 ReactIterationRecord
    stepReactStallThresholdMs: number;
    // step 级预算使用比例阈值
    stepBudgetUsageThreshold: number;
    // run 级总预算使用比例阈值
    runBudgetUsageThreshold: number;
  };
};

// ReAct 循环策略
type ReactPolicy = {
  // 单个 react_task 默认最大迭代次数
  defaultMaxIterations: number;
  // 单次 observation 默认最大等待时间
  defaultObservationTimeoutMs: number;
  // verification 失败回喂是否作为一轮迭代消耗 maxIterations 预算
  countVerificationAsIteration: true;
  // 是否持久化完整推理过程；默认 false，仅在 debug 或合规审计需要时打开
  persistFullReasoning: boolean;
  // 同一 step 内连续 verification 全失败次数上限；超过即提前转 step_failed
  maxConsecutiveFailedVerifications?: number;
};

// Event Bus backpressure 策略
type EventBusBackpressurePolicy = {
  // 待处理事件超过多少条时暂停非关键事件产出
  pauseThreshold: number;
  // 待处理事件低于多少条时恢复非关键事件产出
  resumeThreshold: number;
  // 暂停期间仍允许写入的事件分类
  alwaysAllowCategories: Array<"exception">;
  // 暂停期间是否合并重复心跳
  coalesceHeartbeat: boolean;
};

// 异常处理策略
type ExceptionHandlingPolicy = {
  // 同一步骤允许自动重试的最大次数
  maxStepRetries: number;
  // 同一异常类型允许自动重试的最大次数
  maxSameExceptionRetries: number;
  // 允许自动降级的异常类型
  degradableEventTypes?: ValidationEventType[];
  // 必须提示人工的异常类型
  humanPromptEventTypes?: ValidationEventType[];
  // 必须立即停止的异常类型
  stopEventTypes?: ValidationEventType[];
};

// runtime 安全策略
type RuntimeSafetyPolicy = {
  // runtime tick 策略
  tick: RuntimeTickPolicy;
  // 心跳策略
  heartbeat: HeartbeatPolicy;
  // Event Bus backpressure 策略
  eventBusBackpressure: EventBusBackpressurePolicy;
  // 异常处理策略
  exceptionHandling: ExceptionHandlingPolicy;
  // ReAct 循环策略
  reactPolicy: ReactPolicy;
};
```

同一事件类型命中多个异常处理列表时，优先级固定为 `stopEventTypes > humanPromptEventTypes > degradableEventTypes`。Event Bus 积压不触发 heartbeat；积压超过 `pauseThreshold` 时，runtime 暂停非关键事件产出，低于 `resumeThreshold` 后恢复。

### 14.2 执行与写回安全

- AppPilot 不直接写外部 consumption snapshot 或 published index。
- AppPilot 不在缺少人工确认时产出写回材料包。
- 本地 SQLite 数据库只保存状态、索引、checkpoint 和引用，不保存大体积 artifact 正文。
- 阶段边界的任务状态、事件、checkpoint 和 artifact 引用必须在同一数据库事务中提交。
- Agent 只能调用已授权的工具和参数。
- Agent 的检查反馈不能替代人工确认。
- `RuntimeExecutionPlan` 和 `RuntimeExecutionStep` 是内部执行产物，不得原样写回为外部 `ValidatorAsset`。
- 写回候选必须先生成明确的 `ValidatorFlowStep` 等 `ValidatorAsset` 字段，并经过人工确认。
- 多实例 run 中，instance 级证据必须带 `instanceId`；证据实例必须带 `evidenceInstanceId`。
- run 级结论必须来自 `RunAggregationResult`，不能任选某个实例结果作为总结果。
- 已确认 run 只覆盖确认范围中的平台、场景、设备、App 版本、SDK 版本、OS 版本和网络环境。
- 已确认的 `ExecutionFact` 不做原地覆盖。
- 原始 artifact 可以在导出前做脱敏，但必须在 artifact ref 中记录 redaction。
- 缺少 required evidence 时必须输出 `partial` 或 `blocked`，不能输出 `passed`。
- extractor confidence 不能解释为长期资产可信度。
- `failed / partial / blocked / interrupted` 的 diagnostics 必须保留用于审计。
- cancellation 只能阻止后续动作，不删除已经写出的证据。

### 14.3 人工确认边界

人工确认用于确认执行结果、证据范围、诊断解释和准备回流的材料。没有人工确认，AppPilot 不应把本次 run 的结果包装为可写回材料。

确认记录必须落到 run 目录和本地状态数据库，作为后续审计、恢复和导出的依据。人工确认只覆盖确认记录声明的范围，AppPilot 不得从窄范围 run 推断更大范围已验证。

```ts
// 人工确认类型
type HumanConfirmationType =
  // 确认 run 级执行结果
  | "result"
  // 确认证据覆盖范围
  | "evidence_scope"
  // 确认诊断解释
  | "diagnostic_interpretation"
  // 确认写回材料
  | "writeback_material"
  // 人工介入处理异常
  | "manual_intervention";

// 人工确认结果
type HumanConfirmationDecision =
  // 通过确认
  | "approved"
  // 拒绝确认
  | "rejected"
  // 需要修改后再确认
  | "needs_changes"
  // 人工介入后异常已处理，可以继续执行
  | "resolved"
  // 人工无法处理或需要升级处理，runtime 应停止或转入 blocked
  | "escalated";

// 人工确认覆盖范围
type HumanConfirmationScope = {
  // 确认范围 ID
  scopeId: string;
  // 单次验证 run ID
  runId: string;
  // 参与确认的验证实例 ID 列表
  instanceIds: string[];
  // 参与确认的证据实例 ID 列表
  evidenceInstanceIds?: string[];
  // 确认平台
  platform: Platform;
  // 确认场景
  scenario?: string;
  // 确认设备 ID 列表
  deviceIds?: string[];
  // 确认 OS 版本列表
  osVersions?: string[];
  // 确认 SDK 版本
  sdkVersion?: string;
  // 确认 App 版本
  appVersion?: string;
  // 确认网络或环境配置
  environmentProfile?: string;
};

// 人工确认记录
type HumanConfirmationRecord = {
  // 确认记录 ID
  confirmationId: string;
  // 单次验证 run ID
  runId: string;
  // 本地任务 ID
  taskId: string;
  // 对应的人工提示 ID
  promptId?: string;
  // 确认类型
  confirmationType: HumanConfirmationType;
  // 确认结果
  decision: HumanConfirmationDecision;
  // 确认覆盖范围
  scope: HumanConfirmationScope;
  // 确认人标识
  confirmedBy: string;
  // 确认时间
  confirmedAt: string;
  // 人工备注
  notes?: string;
  // 关联 run 聚合结果引用
  runAggregationResultRef?: string;
  // 关联证据引用
  evidenceRefs: string[];
  // 关联写回材料引用
  writebackMaterialRefs?: string[];
  // 确认记录 artifact 引用
  artifactRef: string;
};
```

`external.confirmation.submit` 的 `result` 直接写入 `HumanConfirmationRecord.decision`。不同 `confirmationType` 允许的 `result` 取值固定如下：

- `result`、`evidence_scope`、`diagnostic_interpretation`、`writeback_material`：只允许 `approved`、`rejected`、`needs_changes`，不允许 `resolved` 或 `escalated`。
- `manual_intervention`：只允许 `resolved` 或 `escalated`，不允许 `approved`、`rejected`、`needs_changes`。

提交的 `result` 与 `confirmationType` 不匹配时，AppPilot 必须拒绝该确认输入，并在输出中返回 `accepted: false`，不改变任务状态。

## 15. 错误处理

### 15.1 错误 Schema

错误使用稳定 code 和 recoverable 字段表达。

```ts
// AppPilot 稳定错误结构
type AppPilotError = {
  // 稳定错误码
  code:
    // 构建失败
    | "BUILD_FAILED"
    // 未找到目标设备
    | "DEVICE_NOT_FOUND"
    // 安装失败
    | "INSTALL_FAILED"
    // 启动失败
    | "LAUNCH_FAILED"
    // 设备动作失败
    | "ACTION_FAILED"
    // 设备 UI 控制后端不可用
    | "DEVICE_CONTROL_BACKEND_UNAVAILABLE"
    // 缺少必要证据
    | "EVIDENCE_MISSING"
    // extractor 执行失败
    | "EXTRACTOR_FAILED"
    // 结果解释不明确
    | "RESULT_AMBIGUOUS"
    // 需要人工确认
    | "CONFIRMATION_REQUIRED"
    // 任务已取消
    | "TASK_CANCELLED"
    // 任务被中断
    | "TASK_INTERRUPTED";
  // 错误描述
  message: string;
  // 是否可恢复
  recoverable: boolean;
  // 关联证据引用
  evidenceRefs?: string[];
};
```

### 15.2 恢复语义

可恢复错误可以按阶段重试。不可恢复错误使验证任务进入 `failed` 或 `blocked`，具体取决于验证流程是否到达验证触点。

## 16. 审计与重放

### 16.1 必须记录的审计材料

每次验证 run 必须记录：

- 原始 `ValidatorAsset` 和 run options 快照。
- `ValidatorAsset` 正文或解析后的 `validatorAssetRef`。
- Agent 控制配置、Agent 会话、Agent 计划、Agent 检查反馈和人工确认提示。
- ReAct 每轮 `ReactIterationRecord`，包括 `reasoningSummary`、action、observation、verification feedback 和 artifact 引用。
- 本地 SQLite 数据库中的 run 记录、事件记录、checkpoint 记录、artifact 引用和恢复记录。
- 多实例 run 的 `ValidationInstance`、`EvidenceInstance` 和 `RunAggregationResult`。
- 构建产物引用。
- 设备会话引用。
- 任务检查点。
- 原始 artifacts 和 content hash。
- extractor 输出。
- `ExecutionFact`。
- 人工确认记录。
- 写回材料包。

### 16.2 重放要求

给定同一个 run 目录，AppPilot 应能在不重新执行设备流程的情况下，基于 `ReactIterationRecord` 完整轨迹、Evidence Store、SQLite 事件记录和 artifact 索引，重放证据提取、Runtime 验证和写回材料包生成。
