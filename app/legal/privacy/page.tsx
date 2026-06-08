import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6 text-sm leading-relaxed text-slate-300">
        <h1 className="text-2xl font-bold text-white">隐私政策</h1>
        <p className="text-slate-500 text-xs">最后更新：2026年6月</p>

        <h2 className="text-lg font-bold text-white mt-6">1. 信息收集</h2>
        <p>小王子 SoulMate 收集以下信息以提供服务：</p>
        <ul className="list-disc pl-5 space-y-1 text-slate-400">
          <li>对话内容（用于生成 AI 回复和长期陪伴记忆）</li>
          <li>Token 使用记录（用于计费和余额管理）</li>
          <li>微信绑定标识（如用户选择绑定微信）</li>
          <li>支付订单记录（如用户选择充值）</li>
        </ul>

        <h2 className="text-lg font-bold text-white mt-6">2. 信息使用</h2>
        <p>收集的信息仅用于：</p>
        <ul className="list-disc pl-5 space-y-1 text-slate-400">
          <li>提供 AI 对话陪伴服务</li>
          <li>Token 计费和余额管理</li>
          <li>服务改进和体验优化</li>
        </ul>

        <h2 className="text-lg font-bold text-white mt-6">3. 信息存储</h2>
        <p>数据存储在 Cloudflare D1 数据库中。我们采取合理的安全措施保护您的信息。</p>

        <h2 className="text-lg font-bold text-white mt-6">4. 信息共享</h2>
        <p>我们不会将您的个人信息出售或分享给第三方，除非：</p>
        <ul className="list-disc pl-5 space-y-1 text-slate-400">
          <li>获得您的明确同意</li>
          <li>法律法规要求</li>
        </ul>

        <h2 className="text-lg font-bold text-white mt-6">5. 您的权利</h2>
        <p>您可以随时请求删除您的账户和所有关联数据。联系邮箱：yudeyou0118@gmail.com</p>

        <h2 className="text-lg font-bold text-white mt-6">6. AI 对话说明</h2>
        <p>小王子 SoulMate 由 AI 模型驱动，对话内容由 AI 生成。我们不保证 AI 回复的准确性，也不以此提供医疗或心理治疗建议。</p>

        <div className="pt-8 text-center">
          <Link href="/" className="text-xs text-slate-500 hover:text-amber-400 underline">← 返回首页</Link>
        </div>
      </div>
    </div>
  );
}
