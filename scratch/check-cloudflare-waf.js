const fs = require('fs');
const path = require('path');

// Load variables from .dev.vars
const devVarsPath = path.resolve(process.cwd(), '.dev.vars');
let apiToken = '';
let accountId = '';
if (fs.existsSync(devVarsPath)) {
  const content = fs.readFileSync(devVarsPath, 'utf8');
  for (const line of content.split('\n')) {
    const tokenMatch = line.match(/^\s*CLOUDFLARE_API_TOKEN\s*=\s*(.*)?\s*$/);
    if (tokenMatch) apiToken = tokenMatch[1].trim().replace(/^"|"$/g, '');
    const accMatch = line.match(/^\s*CLOUDFLARE_ACCOUNT_ID\s*=\s*(.*)?\s*$/);
    if (accMatch) accountId = accMatch[1].trim().replace(/^"|"$/g, '');
  }
}

if (!apiToken) {
  console.error('CLOUDFLARE_API_TOKEN not found in .dev.vars');
  process.exit(1);
}

async function cfRequest(endpoint, options = {}) {
  const url = `https://api.cloudflare.com/client/v4${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
    ...options.headers
  };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json();
  return data;
}

async function main() {
  console.log('=== Checking Cloudflare Zones and WAF rules ===');
  
  // 1. Get Zones
  const zonesResult = await cfRequest('/zones');
  if (!zonesResult.success) {
    console.error('Failed to get zones:', zonesResult.errors);
    process.exit(1);
  }
  
  const zones = zonesResult.result || [];
  console.log(`Found ${zones.length} zone(s):`);
  for (const z of zones) {
    console.log(`- Zone: ${z.name} | ID: ${z.id} | Status: ${z.status}`);
  }
  
  const wanLatZone = zones.find(z => z.name === 'wan.lat');
  if (!wanLatZone) {
    console.error('Zone wan.lat not found in account.');
    process.exit(1);
  }
  
  const zoneId = wanLatZone.id;
  
  // 2. Get Rulesets for Zone
  const rulesetsResult = await cfRequest(`/zones/${zoneId}/rulesets`);
  if (!rulesetsResult.success) {
    console.error('Failed to get rulesets:', rulesetsResult.errors);
    process.exit(1);
  }
  
  console.log('\nRulesets:');
  const rulesets = rulesetsResult.result || [];
  for (const rs of rulesets) {
    console.log(`- Ruleset ID: ${rs.id} | Phase: ${rs.phase} | Name: ${rs.name}`);
    if (rs.phase === 'http_request_firewall_custom' || rs.phase === 'http_request_late_transform') {
      // Get detailed ruleset
      const details = await cfRequest(`/zones/${zoneId}/rulesets/${rs.id}`);
      if (details.success && details.result.rules) {
        for (const rule of details.result.rules) {
          console.log(`  * Rule [${rule.action}]: ${rule.description || 'no desc'}`);
          console.log(`    Expression: ${rule.expression}`);
          if (rule.action_parameters) {
            console.log(`    Parameters: ${JSON.stringify(rule.action_parameters)}`);
          }
        }
      }
    }
  }

  // 3. Check Custom Rules (WAF Rules) directly via WAF API
  const wafResult = await cfRequest(`/zones/${zoneId}/firewall/rules`);
  if (wafResult.success) {
    console.log('\nFirewall Rules (deprecated format/classic):');
    for (const rule of (wafResult.result || [])) {
      console.log(`- ID: ${rule.id} | Action: ${rule.action} | Paused: ${rule.paused} | Description: ${rule.description}`);
      console.log(`  Filter ID: ${rule.filter.id} | Expression: ${rule.filter.expression}`);
    }
  }

  // 4. Check Bot Fight Mode Settings
  console.log('\nChecking Bot Fight Mode:');
  const bfm = await cfRequest(`/zones/${zoneId}/settings/bot_fight_mode`);
  console.log('Bot Fight Mode Setting:', bfm);

  const bm = await cfRequest(`/zones/${zoneId}/botmanagement`);
  console.log('Bot Management Setting:', bm);
}

main().catch(console.error);
