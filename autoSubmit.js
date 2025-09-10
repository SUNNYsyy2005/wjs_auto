const fs = require('fs').promises;
const { chromium } = require('playwright'); // 引入 Playwright

// --- 全局配置 ---
const CONFIG_FILENAME = 'config.json';
const STRUCTURE_FILENAME = 'survey_structure.json';
// 注意：SURVEY_URL 现在从配置文件读取，此处仅为备用
let SURVEY_URL = 'https://www.wjx.cn/vm/tUaOK04.aspx'; 

// --- 辅助函数 (无需修改) ---

/**
 * 根据权重随机选择一个选项
 */
function weightedRandomSelect(options) {
    const totalWeight = Object.values(options).reduce((sum, weight) => sum + weight, 0);
    if (totalWeight <= 0) return '';
    let random = Math.random() * totalWeight;
    for (const [value, weight] of Object.entries(options)) {
        if (random < weight) return value;
        random -= weight;
    }
    return Object.keys(options).pop();
}

/**
 * 根据权重随机选择多个不重复的选项
 */
function weightedRandomMultiSelect(options, min, max) {
    const numToSelect = Math.floor(Math.random() * (max - min + 1)) + min;
    const availableOptions = { ...options };
    const selected = new Set();
    while (selected.size < numToSelect && Object.keys(availableOptions).length > 0) {
        const choice = weightedRandomSelect(availableOptions);
        if (choice) {
            selected.add(choice);
            delete availableOptions[choice];
        }
    }
    return Array.from(selected);
}

/**
 * 应用条件规则调整选项权重
 */
function applyConditionalRules(questionId, originalOptions, previousAnswers, conditionalRules) {
    if (!conditionalRules || conditionalRules.length === 0) {
        return originalOptions;
    }

    const adjustedOptions = { ...originalOptions };

    // 遍历所有条件规则
    for (const rule of conditionalRules) {
        // 检查规则是否适用于当前问题
        if (rule.effect.targetQuestionId !== questionId) {
            continue;
        }

        // 检查条件是否满足
        const conditionQuestionId = rule.condition.questionId;
        const requiredOptions = rule.condition.selectedOptions;
        const actualAnswer = previousAnswers[conditionQuestionId];

        let conditionMet = false;
        if (actualAnswer) {
            if (Array.isArray(actualAnswer)) {
                // 多选题：检查是否有交集
                conditionMet = actualAnswer.some(option => requiredOptions.includes(option));
            } else {
                // 单选题：直接检查
                conditionMet = requiredOptions.includes(actualAnswer);
            }
        }

        if (conditionMet) {
            // 条件满足，应用权重调整
            const targetOption = rule.effect.targetOption;
            const multiplier = rule.effect.weightMultiplier || 1;

            if (adjustedOptions[targetOption] !== undefined) {
                adjustedOptions[targetOption] *= multiplier;
                console.log(`    💡 应用条件规则: Q${conditionQuestionId}选择了${actualAnswer}, Q${questionId}选项${targetOption}权重调整为${adjustedOptions[targetOption]}`);
            }
        }
    }

    return adjustedOptions;
}

/**
 * 智能选择答案（支持条件依赖）
 */
function intelligentSelect(question, previousAnswers, conditionalRules) {
    // 应用条件规则调整权重
    const adjustedOptions = applyConditionalRules(question.id, question.options, previousAnswers, conditionalRules);

    if (question.type === '单选题') {
        return weightedRandomSelect(adjustedOptions);
    } else if (question.type === '多选题') {
        return weightedRandomMultiSelect(adjustedOptions, question.minAnswers || 1, question.maxAnswers || Object.keys(adjustedOptions).length);
    }

    return null;
}

// --- 核心功能 (已重构) ---

/**
 * 引导用户生成默认的配置文件
 */
async function generateConfig() {
    console.log(`⚠️ 未找到配置文件 '${CONFIG_FILENAME}'。`);
    console.log(`ℹ️ 正在根据 '${STRUCTURE_FILENAME}' 为您生成一份默认配置...`);

    try {
        const structureRaw = await fs.readFile(STRUCTURE_FILENAME, 'utf-8');
        const questions = JSON.parse(structureRaw);
        const defaultConfig = {
            general: {
                surveyUrl: SURVEY_URL, // 将URL也加入配置
                submissionCount: 1,
                defaultMinAnswers: 2,
                defaultMaxAnswers: 4
            },
            questions: []
        };
        for (const q of questions) {
            const configQ = { id: q.id, title: q.title, type: q.type };
            if (q.type === '单选题' || q.type === '多选题') {
                configQ.options = {};
                for (const key in q.options) configQ.options[key] = 1;
                if (q.type === '多选题') {
                    configQ.minAnswers = defaultConfig.general.defaultMinAnswers;
                    configQ.maxAnswers = defaultConfig.general.defaultMaxAnswers;
                }
            } else if (q.type === '填空题' || q.type === '多行文本题') {
                configQ.wordBank = ["非常有意义", "建议很好", "希望学校多举办此类活动", "收获很大"];
            }
            defaultConfig.questions.push(configQ);
        }
        await fs.writeFile(CONFIG_FILENAME, JSON.stringify(defaultConfig, null, 2));
        console.log(`\n✅ 成功生成 '${CONFIG_FILENAME}'!`);
        console.log(`👉 请打开此文件，确认 'surveyUrl'，并修改权重、词库以及 'submissionCount' (提交次数)。`);
        console.log(`👉 修改完成后，请重新运行此脚本以开始自动提交。`);
        return false;
    } catch (error) {
        console.error(`\n❌ 生成配置文件失败: ${error.message}`);
        console.error(`请确保 '${STRUCTURE_FILENAME}' 文件存在且格式正确。`);
        return false;
    }
}

/**
 * 【最终版】使用 Playwright 执行完整的浏览器模拟提交
 */
async function runSubmission(config) {
    console.log(`🚀 开始执行本次提交任务...`);
    const surveyUrl = config.surveyUrl;

    console.log('[1/3] 正在启动浏览器...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        console.log(`[2/3] 正在导航至问卷并填写表单...`);
        await page.goto(surveyUrl, { waitUntil: 'networkidle', timeout: 60000 });

        // 存储之前的答案，用于条件依赖判断
        const previousAnswers = {};
        const conditionalRules = config.general?.conditionalRules || [];

        for (const q of config.questions) {
            const questionContainer = page.locator(`#div${q.id}`);
            
            switch (q.type) {
                case '单选题': {
                    const choice = intelligentSelect(q, previousAnswers, conditionalRules) || weightedRandomSelect(q.options);
                    previousAnswers[q.id] = choice; // 记录答案
                    await questionContainer.locator(`input[value="${choice}"] + a`).click({ force: true });
                    console.log(`    - Q${q.id} (${q.type}): 已选择选项 ${choice}`);
                    break;
                }
                case '多选题': {
                    const choices = intelligentSelect(q, previousAnswers, conditionalRules) || weightedRandomMultiSelect(q.options, q.minAnswers, q.maxAnswers);
                    previousAnswers[q.id] = choices; // 记录答案（数组）
                    for (const choice of choices) {
                        await questionContainer.locator(`input[value="${choice}"] + a`).click({ force: true });
                    }
                    console.log(`    - Q${q.id} (${q.type}): 已选择选项 ${choices.join(', ')}`);
                    break;
                }
                case '填空题':
                case '多行文本题': {
                    const text = q.wordBank[Math.floor(Math.random() * q.wordBank.length)];
                    await questionContainer.locator('input[type="text"], textarea').fill(text);
                    console.log(`    - Q${q.id} (${q.type}): 已填写 "${text}"`);
                    break;
                }
            }
            await page.waitForTimeout(Math.random() * 300 + 50);
        }

        console.log(`[3/3] 正在点击提交并处理可能的验证码...`);
        
        // 点击提交按钮
        await page.locator('#ctlNext').click();
        
        // 检测是否出现验证码
        let needsNavigation = true;
        try {
            console.log('    快速检查是否需要验证码...');
            const captchaVisible = await page.locator('#captchaOut').isVisible({ timeout: 1000 });
            
            if (captchaVisible) {
                console.log('    🔍 检测到验证码，点击验证按钮并等待自动提交...');
                
                // 点击验证码按钮，验证成功后会自动提交并跳转页面
                const captchaBtn = page.locator('#SM_BTN_1, .sm-btn');
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }),
                    captchaBtn.click()
                ]);
                console.log('    ✅ 验证码处理完成，页面已跳转');
                needsNavigation = false; // 已经跳转，不需要再等待
            }
        } catch (captchaError) {
            console.log('    ℹ️ 未检测到验证码或验证码处理超时，继续正常流程');
        }
        
        // 如果没有验证码或验证码处理失败，等待正常的页面跳转（限时1秒）
        if (needsNavigation) {
            console.log('    等待页面跳转完成（超时1秒）...');
            try {
                await page.waitForNavigation({ waitUntil: 'load', timeout: 1000 });
            } catch (navigationTimeout) {
                console.log('    ⚠️ 页面跳转超时1秒，放弃本次提交');
                return; // 直接返回，放弃本次提交
            }
        }
        
        const finalUrl = page.url();
        if (finalUrl.includes('finish.aspx') || finalUrl.includes('report.aspx') || finalUrl.includes('completemobile2.aspx')) {
            console.log('✅✅✅ 提交成功！✅✅✅');
            console.log(`已跳转至结果页面: ${finalUrl}`);
        } else {
            console.log('⚠️ 提交状态不明确或页面未按预期跳转');
            console.log(`当前页面: ${finalUrl}`);
        }
    } catch (error) {
         console.error(`\n❌ 在浏览器模拟执行期间发生错误: ${error.message}`);
    } finally {
        await browser.close();
        console.log('👋 浏览器已关闭。');
    }
}

/**
 * 主函数入口
 */
async function main() {
    try {
        await fs.access(CONFIG_FILENAME);
        const configRaw = await fs.readFile(CONFIG_FILENAME, 'utf-8');
        const config = JSON.parse(configRaw);
        const submissionCount = config.general?.submissionCount || 1;

        console.log(`\nℹ️ 配置文件加载成功，将对 ${config.surveyUrl} 执行 ${submissionCount} 次提交。`);

        for (let i = 1; i <= submissionCount; i++) {
            console.log(`\n================== [ 任务 ${i} / ${submissionCount} ] ==================`);
            await runSubmission(config); // 将配置传入
            if (i < submissionCount) {
                const delay = Math.random() * 1000+1000; // 2-4秒随机延迟
                console.log(`\n... ${(delay / 1000).toFixed(1)}秒后将开始下一次提交 ...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        console.log(`\n================== [ 所有任务已完成 ] ==================`);

    } catch (error) {
        if (error.code === 'ENOENT') {
            await generateConfig();
        } else {
            console.error(`\n❌ 发生未知错误: ${error.message}`);
        }
    }
}

main();

