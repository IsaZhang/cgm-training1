# CGM 转化训练小程序

一个用于培训照护师进行 CGM（动态血糖监测）销售转化的微信小程序系统。

## 项目结构

```
cgm-training/
├── miniprogram/          # 微信小程序前端
│   ├── pages/           # 页面
│   ├── utils/           # 工具函数
│   └── app.js           # 小程序入口
├── server/              # Node.js 后端
│   ├── routes/          # API 路由
│   ├── services/        # 业务逻辑
│   ├── data/            # 数据文件
│   └── app.js           # 服务器入口
├── DEPLOY.md            # 部署文档
└── STATS.md             # 数据统计文档
```

## 功能特性

- 知识卡片学习
- AI 模拟患者对话练习
- 正式考核与评分
- 考核历史记录
- 数据统计分析

## 技术栈

- 前端：微信小程序
- 后端：Node.js + Express
- 数据库：微信云开发数据库
- AI：通义千问 API

## 快速开始

详见 [DEPLOY.md](./DEPLOY.md)

## 数据统计

详见 [STATS.md](./STATS.md)
