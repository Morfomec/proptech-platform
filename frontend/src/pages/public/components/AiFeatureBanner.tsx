import React, { useState } from 'react'

export const AiFeatureBanner: React.FC = () => {
  const [copied, setCopied] = useState(false)

  const sampleCopy =
    'Experience luxury living in this spacious 3-BHK apartment located in the heart of Indiranagar. Featuring Italian marble flooring, a modern modular kitchen, and a stunning balcony view.'

  const handleCopy = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(sampleCopy).catch(() => {})
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="bg-[#0F172A] rounded-3xl p-8 sm:p-12 lg:p-14 text-white shadow-xl overflow-hidden relative border border-slate-800">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 flex flex-col items-start">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[#A5E0CB] text-xs font-semibold tracking-wider uppercase mb-5">
                <svg
                  className="w-3.5 h-3.5 text-[#408A71]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                AI-POWERED TOOL
              </div>

              {/* Heading */}
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
                Smart AI Descriptions
              </h2>

              {/* Description */}
              <p className="text-base text-slate-300 leading-relaxed max-w-xl mb-6">
                Turn property details into engaging, professional rental descriptions with AI
                assistance. Save time, attract verified tenants, and present your property more effectively.
              </p>

              {/* Status Note */}
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                <span>Feature Showcase &middot; Available in Property Management Dashboard</span>
              </div>
            </div>

            {/* Right Side — Miniature UI Preview */}
            <div className="lg:col-span-5 w-full">
              <div className="bg-[#1E293B] border border-slate-700/80 rounded-2xl p-5 shadow-2xl relative">
                {/* Window Dots & Status */}
                <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-700/60">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Generated preview
                  </span>
                </div>

                {/* AI Text Output Preview */}
                <p className="text-xs sm:text-sm text-slate-200 font-normal leading-relaxed italic mb-5">
                  &ldquo;{sampleCopy}&rdquo;
                </p>

                {/* Card Action */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#408A71] hover:bg-[#34745C] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        <span>Copy to Listing</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AiFeatureBanner

