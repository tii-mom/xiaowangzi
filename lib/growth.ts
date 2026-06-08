import crypto from 'node:crypto';
import { getDb, type DatabaseAdapter } from '@/lib/db';
import { ensureUserPrimaryAgentProfile } from '@/lib/agent-profile';

export interface GrowthGoal {
  id: number;
  user_id: number;
  agent_profile_id: number | null;
  title: string;
  change_target: string;
  anti_vision: string;
  minimum_viable_vision: string;
  daily_lever: string;
  status: string;
  source_share_artifact_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface GrowthDailyPractice {
  id: number;
  user_id: number;
  growth_goal_id: number;
  practice_date: string;
  day_number: number;
  daily_lever: string;
  status: string;
  streak_count: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrowthReflection {
  id: number;
  user_id: number;
  growth_goal_id: number;
  growth_daily_practice_id: number;
  completed_text: string;
  tacit_insight: string;
  next_adjustment: string;
  created_at: string;
}

export interface ShareArtifact {
  id: number;
  user_id: number;
  growth_goal_id: number;
  growth_daily_practice_id: number | null;
  slug: string;
  title: string;
  goal_theme: string;
  day_number: number;
  today_action: string;
  progress_note: string;
  public_summary: string;
  status: string;
  view_count: number;
  start_count: number;
  created_at: string;
  updated_at: string;
}

export interface GrowthToday {
  has_goal: boolean;
  goal: GrowthGoal | null;
  practice: GrowthDailyPractice | null;
  latest_reflection: GrowthReflection | null;
  streak_count: number;
  completed_days: number;
}

export interface CreateGrowthOnboardingParams {
  userId: number;
  changeTarget: string;
  antiVision: string;
  dailyLever: string;
  sourceShareSlug?: string | null;
}

export interface SubmitGrowthReflectionParams {
  userId: number;
  completedText: string;
  tacitInsight: string;
  nextAdjustment: string;
}

const TEXT_LIMIT = 240;

export async function createGrowthOnboarding(
  params: CreateGrowthOnboardingParams,
): Promise<GrowthToday> {
  const db = getDb();
  await ensureUserPrimaryAgentProfile(params.userId);
  const agentProfileId = await getPrimaryAgentProfileId(db, params.userId);
  const sourceShareArtifactId = params.sourceShareSlug
    ? await recordShareStart(db, params.sourceShareSlug)
    : null;

  const changeTarget = cleanText(params.changeTarget, TEXT_LIMIT);
  const antiVision = cleanText(params.antiVision, TEXT_LIMIT);
  const dailyLever = cleanText(params.dailyLever, TEXT_LIMIT);
  const title = buildGoalTitle(changeTarget);
  const minimumViableVision = `我先通过“${dailyLever}”证明改变已经开始。`;

  await db.execute(
    "UPDATE growth_goals SET status = 'archived', updated_at = datetime('now') WHERE user_id = ? AND status = 'active'",
    [params.userId],
  );

  const insertGoal = await db.execute(
    `INSERT INTO growth_goals
      (user_id, agent_profile_id, title, change_target, anti_vision,
       minimum_viable_vision, daily_lever, status, source_share_artifact_id,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))`,
    [
      params.userId,
      agentProfileId,
      title,
      changeTarget,
      antiVision,
      minimumViableVision,
      dailyLever,
      sourceShareArtifactId,
    ],
  );
  const goalId = insertGoal.meta?.last_row_id;
  if (!goalId) {
    throw new Error('成长目标创建失败');
  }

  const today = getShanghaiDateKey();
  await db.execute(
    `INSERT INTO growth_daily_practices
      (user_id, growth_goal_id, practice_date, day_number, daily_lever,
       status, streak_count, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, 'planned', 0, datetime('now'), datetime('now'))`,
    [params.userId, goalId, today, dailyLever],
  );

  await db.batch([
    {
      sql: `INSERT INTO agent_memories
            (user_id, agent_profile_id, memory_type, content, source, confidence, status, created_at, updated_at)
            VALUES (?, ?, 'goal', ?, 'growth_onboarding', 0.85, 'active', datetime('now'), datetime('now'))`,
      params: [
        params.userId,
        agentProfileId,
        `当前成长目标：${title}；今日微行动：${dailyLever}`,
      ],
    },
    {
      sql: `INSERT INTO agent_learning_events
            (user_id, agent_profile_id, event_type, payload_json, created_at)
            VALUES (?, ?, 'growth.onboarding_created', ?, datetime('now'))`,
      params: [
        params.userId,
        agentProfileId,
        JSON.stringify({ growth_goal_id: goalId, source_share_artifact_id: sourceShareArtifactId }),
      ],
    },
  ]);

  return getGrowthToday(params.userId);
}

export async function getGrowthToday(userId: number): Promise<GrowthToday> {
  const db = getDb();
  const goal = await getActiveGrowthGoal(db, userId);
  if (!goal) {
    return {
      has_goal: false,
      goal: null,
      practice: null,
      latest_reflection: null,
      streak_count: 0,
      completed_days: 0,
    };
  }

  const practice = await ensureTodayPractice(db, goal);
  const reflections = await getGoalReflections(db, goal.id);
  const latestReflection = reflections.at(-1) ?? null;
  const practices = await getGoalPractices(db, goal.id);
  const completedDays = practices.filter((item) => item.status === 'completed').length;
  const streakCount = computeStreak(practices);

  return {
    has_goal: true,
    goal,
    practice,
    latest_reflection: latestReflection,
    streak_count: Math.max(streakCount, practice.streak_count ?? 0),
    completed_days: completedDays,
  };
}

export async function submitGrowthReflection(
  params: SubmitGrowthReflectionParams,
): Promise<GrowthToday> {
  const db = getDb();
  await ensureUserPrimaryAgentProfile(params.userId);
  const agentProfileId = await getPrimaryAgentProfileId(db, params.userId);
  const goal = await getActiveGrowthGoal(db, params.userId);
  if (!goal) {
    throw new Error('请先生成你的 Z-27 进化地图');
  }

  const practice = await ensureTodayPractice(db, goal);
  const completedText = cleanText(params.completedText, TEXT_LIMIT);
  const tacitInsight = cleanText(params.tacitInsight, TEXT_LIMIT);
  const nextAdjustment = cleanText(params.nextAdjustment, TEXT_LIMIT);

  await db.execute(
    `INSERT INTO growth_reflections
      (user_id, growth_goal_id, growth_daily_practice_id, completed_text,
       tacit_insight, next_adjustment, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [params.userId, goal.id, practice.id, completedText, tacitInsight, nextAdjustment],
  );

  const practicesBeforeUpdate = await getGoalPractices(db, goal.id);
  const nextPractices = practicesBeforeUpdate.map((item) =>
    item.id === practice.id
      ? { ...item, status: 'completed', practice_date: practice.practice_date }
      : item,
  );
  const streakCount = computeStreak(nextPractices);

  await db.execute(
    `UPDATE growth_daily_practices
     SET status = 'completed',
         streak_count = ?,
         completed_at = datetime('now'),
         updated_at = datetime('now')
     WHERE id = ?`,
    [streakCount, practice.id],
  );

  await db.batch([
    {
      sql: `INSERT INTO agent_memories
            (user_id, agent_profile_id, memory_type, content, source, confidence, status, created_at, updated_at)
            VALUES (?, ?, 'summary', ?, 'growth_reflection', 0.78, 'active', datetime('now'), datetime('now'))`,
      params: [
        params.userId,
        agentProfileId,
        `成长复盘：${completedText}；默会洞察：${tacitInsight}；下一步：${nextAdjustment}`,
      ],
    },
    {
      sql: `INSERT INTO agent_learning_events
            (user_id, agent_profile_id, event_type, payload_json, created_at)
            VALUES (?, ?, 'growth.reflection_captured', ?, datetime('now'))`,
      params: [
        params.userId,
        agentProfileId,
        JSON.stringify({
          growth_goal_id: goal.id,
          growth_daily_practice_id: practice.id,
          streak_count: streakCount,
        }),
      ],
    },
  ]);

  await maybeCreateGrowthSnapshot(db, goal.id, params.userId);
  return getGrowthToday(params.userId);
}

export async function createGrowthShareArtifact(params: {
  userId: number;
  progressNote?: string | null;
}): Promise<ShareArtifact> {
  const db = getDb();
  const today = await getGrowthToday(params.userId);
  if (!today.goal || !today.practice) {
    throw new Error('请先生成你的 Z-27 进化地图');
  }

  const progressNote = cleanPublicText(
    params.progressNote || today.latest_reflection?.tacit_insight || '我正在用一个微行动改变轨迹。',
    96,
  );
  const slug = generateShareSlug();
  const goalTheme = cleanPublicText(today.goal.title, 36);
  const todayAction = cleanPublicText(today.practice.daily_lever, 96);
  const publicSummary = `第 ${today.practice.day_number} 天，我在 Z-27 练习：${todayAction}`;

  const insert = await db.execute(
    `INSERT INTO share_artifacts
      (user_id, growth_goal_id, growth_daily_practice_id, slug, title,
       goal_theme, day_number, today_action, progress_note, public_summary,
       status, view_count, start_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, 0, datetime('now'), datetime('now'))`,
    [
      params.userId,
      today.goal.id,
      today.practice.id,
      slug,
      `Z-27 进化地图 · 第 ${today.practice.day_number} 天`,
      goalTheme,
      today.practice.day_number,
      todayAction,
      progressNote,
      publicSummary,
    ],
  );
  const id = insert.meta?.last_row_id;
  if (!id) {
    throw new Error('分享卡创建失败');
  }

  const rows = await db.query<ShareArtifact>(
    'SELECT * FROM share_artifacts WHERE id = ? LIMIT 1',
    [id],
  );
  return rows.results[0];
}

export async function getPublicShareArtifact(
  slug: string,
  options: { incrementView?: boolean } = {},
): Promise<ShareArtifact | null> {
  const db = getDb();
  const rows = await db.query<ShareArtifact>(
    "SELECT * FROM share_artifacts WHERE slug = ? AND status = 'active' LIMIT 1",
    [slug],
  );
  const artifact = rows.results[0] ?? null;
  if (!artifact) return null;

  if (options.incrementView) {
    await db.execute(
      "UPDATE share_artifacts SET view_count = view_count + 1, updated_at = datetime('now') WHERE id = ?",
      [artifact.id],
    ).catch(() => {});
  }
  return artifact;
}

export async function formatGrowthContextForPrompt(userId: number): Promise<string> {
  const db = getDb();
  const goal = await getActiveGrowthGoal(db, userId);
  if (!goal) {
    return `[成长旅程]
- 暂无 active growth goal。
- 不要编造用户目标；普通事实问题仍然直接回答。`;
  }

  const practices = await getGoalPractices(db, goal.id);
  const reflections = await getGoalReflections(db, goal.id);
  const latestPractice = practices.at(-1) ?? null;
  const latestReflection = reflections.at(-1) ?? null;

  return `[成长旅程]
- 当前目标：${goal.title}
- 想改变的事：${goal.change_target}
- 反愿景：${goal.anti_vision}
- 最小可行愿景：${goal.minimum_viable_vision}
- 今日/最近微行动：${latestPractice?.daily_lever ?? goal.daily_lever}
- 最近复盘：${latestReflection ? `${latestReflection.tacit_insight}；下一步：${latestReflection.next_adjustment}` : '暂无'}

使用规则：只有当用户谈到目标、成长、拖延、复盘、行动时才主动引用；普通事实问题不要强行成长化。`;
}

async function getPrimaryAgentProfileId(db: DatabaseAdapter, userId: number): Promise<number | null> {
  const profileRows = await db.query<{ id: number }>(
    "SELECT id FROM agent_profiles WHERE user_id = ? AND is_primary = 1 AND status = 'active' LIMIT 1",
    [userId],
  );
  return profileRows.results[0]?.id ?? null;
}

async function getActiveGrowthGoal(db: DatabaseAdapter, userId: number): Promise<GrowthGoal | null> {
  const rows = await db.query<GrowthGoal>(
    "SELECT * FROM growth_goals WHERE user_id = ? AND status = 'active' LIMIT 1",
    [userId],
  );
  return rows.results[0] ?? null;
}

async function ensureTodayPractice(
  db: DatabaseAdapter,
  goal: GrowthGoal,
): Promise<GrowthDailyPractice> {
  const today = getShanghaiDateKey();
  const existingRows = await db.query<GrowthDailyPractice>(
    'SELECT * FROM growth_daily_practices WHERE growth_goal_id = ? AND practice_date = ? LIMIT 1',
    [goal.id, today],
  );
  const existing = existingRows.results[0];
  if (existing) return existing;

  const practices = await getGoalPractices(db, goal.id);
  const dayNumber = practices.length + 1;
  const insert = await db.execute(
    `INSERT INTO growth_daily_practices
      (user_id, growth_goal_id, practice_date, day_number, daily_lever,
       status, streak_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'planned', 0, datetime('now'), datetime('now'))`,
    [goal.user_id, goal.id, today, dayNumber, goal.daily_lever],
  );
  const id = insert.meta?.last_row_id;
  const rows = await db.query<GrowthDailyPractice>(
    'SELECT * FROM growth_daily_practices WHERE id = ? LIMIT 1',
    [id],
  );
  return rows.results[0];
}

async function getGoalPractices(
  db: DatabaseAdapter,
  growthGoalId: number,
): Promise<GrowthDailyPractice[]> {
  const rows = await db.query<GrowthDailyPractice>(
    'SELECT * FROM growth_daily_practices WHERE growth_goal_id = ?',
    [growthGoalId],
  );
  return rows.results.sort((a, b) => a.practice_date.localeCompare(b.practice_date));
}

async function getGoalReflections(
  db: DatabaseAdapter,
  growthGoalId: number,
): Promise<GrowthReflection[]> {
  const rows = await db.query<GrowthReflection>(
    'SELECT * FROM growth_reflections WHERE growth_goal_id = ?',
    [growthGoalId],
  );
  return rows.results.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.id - b.id);
}

async function maybeCreateGrowthSnapshot(
  db: DatabaseAdapter,
  growthGoalId: number,
  userId: number,
): Promise<void> {
  const practices = await getGoalPractices(db, growthGoalId);
  const completed = practices.filter((item) => item.status === 'completed');
  const completedDays = completed.length;
  const interval = completedDays > 0 && completedDays % 30 === 0
    ? 30
    : completedDays > 0 && completedDays % 7 === 0
      ? 7
      : null;
  if (!interval) return;

  const existing = await db.query(
    'SELECT id FROM growth_snapshots WHERE growth_goal_id = ? AND interval_days = ? AND completed_days = ? LIMIT 1',
    [growthGoalId, interval, completedDays],
  );
  if (existing.results.length > 0) return;

  const reflections = await getGoalReflections(db, growthGoalId);
  const latest = reflections.at(-1);
  const summary = latest
    ? `${interval}日进化摘要：你通过持续行动看见了“${latest.tacit_insight}”，下一步是“${latest.next_adjustment}”。`
    : `${interval}日进化摘要：你完成了 ${completedDays} 天微行动。`;

  await db.execute(
    `INSERT INTO growth_snapshots
      (user_id, growth_goal_id, interval_days, completed_days, summary, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [userId, growthGoalId, interval, completedDays, summary],
  );
}

async function recordShareStart(
  db: DatabaseAdapter,
  slug: string,
): Promise<number | null> {
  const cleanSlug = cleanText(slug, 80);
  const rows = await db.query<{ id: number }>(
    "SELECT id FROM share_artifacts WHERE slug = ? AND status = 'active' LIMIT 1",
    [cleanSlug],
  );
  const id = rows.results[0]?.id ?? null;
  if (!id) return null;

  await db.execute(
    "UPDATE share_artifacts SET start_count = start_count + 1, updated_at = datetime('now') WHERE id = ?",
    [id],
  ).catch(() => {});
  return id;
}

function computeStreak(practices: GrowthDailyPractice[]): number {
  const completedDates = new Set(
    practices
      .filter((item) => item.status === 'completed')
      .map((item) => item.practice_date),
  );
  let streak = 0;
  let cursor = parseDateKey(getShanghaiDateKey());
  while (completedDates.has(formatDateKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function buildGoalTitle(changeTarget: string): string {
  const compact = cleanText(changeTarget, 32)
    .replace(/[。！？!?；;，,].*$/u, '')
    .trim();
  return compact || '我的 Z-27 进化地图';
}

function generateShareSlug(): string {
  return `z27-${crypto.randomBytes(6).toString('hex')}`;
}

function cleanText(text: string, maxLength: number): string {
  return text
    .replace(/<[^>]*>/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanPublicText(text: string, maxLength: number): string {
  return cleanText(text, maxLength)
    .replace(/wxid[_a-zA-Z0-9-]+/gu, '[微信标识已隐藏]')
    .replace(/\b(?:wxz|order|user|uid)_[a-z0-9_-]+\b/giu, '[标识已隐藏]')
    .replace(/\b\d{6,}\b/gu, '******')
    .slice(0, maxLength);
}

function getShanghaiDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map((part) => parseInt(part, 10));
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
