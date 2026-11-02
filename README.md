# 学鹭伴学 · 微信小程序（微信云开发版）

把网页版「学鹭伴学」（课程 / 伴学 / 校车报名，机构工作台，学习资源，升学规划，考公考研考编、职考技能）完整移植到微信小程序，
并以**微信云开发**（云函数 + 云数据库）作为后端实现。

当前工程自带一套内置数据层：**不部署任何服务也能直接运行全部业务流程**（注册登录、浏览、下单支付核销、机构入驻审核、发布课程、院校库与志愿表、报考清单、反馈）。
部署云函数并切换开关后，同一套页面会改为调用云函数与云数据库，页面代码无需改动。

---

## 一、快速开始

1. 打开微信开发者工具 →「导入项目」→ 选择本目录（含 `project.config.json` 的根目录）。
2. AppID 已写入 `project.config.json`（`wx6a45829a8e263689`），导入后无需再填；换号时改这一个字段即可。
3. 直接点「编译」即可运行：默认走内置数据层，首页有 32 个服务（21 门课程，含小学数学 / 初中语文 / 小学英语 / 初中数学四门学科课 / 5 位伴学老师 / 2 条校车线路 + 2 位个人「帮忙接」+ 2 位私家车家长）、16 家机构（带评分模块）。
4. 想体验完整闭环：
   - 注册 → 选「家长」→ 浏览课程 → 报名 → 支付 → 订单页看到核销码 → 平台管理里核销；
   - 注册 → 选「机构」→「我要入驻」提交 → 我的 → 平台管理 → 输入令牌 `xuelu-admin` → 通过审核 → 机构工作台发布课程；
   - 「学习」页看考公 / 考研 / 考编 / 职考技能课程，「升学规划」填一次成绩看学业曲线、路径与选科，院校库单独成页可查分数线、加入志愿表。

## 二、切换到微信云开发

1. 开发者工具里开通云开发，记下**环境 ID**（形如 `xuelu-3g1a2b4c`）。
2. 右键 `cloudfunctions` 下的每个函数 →「上传并部署：云端安装依赖」，共 16 个：
   `auth` `services` `orders` `applications` `institutions` `profile` `feedback`
   `learning` `content` `location` `gaokao` `exam` `lists` `plan` `seed` `assistant`
3. 打开 `miniprogram/utils/config.js`，改成：

   ```js
   const USE_CLOUD = true;
   const CLOUD_ENV = '你的环境 ID';
   ```

4. 云开发控制台 → 数据库，新建集合：`users` `sessions` `services` `orders` `applications` `institutions`
   `profiles` `uploads` `feedback` `lists`（10 个，权限建议「仅创建者可读写」，读写都经云函数）。
5. 首次可调用一次 `seed` 云函数，把内置目录写进云数据库（也可直接跳过，云函数内已内置同一份初始目录）。
6. 平台审批令牌：云开发控制台 → 云函数 `applications` → 配置 → 环境变量 `ADMIN_TOKEN` = 你的令牌。
7. 学鹭助手启用大模型：云函数 `assistant` → 配置 → 环境变量 `DEEPSEEK_API_KEY` = 你的 Key（可选 `DEEPSEEK_MODEL`）。
   不配置也能用：助手会改用内置的 110 条常见问题作答，界面不会出现任何报错。

> `miniprogram/utils/config.js` 里的 `ADMIN_TOKEN` 只在内置数据模式下生效；云开发模式的令牌来自云函数环境变量。

## 三、页面与功能

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 首页 | `pages/index/index` | 六入口（学习资源 / 升学规划 / **接送** / 公考研训 / 职考技能 / 伴学服务）、关键词搜索、四个内容 Tab（精选推荐 / 课程 / 伴学 / 接送）、定位、助手悬浮球 |
| 接送板块 | `pages/transport/transport` | 独立板块页：固定线路 / 帮忙接 / 私家车三分段，安全保障条目，私家车车主入驻入口 |
| 伴学服务 | `pages/service/service` | 二级页：伴学老师 / 安心校车双 Tab，两个方向都是双选（家长挑老师、老师挑家庭） |
| 服务详情 | `pages/detail/detail` | 课程套餐、伴学资料（学校 / 专业 / 星级 / 自我介绍）、校车线路、帮忙接 / 私家车车主资料（含自家孩子年级）、机构评分（星级 / 四维小分 / 评价）、机构资料、套餐视频 |
| 报名下单 | `pages/booking/booking` | 课程选套餐；伴学按日期选时段；校车选上下车站点 |
| 我的订单 | `pages/orders/orders` | 状态分段、支付、取消、核销码、完成核销 |
| 我的 | `pages/mine/mine` | 账号信息、学员档案（最多 5 名）、功能入口 |
| 登录注册 | `pages/login/login` | 家长 / 大学生 / 机构三类账号 |
| 学习资源 | `pages/learning/learning` | 考公 / 考研 / 考编 / 职考技能 / 其他课程 × 科目筛选，底部「继续准备」三块快捷入口 |
| 课程详情 | `pages/learning-detail/learning-detail` | 学习资源课程详情与报名 |
| 升学规划 | `pages/gaokao/gaokao` | 六个板块：档案、学业曲线、路径规划、选科建议、多元升学、关键节点（由网页版 `plan.mjs` 移植） |
| 院校库 | `pages/gaokao-schools/gaokao-schools` | 院校检索与分页、分数线、志愿表（原志愿填报迁到这里） |
| 院校详情 | `pages/gaokao-detail/gaokao-detail` | 概况、专业（含历年趋势）、分数线 |
| 考公考研考编 | `pages/exam/exam` | 岗位库筛选、分数匹配、备考资料 |
| 岗位详情 | `pages/exam-detail/exam-detail` | 报考条件、历年分数线、加入报考清单 |
| 机构工作台 | `pages/institution/institution` | 机构资料维护、课程发布与编辑、套餐与视频 |
| 我要入驻 | `pages/join/join` | 机构 / 大学生 / 私家车车主入驻申请；私家车须为同时接送自家孩子的家长，需勾选五条安全承诺 |
| 学鹭助手 | `pages/assistant/assistant` | 悬浮入口进入，内置常见问题 + 可选 AI 对话，回答带页面跳转；支持按学段/年龄推荐学科课程（如「十一岁孩子的家长想找数学课程」会给出课程卡，点卡片直接进对应课程详情页报名） |
| 伴学详情 | `pages/companion/companion` | 大学生伴学资料与审核状态 |
| 意见反馈 | `pages/feedback/feedback` | 分类、评分、订单号、我的反馈与回复 |
| 帮助中心 | `pages/help/help` | 平台介绍、常见问题、联系方式 |
| 机构目录 | `pages/institutions/institutions` | 机构检索，列表卡带评分星级与评价数 |
| 机构主页 | `pages/merchant/merchant` | 头图与认证、机构评分卡（总分 / 星级 / 评价数 / 教学环境服务等四维小分 / 精选评价）、课程价格区间、校区环境、在售课程、教师介绍、资质与联系方式 |
| 平台管理 | `pages/admin/admin` | 令牌进入；入驻审核、全部订单核销、数据概览 |

身份与权限：

- **家长**：浏览、下单、支付、取消、订单核销码、学员档案、反馈；
- **大学生**：入驻申请（伴学方向、课时费、正脸照片）、伴学资料；
- **机构**：入驻申请 → 审核通过后进入工作台，只能发布/修改自己名下的课程；
- **平台管理员**：令牌进入平台管理，审核入驻、核销订单。

## 四、目录结构

```
project.config.json          项目配置（miniprogramRoot / cloudfunctionRoot）
miniprogram/
  app.js app.json app.wxss    入口、路由、全局样式（橙色主题）
  assets/ip/                  品牌白鹭图
  utils/
    api.js                    统一接口层（内置数据 / 云函数两种实现）
    mock.js                   内置数据后端（与云函数同规则：校验、状态机、并发名额）
    config.js                 开关：USE_CLOUD / CLOUD_ENV / ADMIN_TOKEN
    logic.js                  视图层纯函数（列表、详情、订单、院校、岗位）
    format.js                 金额、日期、状态文案
    seed-data.js              初始服务目录与平台内容（含职考技能 7 门课）
    institution-lib.js        机构 / 套餐 / 图片校验、机构主页聚合（与云函数同源）
    gaokao-model.js gaokao-data.js   高考院校模型与种子
    plan-model.js             升学规划六板块模型（由网页版 plan.mjs 移植）
    exam-model.js exam-data.js       考公考研考编模型与种子
  pages/                      24 个页面
cloudfunctions/               16 个云函数（每个目录内含 index.js / package.json / 依赖副本）
tools/
  check-project.js            结构自检（页面四件套、事件绑定、模板方法调用、文案检查）
  smoke-all.js                全链路接口冒烟（119 项断言）
  page-sim.js                 页面运行时自检（24 个页面的 onLoad / 交互）
  run-console.js              连开发者工具逐页扫控制台 warn / error（需要 --auto-port 9421）
  cloud-lib/                  云函数公共模块源，sync-common.js 负责同步到各函数目录
```

## 五、自检

```bash
node tools/check-project.js   # 结构 / 绑定 / 文案自检
node tools/smoke-all.js       # 全链路业务冒烟（119 项，内置数据模式）
node tools/page-sim.js        # 24 个页面 onLoad 与交互的运行时自检
```

连开发者工具（`cli auto --auto-port 9421`）后还可以跑 `node tools/run-console.js`，逐页扫控制台报错。

修改 `tools/cloud-lib/common.js`、`miniprogram/utils/institution-lib.js`、`miniprogram/utils/seed-data.js` 后，执行：

```bash
node tools/cloud-lib/sync-common.js
```

把公共模块同步到各云函数目录。三份公共模块的**唯一来源**：

| 模块 | 来源 | 说明 |
| --- | --- | --- |
| `common.js` | `tools/cloud-lib/` | 仅云函数使用 |
| `institution-lib.js` | `miniprogram/utils/` | 小程序与云函数共用，改小程序那份 |
| `seed-data.js` | `miniprogram/utils/` | 小程序与云函数共用，改小程序那份 |

## 六、数据与业务规则要点

- 服务目录 = 内置目录 + 用户新增/覆盖；机构信息由课程 `merchant` 汇总，机构可再维护简介、地址、联系人、电话。
- 下单即生成待支付订单；**支付时**串行复核名额/时段冲突，成功才发核销码，避免超卖。
- 伴学按「日期 + 时段」占用，同一时段只能成交一单；校车按下车站点必须在上车站点之后。
- 接送板块分三类：**固定线路**（机构校车，driver / plate / 经停时刻）、**帮忙接**（个人顺路代接，`pickupDetail`：接送人、学校、接送点、可接人数、实名核验）与**私家车**（`pickupDetail.kind = 'car'`，须为同时接送自家孩子的家长，`childGrade` 标注自家孩子年级）。列表按分段筛选时以数据结构判断，不依赖分类文案。
- 私家车入驻：任意登录用户可提交，字段含接送区域 / 学校 / 自家孩子年级 / 车型配置 / 可接人数（1–6）/ 可接时段，必须勾选五条安全承诺（实名核验、不载陌生乘客、安全座椅、两点往返、上车报位置）。
- 伴学老师资料含学校、专业、星级与自我介绍；星级为 0–5、一位小数，评价数 0–100000。
- 课程支持套餐（名称、价格、课时、说明、视频链接），报名金额取套餐价。
- 课程可标注备考方向（考公 / 考研 / 考编 / 职考技能 + 科目），标注后出现在「学习资源」对应科目下。
- 职考技能按证种设 7 个科目：教师资格、会计实务、建筑工程、社会工作、健康管理、人力资源、计算机等级，面向大学生与在职成人，每个科目都有种子课程，不出现空科目。
- 高考与考公考研考编数据由确定性模型生成，同一省份/分数/年份结果稳定可复现。
- 志愿表与报考清单按账号保存在 `lists`，最多 60 条。

## 七、边界说明

- 支付为余额无关的「下单即核销」流程，未接入微信支付；如需真实收款，把 `orders` 云函数的 `pay` 换成
  `wx.requestPayment` + 支付回调，其余状态流转可直接复用。
- 视频：套餐视频支持 http/https 链接或云存储 `cloud://` fileID；云存储视频需先用 `services` 云函数的
  `recordVideo` 登记，才能被课程引用。
- 地图与定位：`location` 云函数保留高德逆地理编码入口，未配置 Key 时返回默认城市；页面不会因缺 Key 报错。

## 七、服务人群分区（2026-10 更新）

机构入驻时选「家长 / 大学生」（可多选，默认家长），决定课程出现在哪个分区：

| 人群 | 出现的位置 |
| --- | --- |
| 家长 | 首页精选、课程 Tab、伴学 Tab、校车 Tab、机构目录 |
| 大学生 | 学习页 → 学习资源（考公 / 考研 / 考编 / 职考技能 / 其他课程），以及首页「大学生家教」相关伴学 |

- 只选「家长」的机构课程不进学习资源；只选「大学生」的机构不进家长端机构目录。
- 选了「大学生」但课程没设考试方向时，归入「其他课程」分类，课程不会消失。
- 机构工作台可随时改服务人群，保存后分区立即变化。
- 旧数据没有该字段时一律按「家长」处理，既有课程不受影响。

主题配色同步为奶油底 + 砖橙：主色 `#b8500f`、页面底 `#fdf8f2`、文字 `#4a382a`、
描边 `#f0e3d6`、选中底 `#fbe7d6`；升学规划冲 / 稳 / 保为 `#d99a52` / `#b8500f` / `#6b4a2b`。
