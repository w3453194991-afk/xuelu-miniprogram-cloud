# 高德地图集成配置指南

## 功能说明

服务详情弹窗中会显示服务地址对应的地图位置，并标记服务所在地。依赖高德地图 JS API 2.0。

## 申请 Key 步骤

### 1. 注册并登录

访问 [高德开放平台](https://lbs.amap.com/)，注册并登录账号。

### 2. 创建应用

进入「控制台」→「应用管理」→「我的应用」，点击「创建新应用」：
- 应用名称：学鹭伴学演示
- 应用类型：Web 端（JS API）

### 3. 添加 Key

在创建的应用下点击「添加 Key」：
- Key 名称：xuelu-web
- 服务平台：Web 端（JS API）
- **填写 Web 服务 URL**（重要）：
  - 本地开发：`http://127.0.0.1:3100`
  - Cloudflare Tunnel：`https://edu.liuiyunpro.cn`
  - 两个域名用分号分隔，或创建两个独立 key

提交后会得到：
- **Key**：一串字符，形如 `a1b2c3d4e5f6...`
- **安全密钥（securityJsCode）**：前端加密参数

### 4. 开通地理编码服务

在「控制台」→「Web 服务 API」→「地理编码」中开通该服务（通常自动开通，免费额度足够演示用）。

## 配置到项目

编辑 [`public/index.html`](./public/index.html)，找到这两行：

```html
<script>window._AMapSecurityConfig={securityJsCode:'YOUR_SECURITY_CODE'};</script>
<script src="https://webapi.amap.com/maps?v=2.0&key=YOUR_AMAP_KEY&plugin=AMap.Geocoder,AMap.ToolBar"></script>
```

替换为：

```html
<script>window._AMapSecurityConfig={securityJsCode:'你的安全密钥'};</script>
<script src="https://webapi.amap.com/maps?v=2.0&key=你的Key&plugin=AMap.Geocoder,AMap.ToolBar"></script>
```

**注意**：如果该项目会提交到公开仓库，**不要直接写死 key**。推荐做法：

### 方案一：服务端注入（推荐）

在 [`server.mjs`](./server.mjs) 的静态文件路由中动态注入：

```js
if (p === '/') {
  let html = await readFile(path.join(root, 'public', 'index.html'), 'utf8');
  html = html
    .replace('YOUR_SECURITY_CODE', process.env.AMAP_SECURITY_CODE || '')
    .replace('YOUR_AMAP_KEY', process.env.AMAP_KEY || '');
  res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  return res.end(html);
}
```

启动时传环境变量：

```powershell
$env:AMAP_KEY='你的Key'; $env:AMAP_SECURITY_CODE='你的安全密钥'; node server.mjs
```

或在 VPS 部署脚本 [`tools/start-local.py`](./tools/start-local.py) 中从配置文件读取。

### 方案二：`.env` + `.gitignore`

把 key 写在本地 `.env` 文件，启动时用 `dotenv` 或手动读取注入，并将 `.env` 加入 `.gitignore`。

## 测试

1. 启动服务：`node server.mjs`
2. 访问 http://127.0.0.1:3100
3. 点击任一服务卡片「查看详情」
4. 弹窗中应该显示地图并标记服务位置

如果地图容器显示灰色背景但没有地图：
- 检查浏览器控制台是否有 CORS 或 key 认证错误
- 确认 key 对应的 Web 服务 URL 包含当前访问地址
- 检查安全密钥是否正确配置

## 免费额度

高德地图个人开发者账号免费额度（2024 年标准）：
- 地理编码：30 万次/日
- JS API 加载：无限制

当前项目是演示原型，流量远低于限额。如需生产上线，建议监控用量并考虑申请企业认证。

## 地址数据来源

地图解析的地址优先级：
1. `service.address`（机构/课程/校车的详细地址）
2. `service.merchantDetail.address`（机构资料中的地址）
3. `service.location`（服务展示地址，通常只有区域，精度较低）

管理后台编辑服务时，建议在「机构管理」表单中填写完整的门牌地址，如「杭州市滨江区江南大道 88 号 3 层」，避免只写「滨江区 · 星光大道」导致地图定位到路口。

## 相关文件

- [`public/map.js`](./public/map.js) - 地图组件封装
- [`public/app.js`](./public/app.js#L1-L3) - 导入并调用 `showAddressMap`
- [`public/index.html`](./public/index.html) - 加载高德 SDK
- [`server.mjs`](./server.mjs#L716) - 静态文件白名单

## 故障排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 地图容器是灰色，无内容 | Key 未配置或无效 | 检查 `index.html` 中的 key 是否替换 |
| 控制台报 `INVALID_USER_KEY` | Key 配置的 Web URL 不匹配 | 在高德控制台添加当前访问地址 |
| 控制台报 `USERKEY_PLAT_NOMATCH` | Key 类型不是 Web 端 | 重新创建 Web 端（JS API）类型的 key |
| 显示「无法解析该地址」 | 地址格式不标准或不存在 | 在管理后台修改为完整地址 |
| 地图加载慢 | SDK 从高德 CDN 加载 | 正常现象，首次加载需 1-2 秒 |

---

**配置完成后，可以删除本文档中的 `YOUR_SECURITY_CODE` 和 `YOUR_AMAP_KEY` 占位符，换成真实密钥。如该项目会提交 Git，记得用服务端注入方案而非硬编码。**
