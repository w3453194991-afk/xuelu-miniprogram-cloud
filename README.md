# 学鹭伴学 xuelu

同一个项目的两份产物：**H5 网页端**（上游实现）与**微信小程序**（云开发版移植）。
网页端先做，小程序从它移植而来；两端各自独立运行，不共享数据层。

## 仓库结构

```
.
├── miniprogram-cloud/        微信小程序（微信云开发）
│   ├── miniprogram/            小程序前端，24 个页面
│   ├── cloudfunctions/         云函数 16 个
│   │   applications assistant auth content exam feedback gaokao
│   │   institutions learning lists location orders plan profile seed services
│   ├── tools/                  本地校验、页面模拟、批量截图脚本
│   └── project.config.json     微信开发者工具工程配置
│
└── web/                      H5 网页端
    ├── server.mjs              零依赖 Node HTTP 服务（Node ≥22）
    ├── public/                 原生 JS 响应式页面：家长端 + 管理工作台
    ├── tests/                  node --test 接口集成测试
    └── data/store.json         演示数据（首次启动自动生成）
```

## 两端关系

| | 网页端 | 小程序 |
| --- | --- | --- |
| 后端 | `server.mjs` + `data/store.json` | 云函数 + 云数据库 |
| 前端 | 原生 JS / CSS，无框架 | WXML / WXSS / JS |
| 数据 | 单进程 JSON 文件 | 云数据库集合 |
| 状态 | 演示可用，非生产 | 内置模拟数据层，不部署也能全流程跑通 |

业务模型（课程 / 伴学 / 校车报名、机构工作台、订单支付核销、学习资源）来自网页端；
小程序的 `miniprogram/utils/plan-model.js` 标注由网页版 `plan.mjs` 移植。

## 快速开始

### 小程序

用微信开发者工具导入 `miniprogram-cloud/` 目录。

- 默认 `miniprogram/utils/config.js` 里 `USE_CLOUD = false`，走**本地模拟模式**，无需云环境即可跑通注册、浏览、下单、核销、入驻审核全流程。
- 改用云开发：把 `USE_CLOUD` 设为 `true`、`CLOUD_ENV` 填你的云环境 ID，并在 `cloudfunctions/` 下逐个上传部署云函数。

### 网页端

需要 Node.js 22 或更新版本，无第三方依赖。

```powershell
cd web
node server.mjs      # 打开 http://127.0.0.1:3100
node --test tests/api.test.mjs
```

## 已知缺口

- **网页端源码缺少「升学规划 / 高考 / 志愿」模块**：该功能目前只以小程序移植版（`plan-model.js`、`gaokao-data.js`）的形式存在，原 `plan.mjs` 未随源码归档。
- 两端数据不互通：小程序默认本地模拟，网页端是独立的演示后端。
- 网页端定位为架构演示，未做认证、商家隔离、真实支付与多实例部署。

## 授权

本仓库未附 LICENSE 文件。公开可读不构成使用、复制或再分发授权，如需引用请联系仓库所有者。
