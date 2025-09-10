# 快速开始指南

## 🚀 5分钟快速上手

### 1. 安装依赖
```bash
npm install
npm install cross-env --save-dev
npx playwright install chromium
```

### 2. 配置问卷URL
编辑 `config.json` 文件，设置你的问卷链接：
```json
{
  "surveyUrl": "https://www.wjx.cn/vm/你的问卷ID.aspx"
}
```

### 3. 解析问卷结构
```bash
npm run parse
```

### 4. 开始自动提交
```bash
npm run submit
```

## 📝 NPM 脚本命令

| 命令 | 功能 |
|------|------|
| `npm run parse` | 解析问卷结构 |
| `npm run capture` | 捕获提交请求（可选） |
| `npm run submit` | 开始自动提交 |
| `npm run dry-run` | 预览模式（不实际提交） |
| `npm run install-browsers` | 安装浏览器依赖 |

## ⚡ 常用配置

### 修改提交次数
在 `config.json` 中修改：
```json
{
  "general": {
    "submissionCount": 50  // 改为你需要的次数
  }
}
```

### 自定义填空题答案
在 `config.json` 的问题配置中修改 `wordBank`：
```json
{
  "type": "填空题",
  "wordBank": [
    "你的自定义答案1",
    "你的自定义答案2"
  ]
}
```

### 调整选择题权重
数字越大，被选中的概率越高：
```json
{
  "type": "单选题",
  "options": {
    "1": 5,  // 高权重
    "2": 1   // 低权重
  }
}
```

---
更多详细信息请查看 [README.md](README.md)
