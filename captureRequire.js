const { chromium } = require('playwright');

const fs = require('fs').promises;
const CONFIG_FILENAME = 'config.json';
const CAPTURE_OUTPUT = 'captured_request.json';

// ==================== 配置区域 ====================
// 优先从 config.json 读取 surveyUrl
let SURVEY_URL_TO_CAPTURE = '';
// ===============================================

async function ensureSurveyUrl() {
    try {
        const raw = await fs.readFile(CONFIG_FILENAME, 'utf-8');
        const cfg = JSON.parse(raw);
        SURVEY_URL_TO_CAPTURE = cfg.surveyUrl || '';
        if (!SURVEY_URL_TO_CAPTURE) throw new Error('config.json 中未配置 surveyUrl');
    } catch (err) {
        console.error('❌ 无法读取 config.json 获取 surveyUrl:', err.message);
        process.exit(1);
    }
}

async function captureSubmitRequest() {
    console.log('🚀 正在启动浏览器，请稍候...');
    
    // 启动一个带界面的浏览器实例 (headless: false)
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('👂 脚本正在智能监听网络请求...');

    try {
        // 创建一个Promise，它将在请求被捕获时被resolve
    const requestCapturedPromise = new Promise((resolve) => {
            page.on('request', async (request) => {
                // 首先，只处理POST请求
                if (request.method() !== 'POST') {
                    return;
                }
                
                const postData = request.postData();

                // *** 关键修改点 ***
                // 检查POST数据中是否包含 'submitdata=' 这个关键字段
                // 这是判断是否为问卷提交请求的更可靠方法
                if (postData && postData.includes('submitdata=')) {
                    
                    console.log('\n\n============================================================');
                    console.log('          🎯🎯🎯 已成功捕获提交请求！🎯🎯🎯');
                    console.log('============================================================');
                    console.log('请将以下【所有内容】完整复制给我，以便生成最终的自动提交脚本。\n');

                    // 1. 捕获并保存请求样例到文件，供 autoSubmit 使用
                    const captured = {
                        url: request.url(),
                        headers: await request.headers(),
                        rawPostData: postData
                    };
                    await fs.writeFile(CAPTURE_OUTPUT, JSON.stringify(captured, null, 2));
                    console.log(`\n✅ 已将捕获到的提交请求保存为 ${CAPTURE_OUTPUT}`);
                    console.log('\n');
                    
                    console.log('============================================================');
                    console.log('                  ✅ 捕获完成 ✅');
                    console.log('============================================================\n');
                    
                    // Resolve Promise，表示捕获成功，脚本可以继续执行
                    resolve();
                } else {
                    // (可选) 打印其他POST请求以供调试
                    console.log(`[调试信息] 捕获到一个非目标的POST请求: ${request.url()}`);
                }
            });
        });

    // 导航到指定的问卷页面
    await page.goto(SURVEY_URL_TO_CAPTURE);
        console.log(`\n✅ 浏览器已打开并导航至问卷页面。`);
        console.log('👉 请您在该浏览器窗口中【手动填写并提交一次问卷】。');
        console.log('👉 提交后，请求数据将自动显示在此终端中，然后浏览器会自动关闭。\n');

    // 等待捕获Promise完成，这里会无限期等待，不会超时
    await requestCapturedPromise;

    } catch (error) {
        // 这个错误通常在用户提前手动关闭浏览器时触发
        if (error.message.includes('Target page, context or browser has been closed')) {
            console.log('\nℹ️ 浏览器被手动关闭，脚本已停止。');
        } else {
            console.error('❌ 发生错误:', error.message);
        }
    } finally {
        // 确保无论成功还是失败，只要浏览器还连接着，就关闭它
        if (browser.isConnected()) {
            await browser.close();
            console.log('👋 浏览器已自动关闭，脚本退出。');
        }
    }
}

// 主流程
(async () => {
    await ensureSurveyUrl();
    await captureSubmitRequest();
})();

