/**
 * 生产环境 D1 数据库只读巡检脚本 (check-production-d1-readonly.ts)
 * 
 * 运行方法:
 * D1_DATABASE=xiaowangzi-production npx tsx scripts/check-production-d1-readonly.ts
 */

import { execSync } from 'node:child_process';

const D1_DATABASE = process.env.D1_DATABASE ?? 'xiaowangzi-production';
const WRANGLER_ENV = process.env.WRANGLER_ENV ?? 'production';

function d1Execute(sql: string): any {
  const envFlag = WRANGLER_ENV ? `--env ${WRANGLER_ENV}` : '';
  const cmd = `npx wrangler d1 execute ${D1_DATABASE} --remote ${envFlag} --json --command "${sql.replace(/"/g, '\\"')}"`;
  
  try {
    const stdout = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const data = JSON.parse(stdout);
    return data[0];
  } catch (error) {
    console.error(`❌ 执行 D1 命令失败:`, (error as Error).message);
    process.exit(1);
  }
}

async function main() {
  console.log(`=== 生产 D1 数据库只读巡检 (目标数据库: ${D1_DATABASE}, 环境: ${WRANGLER_ENV}) ===\n`);

  // 1. 最近 20 笔 payment_orders
  console.log('--- 1. 最近 20 笔支付订单 (payment_orders) ---');
  const ordersQuery = `SELECT user_id, order_id, plan, tokens_amount, amount_cents, pay_type, status, created_at FROM payment_orders ORDER BY created_at DESC LIMIT 20;`;
  const ordersResult = d1Execute(ordersQuery);
  if (ordersResult?.results && ordersResult.results.length > 0) {
    console.table(ordersResult.results);
  } else {
    console.log('暂无订单数据\n');
  }

  // 2. pending 超过 10 分钟的订单数量
  console.log('--- 2. 挂起 (pending) 超过 10 分钟的订单数量 ---');
  // SQLite 使用 UTC 时间，检查 datetime('now', '-10 minutes')
  const pendingQuery = `SELECT COUNT(*) as count FROM payment_orders WHERE status = 'pending' AND created_at < datetime('now', '-10 minutes');`;
  const pendingResult = d1Execute(pendingQuery);
  const pendingCount = pendingResult?.results?.[0]?.count ?? 0;
  console.log(`超过 10 分钟仍处于 pending 的订单数: ${pendingCount}\n`);

  // 3. token_ledger 与 users.token_balance 是否存在明显不一致
  console.log('--- 3. 账本一致性校对 (token_ledger vs users.token_balance) ---');
  const auditQuery = `
    SELECT 
      u.id, 
      u.nickname, 
      u.token_balance, 
      COALESCE(SUM(l.delta_tokens), 0) as ledger_sum 
    FROM users u 
    LEFT JOIN token_ledger l ON u.id = l.user_id 
    GROUP BY u.id 
    HAVING u.token_balance != ledger_sum;
  `;
  const auditResult = d1Execute(auditQuery);
  if (auditResult?.results && auditResult.results.length > 0) {
    console.error('⚠️  警告: 发现账本不一致的用户！');
    console.table(auditResult.results);
  } else {
    console.log('✅ 账本校验一致：所有用户的余额与 Token 账本流水总和完全对齐。\n');
  }

  // 4. 最近 system_events 是否有 payment / webhook / error 相关异常
  console.log('--- 4. 最近支付、Webhook 或错误相关系统日志 (system_events) ---');
  const eventsQuery = `
    SELECT id, type, created_at 
    FROM system_events 
    WHERE type LIKE '%payment%' OR type LIKE '%webhook%' OR type LIKE '%error%' 
    ORDER BY created_at DESC 
    LIMIT 20;
  `;
  const eventsResult = d1Execute(eventsQuery);
  if (eventsResult?.results && eventsResult.results.length > 0) {
    console.table(eventsResult.results);
  } else {
    console.log('暂无相关系统日志\n');
  }

  // 5. admin_audit_logs 最近记录
  console.log('--- 5. 最近管理员操作审计日志 (admin_audit_logs) ---');
  const auditLogsQuery = `
    SELECT id, admin_email, action, target_type, target_id, created_at 
    FROM admin_audit_logs 
    ORDER BY created_at DESC 
    LIMIT 10;
  `;
  const auditLogsResult = d1Execute(auditLogsQuery);
  if (auditLogsResult?.results && auditLogsResult.results.length > 0) {
    console.table(auditLogsResult.results);
  } else {
    console.log('暂无管理员审计日志\n');
  }

  // 6. active subscriptions 数量
  console.log('--- 6. 激活的订阅数量 (active subscriptions) ---');
  const subQuery = `SELECT plan, COUNT(*) as count FROM subscriptions WHERE status = 'active' GROUP BY plan;`;
  const subResult = d1Execute(subQuery);
  if (subResult?.results && subResult.results.length > 0) {
    console.table(subResult.results);
  } else {
    console.log('暂无活动订阅\n');
  }

  console.log('=== 巡检脚本执行完毕 ===');
}

main().catch((e) => {
  console.error('D1 巡检发生异常:', e);
  process.exit(1);
});
