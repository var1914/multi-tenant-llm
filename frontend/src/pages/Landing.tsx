import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import {
  ArrowRightIcon,
  CheckIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'

// TokenTrail Logo Component
function TokenTrailLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Trail path */}
      <path
        d="M8 32C8 32 12 28 16 24C20 20 24 16 28 12C32 8 36 8 36 8"
        stroke="url(#trail-gradient)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Token circles along the trail */}
      <circle cx="10" cy="30" r="4" fill="#22c55e" />
      <circle cx="20" cy="20" r="3.5" fill="#eab308" />
      <circle cx="30" cy="10" r="3" fill="#ef4444" />
      <defs>
        <linearGradient id="trail-gradient" x1="8" y1="32" x2="36" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22c55e" />
          <stop offset="0.5" stopColor="#eab308" />
          <stop offset="1" stopColor="#ef4444" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// Animated token counter showing real savings
function TokenCounter() {
  const [tokens, setTokens] = useState(0)
  const [savings, setSavings] = useState(0)
  const targetTokens = 2847293
  const targetSavings = 4829

  useEffect(() => {
    const duration = 2000
    const steps = 60
    const tokenStep = targetTokens / steps
    const savingsStep = targetSavings / steps
    let current = 0

    const interval = setInterval(() => {
      current++
      if (current <= steps) {
        setTokens(Math.floor(tokenStep * current))
        setSavings(Math.floor(savingsStep * current))
      } else {
        clearInterval(interval)
      }
    }, duration / steps)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-8 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-zinc-400">Tokens tracked:</span>
        <span className="font-mono text-white font-medium">{tokens.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-zinc-400">Saved today:</span>
        <span className="font-mono text-green-400 font-medium">${savings.toLocaleString()}</span>
      </div>
    </div>
  )
}

// Interactive terminal showing real usage
function InteractiveTerminal() {
  const [step, setStep] = useState(0)
  const [typing, setTyping] = useState(true)
  const terminalRef = useRef<HTMLDivElement>(null)

  const steps = [
    { type: 'command', text: 'npm install openai' },
    { type: 'output', text: 'added 3 packages in 1.4s' },
    { type: 'command', text: 'node app.js' },
    { type: 'output', text: '✓ Connected to TokenTrail proxy' },
    { type: 'output', text: '✓ Processing request for customer_abc...' },
    { type: 'output', text: '  → Model: gpt-4-turbo' },
    { type: 'output', text: '  → Routed to: gpt-3.5-turbo (same quality)' },
    { type: 'output', text: '  → 847 tokens ($0.0023 vs $0.0254)' },
    { type: 'output', text: '  → Saved: $0.0231 (91%)', className: 'text-green-400' },
    { type: 'output', text: '', className: 'text-green-400 font-medium', fullText: '✓ Request completed in 245ms' },
  ]

  useEffect(() => {
    if (step < steps.length) {
      const delay = steps[step].type === 'command' ? 1500 : 800
      const timer = setTimeout(() => {
        setStep(s => s + 1)
      }, delay)
      return () => clearTimeout(timer)
    }
  }, [step])

  return (
    <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden shadow-2xl">
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900/50 border-b border-zinc-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-zinc-500 text-sm ml-2 font-mono">terminal</span>
      </div>

      {/* Terminal content */}
      <div ref={terminalRef} className="p-4 font-mono text-sm h-64 overflow-hidden">
        {steps.slice(0, step).map((s, i) => (
          <div key={i} className={`mb-1 ${s.className || ''}`}>
            {s.type === 'command' ? (
              <div className="flex items-center gap-2">
                <span className="text-green-400">$</span>
                <span className="text-zinc-300">{s.text}</span>
              </div>
            ) : (
              <div className="text-zinc-400 pl-4">{s.fullText || s.text}</div>
            )}
          </div>
        ))}
        {step < steps.length && (
          <div className="flex items-center gap-2">
            {steps[step].type === 'command' && <span className="text-green-400">$</span>}
            <span className="w-2 h-4 bg-zinc-400 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  )
}

// How it works section with actual flow
function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Point to TokenTrail proxy',
      description: 'Use your existing OpenAI/Anthropic SDK. Just change the baseURL to TokenTrail.',
      code: `const client = new OpenAI({
  baseURL: 'https://your-proxy.tokentrail.io',
  apiKey: 'tt_live_...'
})`,
    },
    {
      number: '02',
      title: 'See every token',
      description: 'Real-time visibility into costs per customer, feature, and model. No more surprise bills.',
      metric: { label: 'Avg. visibility delay', value: '<50ms' },
    },
    {
      number: '03',
      title: 'Optimize automatically',
      description: 'Smart routing sends simple queries to cheaper models. Same results, 40-60% less cost.',
      metric: { label: 'Avg. cost reduction', value: '47%' },
    },
  ]

  return (
    <section className="py-24 bg-zinc-950">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Three steps. Full control.
          </h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Stop guessing what your AI features cost. Start knowing.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className="relative p-6 bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              <div className="text-5xl font-bold text-zinc-800 mb-4">{step.number}</div>
              <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-zinc-400 text-sm mb-4">{step.description}</p>

              {step.code && (
                <pre className="text-xs bg-zinc-950 p-3 rounded-lg border border-zinc-800 overflow-x-auto">
                  <code className="text-zinc-300">{step.code}</code>
                </pre>
              )}

              {step.metric && (
                <div className="mt-4 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="text-xs text-zinc-400 mb-1">{step.metric.label}</div>
                  <div className="text-2xl font-bold text-green-400">{step.metric.value}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Key Features Section
function KeyFeatures() {
  const features = [
    {
      title: 'Budget Limits & Auto-Blocking',
      description: 'Set monthly spending caps per customer. Automatically block requests when limits are exceeded to prevent runaway costs.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      highlight: true,
    },
    {
      title: 'Smart Model Routing',
      description: 'Automatically route simple queries to cheaper models like GPT-3.5, keep complex ones on GPT-4. Save 40-60% instantly.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      highlight: false,
    },
    {
      title: 'Per-Customer Tracking',
      description: 'See exactly what each customer costs you. Track usage by customer, feature, model, and time period.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      highlight: false,
    },
    {
      title: 'Real-Time Alerts',
      description: 'Get notified when customers hit 80% of their budget. Set up Slack or email alerts for anomalies.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
      highlight: false,
    },
  ]

  return (
    <section className="py-24 bg-zinc-900">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Everything you need to control LLM costs
          </h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Stop overspending on AI. Track every token, route intelligently, and protect your budget.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className={`p-6 rounded-xl border transition-all ${
                feature.highlight
                  ? 'bg-green-500/5 border-green-500/20 ring-1 ring-green-500/10'
                  : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${
                  feature.highlight ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {feature.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {feature.title}
                    {feature.highlight && (
                      <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">
                        New
                      </span>
                    )}
                  </h3>
                  <p className="text-zinc-400 text-sm">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Real customer problems we solve
function ProblemSolution() {
  const problems = [
    {
      problem: '"We had no idea Feature X was costing us $12k/month until it was too late."',
      solution: 'Real-time cost attribution per feature and customer.',
      icon: '💸',
    },
    {
      problem: '"A power user maxed out our API credits and we had no way to stop them."',
      solution: 'Set monthly spending limits per customer with automatic request blocking.',
      icon: '🛡️',
    },
    {
      problem: '"Our AI agent ran wild and burned through our entire monthly budget in 2 hours."',
      solution: 'Per-workflow budgets with automatic circuit breakers.',
      icon: '🔥',
    },
    {
      problem: '"We\'re using GPT-4 for everything, even simple tasks."',
      solution: 'Smart routing: right model for each request complexity.',
      icon: '🎯',
    },
  ]

  return (
    <section className="py-24 bg-zinc-900/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Sound familiar?
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {problems.map((item, i) => (
            <div key={i} className="p-6 bg-zinc-800/40 rounded-xl border border-zinc-700">
              <div className="flex items-start gap-4">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <p className="text-zinc-300 italic mb-3">{item.problem}</p>
                  <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                    <CheckIcon className="w-4 h-4" />
                    {item.solution}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Pricing with actual value props
function Pricing() {
  const tiers = [
    {
      name: 'Starter',
      price: 'Free',
      period: 'forever',
      description: 'For side projects and experimentation',
      features: [
        '10,000 tracked requests/month',
        'Basic cost dashboard',
        '7-day data retention',
        'Community Discord support',
      ],
      cta: 'Start Free',
      highlighted: false,
    },
    {
      name: 'Pro',
      price: '$29',
      period: '/month',
      description: 'For production applications',
      features: [
        '500,000 tracked requests/month',
        'Smart routing (save 40-60%)',
        'Customer usage limits & blocking',
        'Per-customer billing',
        '90-day data retention',
        'Slack/email alerts',
        'Priority support',
      ],
      cta: 'Start 30-Day Trial',
      highlighted: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For scaling teams',
      features: [
        'Unlimited requests',
        'Custom model routing rules',
        'SSO & audit logs',
        'Dedicated account manager',
        'SLA guarantee',
        'On-prem deployment option',
      ],
      cta: 'Talk to Sales',
      highlighted: false,
    },
  ]

  return (
    <section id="pricing" className="py-24 bg-zinc-950">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Pricing that makes sense
          </h2>
          <p className="text-zinc-400 text-lg">
            Start free. Upgrade when TokenTrail pays for itself (usually week 1).
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative p-6 rounded-xl border transition-all ${
                tier.highlighted
                  ? 'bg-zinc-900 border-green-500/50 ring-1 ring-green-500/20'
                  : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 rounded-full text-black text-xs font-semibold">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-1">{tier.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">{tier.price}</span>
                  <span className="text-zinc-500 text-sm">{tier.period}</span>
                </div>
                <p className="text-zinc-500 text-sm mt-1">{tier.description}</p>
              </div>

              <ul className="space-y-3 mb-6">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <CheckIcon className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-zinc-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/register"
                className={`block w-full py-2.5 rounded-lg font-medium text-center text-sm transition-all ${
                  tier.highlighted
                    ? 'bg-green-500 hover:bg-green-400 text-black'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Main Landing Page
export default function Landing() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <TokenTrailLogo className="w-8 h-8" />
              <span className="text-xl font-bold">TokenTrail</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <a href="#how-it-works" className="text-zinc-400 hover:text-white text-sm transition-colors">
                How it works
              </a>
              <a href="#pricing" className="text-zinc-400 hover:text-white text-sm transition-colors">
                Pricing
              </a>
              <a href="https://docs.tokentrail.dev" className="text-zinc-400 hover:text-white text-sm transition-colors">
                Docs
              </a>
            </div>

            <div className="flex items-center gap-4">
              <Link to="/login" className="text-zinc-400 hover:text-white text-sm transition-colors">
                Sign in
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 bg-white text-black rounded-lg font-medium text-sm hover:bg-zinc-200 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-sm mb-6">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                Now in public beta
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                Follow every token.
                <br />
                <span className="text-zinc-500">Cut costs in half.</span>
              </h1>

              <p className="text-lg text-zinc-400 mb-8 max-w-lg">
                Track LLM costs per customer. Set spending limits with automatic blocking.
                Smart routing saves 40-60%. No SDK needed.
              </p>

              <div className="flex flex-wrap gap-4 mb-8">
                <Link
                  to="/register"
                  className="group inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg font-semibold hover:bg-zinc-200 transition-colors"
                >
                  Start Free
                  <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-lg font-semibold border border-zinc-800 hover:bg-zinc-800 transition-colors"
                >
                  <PlayIcon className="w-4 h-4" />
                  See how it works
                </a>
              </div>

              <TokenCounter />
            </div>

            {/* Right: Terminal */}
            <div className="lg:pl-8">
              <InteractiveTerminal />
            </div>
          </div>
        </div>
      </section>

      {/* Logos / Social Proof */}
      <section className="py-12 border-y border-zinc-900">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-zinc-600 text-sm mb-6">
            Trusted by teams building with AI
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-4 opacity-50">
            {/* Placeholder logos - replace with actual customer logos */}
            <span className="text-zinc-500 font-semibold">OpenAI Partners</span>
            <span className="text-zinc-500 font-semibold">YC Companies</span>
            <span className="text-zinc-500 font-semibold">AI Startups</span>
            <span className="text-zinc-500 font-semibold">Enterprise Teams</span>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <div id="how-it-works">
        <HowItWorks />
      </div>

      {/* Key Features */}
      <KeyFeatures />

      {/* Problem/Solution */}
      <ProblemSolution />

      {/* Key Metrics */}
      <section className="py-24 bg-zinc-950 border-y border-zinc-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">47%</div>
              <div className="text-zinc-500 text-sm">Avg. cost reduction</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">&lt;50ms</div>
              <div className="text-zinc-500 text-sm">Tracking latency</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">5 min</div>
              <div className="text-zinc-500 text-sm">Integration time</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">99.9%</div>
              <div className="text-zinc-500 text-sm">Uptime SLA</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <Pricing />

      {/* Final CTA */}
      <section className="py-24 bg-black">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Stop overpaying for AI.
          </h2>
          <p className="text-zinc-400 text-lg mb-8">
            Join the beta. Get 30 days of Pro free.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black rounded-lg font-semibold text-lg hover:bg-zinc-200 transition-colors"
          >
            Get Started Free
            <ArrowRightIcon className="w-5 h-5" />
          </Link>
          <p className="text-zinc-600 text-sm mt-4">No credit card required</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-zinc-900 bg-black">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <TokenTrailLogo className="w-6 h-6" />
              <span className="font-semibold">TokenTrail</span>
            </div>

            <div className="flex items-center gap-8 text-sm text-zinc-500">
              <a href="#" className="hover:text-white transition-colors">Docs</a>
              <a href="#" className="hover:text-white transition-colors">Blog</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
            </div>

            <div className="flex items-center gap-4">
              <a href="https://twitter.com/tokentrail" className="text-zinc-500 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="https://github.com/tokentrail" className="text-zinc-500 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-zinc-900 text-center text-zinc-600 text-sm">
            © 2025 TokenTrail. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
