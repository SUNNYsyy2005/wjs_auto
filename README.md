# 问卷星自动提交工具

这是一个基于 Node.js 和 Playwright 的问卷星自动提交工具，可以自动解析问卷结构、捕获提交请求并批量提交问卷。

## 🚀 功能特性

- **自动解析问卷结构**：自动获取问卷的题目、选项和类型
- **智能填写答案**：支持单选题、多选题、填空题的智能随机填写
- **验证码自动处理**：自动检测并处理验证码验证
- **批量提交**：支持配置提交次数，自动批量提交
- **灵活配置**：支持自定义选项权重、填空题词库等

## 📋 系统要求

- Node.js 16.0 或更高版本
- Windows/Mac/Linux 操作系统
- 稳定的网络连接

## 🛠 安装步骤

### 1. 克隆或下载项目
```bash
# 如果使用 git
git clone <项目地址>
cd wjx

# 或者直接下载并解压到 wjx 文件夹
```

### 2. 安装依赖
```bash
npm install
```

如果 `package.json` 不存在，请手动安装依赖：
```bash
npm init -y
npm install playwright axios jsdom
```

### 3. 安装 Playwright 浏览器
```bash
npx playwright install chromium
```

## 📖 使用方法

### 第一步：获取问卷结构
1. 在 `config.json` 中配置问卷 URL：
```json
{
  "surveyUrl": "https://www.wjx.cn/vm/你的问卷ID.aspx"
}
```

2. 运行结构解析脚本：
```bash
node getFormInfo.js
```

这将生成 `survey_structure.json` 文件并自动更新 `config.json` 中的 questions 配置。

### 第二步：捕获提交请求（可选）
```bash
node captureRequire.js
```

- 脚本会打开浏览器窗口
- 手动填写一次问卷并提交
- 脚本会自动捕获提交请求并保存到 `captured_request.json`

### 第三步：自动提交
```bash
node autoSubmit.js
```

脚本会根据配置自动批量提交问卷。

## ⚙️ 配置说明

### config.json 配置文件

```json
{
  "general": {
    "defaultMinAnswers": 2,
    "defaultMaxAnswers": 4,
    "submissionCount": 10
  },
  "surveyUrl": "https://www.wjx.cn/vm/OPuo8ig.aspx",
  "questions": [
    {
      "id": "1",
      "title": "单选题测试",
      "type": "单选题",
      "options": {
        "1": 1,
        "2": 1
      }
    },
    {
      "id": "2",
      "title": "多选题测试",
      "type": "多选题",
      "options": {
        "1": 1,
        "2": 1,
        "3": 1
      },
      "minAnswers": 2,
      "maxAnswers": 4
    },
    {
      "id": "3",
      "title": "填空题测试",
      "type": "填空题",
      "wordBank": [
        "非常有意义",
        "建议很好",
        "希望学校多举办此类活动",
        "收获很大"
      ]
    }
  ]
}
```

### 配置项说明

#### general 配置
- `submissionCount`: 提交次数
- `defaultMinAnswers`: 多选题最少选择项数
- `defaultMaxAnswers`: 多选题最多选择项数

#### questions 配置
- `id`: 题目ID
- `title`: 题目标题
- `type`: 题目类型（单选题、多选题、填空题、多行文本题）
- `options`: 选项权重配置（数字越大被选中概率越高）
- `minAnswers`/`maxAnswers`: 多选题的选择范围
- `wordBank`: 填空题的候选词库

## 🔧 高级功能

### 调试模式
使用环境变量 `DRY_RUN=1` 可以预览将要发送的请求而不实际提交：
```bash
# Windows PowerShell
$env:DRY_RUN='1'; node .\autoSubmit.js

# Linux/Mac
DRY_RUN=1 node ./autoSubmit.js
```

### 验证码处理
工具自动检测并处理验证码：
- 自动点击验证码按钮
- 等待验证完成或页面跳转
- 支持超时保护（1秒超时）

## 📁 文件说明

| 文件名 | 说明 |
|--------|------|
| `config.json` | 主配置文件，包含问卷URL和答题配置 |
| `getFormInfo.js` | 问卷结构解析脚本 |
| `captureRequire.js` | 请求捕获脚本 |
| `autoSubmit.js` | 自动提交脚本 |
| `survey_structure.json` | 问卷结构数据（自动生成） |
| `captured_request.json` | 捕获的请求数据（可选） |
| `package.json` | Node.js 依赖配置 |

## ⚠️ 注意事项

1. **合规使用**：请确保使用本工具符合问卷星的服务条款，仅用于合法的测试和研究目的
2. **网络限制**：避免过于频繁的提交，建议在提交间隔中加入随机延迟
3. **验证码**：工具可自动处理简单验证码，复杂验证码可能需要人工介入
4. **数据备份**：重要配置请及时备份
5. **版本兼容**：如遇到问卷星页面结构变化，可能需要更新脚本

## 🐛 常见问题

### Q: 提示"Cannot navigate to invalid URL"
A: 检查 `config.json` 中的 `surveyUrl` 是否正确配置

### Q: 验证码处理失败
A: 验证码类型可能发生变化，建议使用 `captureRequire.js` 重新捕获请求

### Q: 提交失败或无响应
A: 可能是网络问题或问卷星限制，建议：
- 检查网络连接
- 减少提交频率
- 重新捕获请求模板

### Q: 脚本运行卡住
A: 工具已内置超时保护，单次提交超时1秒会自动跳过

## 📝 更新日志

- **v1.0.0**: 初始版本，支持基本的问卷解析和提交
- **v1.1.0**: 添加验证码自动处理
- **v1.2.0**: 优化超时机制，避免长时间卡住

## 📄 许可证

本项目仅供学习和研究使用，请遵守相关法律法规和平台服务条款。

---

如有问题或建议，欢迎提交 Issue 或 Pull Request。
