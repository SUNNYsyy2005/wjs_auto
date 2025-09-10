const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

const CONFIG_FILENAME = 'config.json';
const STRUCTURE_FILENAME = 'survey_structure.json';

async function extractSurveyFromUrl(url) {
    console.log('🚀 正在启动浏览器...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        console.log(`🧭 正在导航至: ${url}`);
        // 增加页面加载的超时时间至60秒，以应对网络波动
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

        console.log('🔍 页面加载完成，开始解析所有题型...');
        await page.waitForSelector('#divQuestion', { timeout: 15000 }); // 等待问题容器出现

        const questionLocators = page.locator('#divQuestion > .fieldset > .field[topic]');
        const questionCount = await questionLocators.count();
        
        if (questionCount === 0) {
            throw new Error('❌ 未找到任何问题。请检查URL或页面结构是否已更改。');
        }
        
        console.log(`📊 共找到 ${questionCount} 个问题。`);

        const surveyData = [];
        const allQuestions = await questionLocators.all();

        for (let i = 0; i < allQuestions.length; i++) {
            const questionLocator = allQuestions[i];
            
            const questionData = {
                id: await questionLocator.getAttribute('topic'),
                index: i + 1,
                title: '',
                type: '未知',
                options: {}
            };

            // 1. 获取问题标题 (*** 这是关键修正点 ***)
            // 直接定位包含问题文本的 .topichtml 元素
            const titleElement = questionLocator.locator('.topichtml');
            questionData.title = (await titleElement.innerText()).trim();

            // 2. 判断问题类型并提取数据
            if (await questionLocator.locator('input[type="radio"]').count() > 0) {
                questionData.type = '单选题';
                const optionLabels = await questionLocator.locator('.ui-controlgroup .label').all();
                for (const label of optionLabels) {
                    const forId = await label.getAttribute('for');
                    const inputLocator = page.locator(`#${forId}`);
                    const optionValue = await inputLocator.getAttribute('value');
                    const optionText = (await label.innerText()).trim();
                    questionData.options[optionValue] = optionText;
                }
            } 
            else if (await questionLocator.locator('input[type="checkbox"]').count() > 0) {
                questionData.type = '多选题';
                const optionLabels = await questionLocator.locator('.ui-controlgroup .label').all();
                for (const label of optionLabels) {
                    const forId = await label.getAttribute('for');
                    const inputLocator = page.locator(`#${forId}`);
                    const optionValue = await inputLocator.getAttribute('value');
                    const optionText = (await label.innerText()).trim();
                    questionData.options[optionValue] = optionText;
                }
            }
            else if (await questionLocator.locator('input[type="text"]').count() > 0) {
                questionData.type = '填空题';
            }
            else if (await questionLocator.locator('textarea').count() > 0) {
                questionData.type = '多行文本题';
            }

            surveyData.push(questionData);
            console.log(`    - 已解析 Q${questionData.id}: [${questionData.type}]`);
        }
        
        // 保存问卷结构到 survey_structure.json
        await fs.writeFile(STRUCTURE_FILENAME, JSON.stringify(surveyData, null, 2));
        console.log(`\n✅ 成功！问卷结构已保存至文件: ${STRUCTURE_FILENAME}`);

        // 读取现有配置（如果存在），并用解析到的问题覆盖 questions 字段
        try {
            const configRaw = await fs.readFile(CONFIG_FILENAME, 'utf-8');
            const config = JSON.parse(configRaw);

            // 构建默认配置问题结构；单选/多选权重默认相等（1），多选使用通用min/max，填空题填充默认词库
            const defaultMin = config.general?.defaultMinAnswers || 1;
            const defaultMax = config.general?.defaultMaxAnswers || 4;
            const defaultWordBank = ["非常有意义", "建议很好", "希望学校多举办此类活动", "收获很大"];

            config.questions = surveyData.map(q => {
                const cfg = { id: q.id, title: q.title, type: q.type };
                if (q.type === '单选题' || q.type === '多选题') {
                    cfg.options = {};
                    for (const key of Object.keys(q.options || {})) cfg.options[key] = 1; // 默认权重1
                    if (q.type === '多选题') {
                        cfg.minAnswers = defaultMin;
                        cfg.maxAnswers = defaultMax;
                    }
                } else if (q.type === '填空题' || q.type === '多行文本题') {
                    cfg.wordBank = defaultWordBank;
                }
                return cfg;
            });

            // 将 surveyUrl 回写到 config（若未设置）以确保一致
            if (!config.surveyUrl) config.surveyUrl = url;

            await fs.writeFile(CONFIG_FILENAME, JSON.stringify(config, null, 2));
            console.log(`✅ 已更新 ${CONFIG_FILENAME} 中的 questions 字段。`);
        } catch (err) {
            // 如果没有配置文件，则只提示生成的 survey_structure.json
            console.warn(`⚠️ 无法更新 ${CONFIG_FILENAME}: ${err.message}`);
        }

    } catch (error) {
        console.error('\n❌ 在执行过程中发生错误:', error.message);
    } finally {
        await browser.close();
        console.log('👋 浏览器已关闭。');
    }
}

// 从 config.json 读取 URL 并运行
async function main() {
    try {
        const cfgRaw = await fs.readFile(CONFIG_FILENAME, 'utf-8');
        const cfg = JSON.parse(cfgRaw);
        if (!cfg.surveyUrl) {
            console.error(`请在 ${CONFIG_FILENAME} 中配置 "surveyUrl" 字段后重试。`);
            process.exit(1);
        }
        await extractSurveyFromUrl(cfg.surveyUrl);
    } catch (error) {
        console.error(`\n❌ 无法读取 ${CONFIG_FILENAME}: ${error.message}`);
        process.exit(1);
    }
}

main();