import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6 text-sm leading-relaxed text-slate-300">
        <h1 className="text-2xl font-bold text-white">用户服务协议</h1>
        <p className="text-slate-500 text-xs">最后更新：2026年6月</p>

        <h2 className="text-lg font-bold text-white mt-6">1. 服务说明</h2>
        <p>小王子 SoulMate 是一款基于 AI 的情感陪伴服务，通过对话为用户提供日常陪伴和情绪支持。本服务不是医疗或心理治疗工具。</p>

        <h2 className="text-lg font-bold text-white mt-6">2. 用户责任</h2>
        <ul className="list-disc pl-5 space-y-1 text-slate-400">
          <li>用户需自行判断 AI 回复的适用性</li>
          <li>不得利用本服务进行违法活动</li>
          <li>不得滥用或攻击本服务系统</li>
        </ul>

        <h2 className="text-lg font-bold text-white mt-6">3. Token 与付费</h2>
        <p>对话消耗 Token。免费体验额度用完后，需购买 Token 套餐继续使用。所有支付通过 BufPay 处理。Token 不可提现、不可转让。</p>

        <h2 className="text-lg font-bold text-white mt-6">4. 服务可用性</h2>
        <p>我们尽力保证服务稳定运行，但不承诺 100% 可用。系统维护、第三方服务中断等情况可能导致服务暂时不可用。</p>

        <h2 className="text-lg font-bold text-white mt-6">5. 安全边界</h2>
        <p>如您处于严重的心理危机（自伤、自杀倾向等），请立即联系现实中的可信亲友或拨打当地心理援助热线。本服务不能替代专业危机干预。</p>

        <h2 className="text-lg font-bold text-white mt-6">6. 协议变更</h2>
        <p>我们可能更新本协议。重大变更将通过服务公告通知。</p>

        <h2 className="text-lg font-bold text-white mt-6">7. 联系方式</h2>
        <p>如有问题，请联系：yudeyou0118@gmail.com</p>

        <div className="pt-8 text-center">
          <Link href="/" className="text-xs text-slate-500 hover:text-amber-400 underline">← 返回首页</Link>
        </div>
      </div>
    </div>
  );
}
