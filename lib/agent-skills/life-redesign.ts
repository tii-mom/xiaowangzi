export const LIFE_REDESIGN_SKILL_TITLE = 'Life Redesign Skill';

export const LIFE_REDESIGN_SKILL_PROMPT = `[默认核心 Skill: Life Redesign Skill]
用途：当用户提到迷茫、痛苦、人生方向、自律、拖延、改变、重启生活、目标失焦时，优先调用本技能。
来源边界：这是内部方法论提炼，不能复述来源文章原文，不能对用户宣称自己是任何现实作者本人。

核心判断：
- 不先灌鸡汤，先指出当前卡点：旧身份、旧环境、旧回报机制正在保护旧生活。
- 回答要直接、清醒、行动导向；先给一句判断，再给最多 3 个行动点。
- 用户只问普通事实问题时，不调用本技能。

四层时间框架：
1. 1 天：做心理挖掘，写出反愿景，压缩出最小可行愿景，并在当天完成一个小行动。
2. 1 周：连续 7 天中断旧模式，每天复盘一次，固定 2-3 个 daily levers。
3. 1 个月：选择一个可见月度项目，围绕技能、作品、健康或关系产生可交付进展。
4. 1 年：定义新身份、北极星目标、约束条件和季度检查，用反馈持续迭代。

执行工具：
- 反愿景：让用户看见如果继续原样生活，1 年后会变成什么样。
- 最小可行愿景：只写下一种更清醒、更可执行的生活版本。
- Daily levers：每天能推动整个系统的 2-3 个杠杆动作。
- 反馈迭代：每晚问“今天哪个动作真的改变了轨迹？”`;

const LIFE_REDESIGN_TRIGGERS = [
  /迷茫/u,
  /痛苦/u,
  /人生.*方向/u,
  /方向.*人生/u,
  /自律/u,
  /拖延/u,
  /改变/u,
  /重启/u,
  /重构/u,
  /目标/u,
  /没有动力/u,
  /坚持不下/u,
  /摆烂/u,
  /焦虑.*未来/u,
];

export function shouldUseLifeRedesignSkill(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return LIFE_REDESIGN_TRIGGERS.some((pattern) => pattern.test(text));
}

export function formatLifeRedesignSkillForPrompt(): string {
  return LIFE_REDESIGN_SKILL_PROMPT;
}

export function formatLifeRedesignRuntimeHint(message: string): string {
  if (!shouldUseLifeRedesignSkill(message)) {
    return `[Life Redesign 调用]
- 本轮未触发；不要把普通事实问题强行改造成成长建议。`;
  }

  return `[Life Redesign 调用]
- 本轮已触发：用户的问题适合用 Life Redesign Skill。
- 回复顺序：一句清醒判断 -> 最多 3 个行动点。
- 如果用户问“怎么办/如何改变/如何不拖延”，优先给 1 天、1 周、1 个月、1 年框架。
- 如果内容超过 100 字，使用短标题、空行和编号分段。`;
}

export function buildLifeRedesignGuidance(message: string): string | null {
  if (!shouldUseLifeRedesignSkill(message)) return null;

  return [
    '先别急着追求更强的自律，你要先换掉正在保护旧生活的身份。',
    '',
    '1. 今天：写下反愿景，再写一个最小可行愿景，马上做一个 20 分钟行动。',
    '2. 这一周：固定 2-3 个 daily levers，每晚复盘哪个动作真的改变了轨迹。',
    '3. 这个月：只选一个月度项目，让技能、作品、健康或关系产生可见进展。',
    '4. 这一年：定义新身份、北极星目标和约束，每季度根据反馈迭代。',
  ].join('\n');
}
