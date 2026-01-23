import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  ArrowRightIcon,
  CheckIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'
import PricingCalculator from '../components/landing/PricingCalculator'

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

// Feature highlights below hero CTA
function FeatureHighlights() {
  return (
    <div className="flex flex-wrap items-center gap-6 text-sm text-zinc-400">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>No SDK required</span>
      </div>
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>Works with any LLM</span>
      </div>
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>Free tier available</span>
      </div>
    </div>
  )
}

// Smart Routing Visualization - shows how queries route to different models
function SmartRoutingVisualizer() {
  const [activeQuery, setActiveQuery] = useState(0)

  const queries = [
    { text: '"What is 2+2?"', complexity: 'simple', model: 'GPT-4o-mini', cost: '$0.0006', savedPercent: '94%' },
    { text: '"Explain quantum physics"', complexity: 'complex', model: 'GPT-4o', cost: '$0.012', savedPercent: '0%' },
    { text: '"Translate: Hello"', complexity: 'simple', model: 'Claude Haiku', cost: '$0.0003', savedPercent: '96%' },
    { text: '"Debug this React code..."', complexity: 'complex', model: 'Claude Sonnet', cost: '$0.015', savedPercent: '0%' },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveQuery(q => (q + 1) % queries.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const current = queries[activeQuery]
  const isSimple = current.complexity === 'simple'

  return (
    <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden shadow-2xl p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-zinc-400 text-sm">Smart Routing Active</span>
      </div>

      {/* Flow visualization */}
      <div className="relative">
        {/* Incoming query */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-xs text-zinc-500 mb-1">Incoming Query</div>
            <div className="text-sm text-zinc-300 font-mono truncate animate-pulse">
              {current.text}
            </div>
          </div>
        </div>

        {/* Arrow down + analysis */}
        <div className="flex items-center gap-3 ml-4 mb-6">
          <div className="w-0.5 h-8 bg-gradient-to-b from-zinc-700 to-zinc-800" />
          <div className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-500 ${
            isSimple
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}>
            {isSimple ? '✓ Simple query detected' : '⚡ Complex query detected'}
          </div>
        </div>

        {/* Routing paths */}
        <div className="grid grid-cols-2 gap-4">
          {/* Budget models */}
          <div className={`p-4 rounded-lg border transition-all duration-500 ${
            isSimple
              ? 'bg-green-500/5 border-green-500/30 ring-2 ring-green-500/20'
              : 'bg-zinc-900/50 border-zinc-800 opacity-50'
          }`}>
            <div className="text-xs text-zinc-500 mb-2">Budget Models</div>
            <div className="space-y-1.5">
              <div className="text-xs text-zinc-400">GPT-4o-mini</div>
              <div className="text-xs text-zinc-400">Claude Haiku</div>
              <div className="text-xs text-zinc-400">Gemini Flash</div>
            </div>
            {isSimple && (
              <div className="mt-3 flex items-center gap-1 text-green-400 text-xs font-medium">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                Routed here
              </div>
            )}
          </div>

          {/* Premium models */}
          <div className={`p-4 rounded-lg border transition-all duration-500 ${
            !isSimple
              ? 'bg-amber-500/5 border-amber-500/30 ring-2 ring-amber-500/20'
              : 'bg-zinc-900/50 border-zinc-800 opacity-50'
          }`}>
            <div className="text-xs text-zinc-500 mb-2">Premium Models</div>
            <div className="space-y-1.5">
              <div className="text-xs text-zinc-400">GPT-4o</div>
              <div className="text-xs text-zinc-400">Claude Sonnet</div>
              <div className="text-xs text-zinc-400">Gemini Pro</div>
            </div>
            {!isSimple && (
              <div className="mt-3 flex items-center gap-1 text-amber-400 text-xs font-medium">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                Routed here
              </div>
            )}
          </div>
        </div>

        {/* Result */}
        <div className="mt-6 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Routed to</div>
              <div className="text-sm font-medium text-white">{current.model}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-zinc-500 mb-1">Cost</div>
              <div className="text-sm font-mono text-white">{current.cost}</div>
            </div>
            {isSimple && (
              <div className="text-right">
                <div className="text-xs text-zinc-500 mb-1">Saved</div>
                <div className="text-sm font-mono text-green-400">{current.savedPercent}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Query indicator dots */}
      <div className="flex justify-center gap-2 mt-6">
        {queries.map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              i === activeQuery ? 'bg-white' : 'bg-zinc-700'
            }`}
          />
        ))}
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
  baseURL: 'https://api.tokentrailapp.com/v1',
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
      metric: { label: 'Potential savings', value: '40-60%' },
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
          {steps.map((step) => (
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
              <a href="#calculator" className="text-zinc-400 hover:text-white text-sm transition-colors">
                Calculator
              </a>
              <a href="#pricing" className="text-zinc-400 hover:text-white text-sm transition-colors">
                Pricing
              </a>
              <a href="https://docs.tokentrailapp.com" className="text-zinc-400 hover:text-white text-sm transition-colors">
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

              <FeatureHighlights />
            </div>

            {/* Right: Smart Routing Demo */}
            <div className="lg:pl-8">
              <SmartRoutingVisualizer />
            </div>
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

      {/* Pricing Calculator */}
      <div id="calculator">
        <PricingCalculator />
      </div>

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

          </div>

          <div className="mt-8 pt-8 border-t border-zinc-900 text-center text-zinc-600 text-sm">
            © 2026 TokenTrail. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
