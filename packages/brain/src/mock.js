/**
 * @file mock.js
 * 没有 LLM API key 时的伪响应，让 demo 永远能跑。
 *
 * 设计思路：根据 prompt 关键字猜测正在调用的子能力，给出一个看起来像样的 JSON 响应。
 * 这不是真 AI，但能让 GitHub 浏览者点开 `npm run demo:mock` 立刻看到完整流程。
 */

/**
 * @param {{system?: string, user: string, json?: boolean}} opts
 * @returns {Promise<string>}
 */
export async function mockChat(opts) {
  const text = (opts.user || '') + (opts.system || '');
  await sleep(120);

  // === 假设列举 ===
  if (text.includes('列出 2-3 个最可能的根本原因')) {
    return JSON.stringify({
      hypotheses: [
        '主推款搜索排名跌出首页（流量来源变化）',
        '类目大盘周末/天气性下滑，是行业普遍现象',
        '免费流量被竞品活动抢量（同行办活动）',
      ],
    });
  }

  // === RAG rerank ===
  if (text.includes('挑出与当前店铺症状最相关的 3 条')) {
    // 简单地取前 3 个 ID
    const ids = [...text.matchAll(/\[(P-\d+)\]/g)].slice(0, 3).map(m => m[1]);
    return JSON.stringify({
      picks: ids,
      reasoning: '这 3 条经验都直接对应当前店铺出现的"流量降"+"转化率降"的复合症状',
    });
  }

  // === 根因结论 ===
  if (text.includes('综合给出结论')) {
    return JSON.stringify({
      rootCause: '昨晚搜索权重重排，主推款"心相印纸巾"从首页第 8 位掉到第 23 位，免费流量入口收窄是流量降 63% 的主因',
      evidence: [
        '访客 452 → 166（-63%），降幅远超同行平均',
        '免费 IPV 低于同行 71%（平台预警明确指出）',
        '转化率反而提升（6.86% → 12.65%），说明来店的都是精准买家 → 不是被拉黑',
      ],
      actions: [
        { title: '今天 18:00 前在万相台速投关键词推广，预算 50 元先补流量', why: '免费流量短期回不来，付费补流稳住单量', kbRef: 'P-003' },
        { title: '检查主推款"心相印纸巾"主图和价格是否有非自然变化', why: '排序下降前后通常伴随商品异动', kbRef: 'P-014' },
        { title: '处理那 17 单待发货，避免揽收超时被再次降权', why: '体验分若再掉，连付费流量都会被限制', kbRef: 'P-027' },
      ],
    });
  }

  // === 日报 ===
  if (text.includes('请输出 JSON') && text.includes('headline')) {
    return JSON.stringify({
      headline: '12 位买家对你说了"不"',
      oneLiner: '主人，今天访客掉了 63%，但来的人更精准，咱们抓 3 件事就能稳住。',
      insights: [
        '访客从 452 降到 166（−63%）',
        '转化率反而从 6.86% 涨到 12.65%',
        '物流到货时长 58.81 小时，离扣分线很近',
      ],
      todos: [
        { title: '万相台速投关键词，预算 50 元', why: '免费流量短期回不来，付费先稳住', impact: '预计补回 80-120 个访客' },
        { title: '检查"心相印纸巾"是否被搜索降权', why: '主推款排序下降是流量降的最大嫌疑', impact: '排序恢复可救回 30%+ 自然流量' },
        { title: '把 17 单待发货今天 17:00 前清掉', why: '揽收超时会再降一次权', impact: '保住体验分 0.05 分以上' },
      ],
      catLine: '主人，别慌喵～ 3 件事干完今天就好了。',
    });
  }

  // === 兜底：persona 单聊 ===
  return JSON.stringify({
    catLine: '主人，喵～ 我正在巡店，发现了几件事，要不要听？',
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
