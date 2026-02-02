'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen, Lightbulb, Settings, TrendingUp, BarChart3, Target,
  ChevronDown, ChevronRight, ArrowLeft, Play, Upload, Columns2,
  Search, PieChart, AlertTriangle, CheckCircle, Info
} from 'lucide-react'

type Section = 'tutorial' | 'modeling' | 'tips' | 'troubleshooting'

export default function HelpPage() {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<Section>('tutorial')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['step-1']))

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const sections = [
    { id: 'tutorial', label: 'App Tutorial', icon: BookOpen },
    { id: 'modeling', label: 'Understanding the Model', icon: BarChart3 },
    { id: 'tips', label: 'Optimization Tips', icon: Lightbulb },
    { id: 'troubleshooting', label: 'Troubleshooting', icon: AlertTriangle },
  ]

  return (
    <div className="flex flex-col h-screen">
      <header className="h-16 flex items-center justify-between px-8 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-card-hover rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground-muted" />
          </button>
          <h1 className="text-xl font-semibold text-foreground">Help & Documentation</h1>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-border p-4 space-y-1">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as Section)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeSection === section.id
                  ? 'bg-primary text-white'
                  : 'text-foreground-muted hover:bg-card-hover hover:text-foreground'
              }`}
            >
              <section.icon className="w-4 h-4" />
              {section.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-4xl space-y-8">
            {activeSection === 'tutorial' && <TutorialSection expandedItems={expandedItems} toggleItem={toggleItem} />}
            {activeSection === 'modeling' && <ModelingSection expandedItems={expandedItems} toggleItem={toggleItem} />}
            {activeSection === 'tips' && <TipsSection />}
            {activeSection === 'troubleshooting' && <TroubleshootingSection expandedItems={expandedItems} toggleItem={toggleItem} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function TutorialSection({ expandedItems, toggleItem }: { expandedItems: Set<string>; toggleItem: (id: string) => void }) {
  const steps = [
    {
      id: 'step-1',
      title: 'Step 1: Upload Your Data',
      icon: Upload,
      content: (
        <div className="space-y-3">
          <p>Start by uploading your marketing data as a CSV or Excel file. Your data should include:</p>
          <ul className="list-disc list-inside space-y-1 text-foreground-muted">
            <li><strong>Date column</strong> - Weekly or daily dates (weekly recommended)</li>
            <li><strong>Target/KPI column</strong> - Sales, revenue, or conversions</li>
            <li><strong>Media spend columns</strong> - Spend per channel (e.g., TV_Spend, Facebook_Spend)</li>
            <li><strong>Control variables</strong> (optional) - Price, promotions, seasonality indicators</li>
          </ul>
          <div className="p-3 bg-info/10 border border-info/20 rounded-lg">
            <p className="text-sm text-info"><strong>Tip:</strong> Use the demo dataset to explore the app before uploading your own data.</p>
          </div>
        </div>
      )
    },
    {
      id: 'step-2',
      title: 'Step 2: Explore Your Data',
      icon: Search,
      content: (
        <div className="space-y-3">
          <p>Review data quality and understand your data before modeling:</p>
          <ul className="list-disc list-inside space-y-1 text-foreground-muted">
            <li><strong>Summary stats</strong> - Check for missing values and outliers</li>
            <li><strong>Correlations</strong> - High correlations between media channels can cause issues</li>
            <li><strong>Time series</strong> - Visualize trends and seasonality</li>
            <li><strong>Stationarity</strong> - Non-stationary data may need differencing</li>
          </ul>
          <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <p className="text-sm text-warning"><strong>Warning:</strong> If you see high correlations (above 0.8) between media channels, consider combining them or using one as a control.</p>
          </div>
        </div>
      )
    },
    {
      id: 'step-3',
      title: 'Step 3: Map Your Columns',
      icon: Columns2,
      content: (
        <div className="space-y-3">
          <p>Tell the model which columns represent what:</p>
          <ul className="list-disc list-inside space-y-1 text-foreground-muted">
            <li><strong>Date</strong> - The time period column</li>
            <li><strong>Target</strong> - What you want to predict (sales, conversions)</li>
            <li><strong>Media channels</strong> - Your advertising spend columns</li>
            <li><strong>Controls</strong> - Variables that affect sales but are not media</li>
          </ul>
          <p className="text-sm text-foreground-muted">The app will auto-detect columns based on naming patterns, but always verify the suggestions.</p>
        </div>
      )
    },
    {
      id: 'step-4',
      title: 'Step 4: Configure the Model',
      icon: Settings,
      content: (
        <div className="space-y-3">
          <p>Set up model parameters. Key decisions:</p>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-foreground">Model Type</h4>
              <p className="text-sm text-foreground-muted">Log-Log (recommended) gives elasticities directly. Lift-Factor explicitly models decay.</p>
            </div>
            <div>
              <h4 className="font-medium text-foreground">Seasonality</h4>
              <p className="text-sm text-foreground-muted">Set period to 52 for annual patterns in weekly data. Adjust harmonics for pattern complexity.</p>
            </div>
            <div>
              <h4 className="font-medium text-foreground">Adstock</h4>
              <p className="text-sm text-foreground-muted">Models how ad effects carry over time. Digital channels decay fast (0.1-0.3), TV/brand slower (0.4-0.7).</p>
            </div>
            <div>
              <h4 className="font-medium text-foreground">MCMC Settings</h4>
              <p className="text-sm text-foreground-muted">More draws = more accurate but slower. 1000 for testing, 2000+ for production.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'step-5',
      title: 'Step 5: Train the Model',
      icon: Play,
      content: (
        <div className="space-y-3">
          <p>Click Train to fit the Bayesian model. This uses MCMC sampling to estimate parameters.</p>
          <p className="text-foreground-muted">Training time depends on:</p>
          <ul className="list-disc list-inside space-y-1 text-foreground-muted">
            <li>Number of data points</li>
            <li>Number of media channels</li>
            <li>MCMC draws and chains</li>
          </ul>
          <p className="text-sm text-foreground-muted">Typical training: 1-5 minutes for standard settings.</p>
        </div>
      )
    },
    {
      id: 'step-6',
      title: 'Step 6: Analyze Results',
      icon: BarChart3,
      content: (
        <div className="space-y-3">
          <p>Review model outputs across four tabs:</p>
          <div className="space-y-2">
            <div><strong>Overview:</strong> R-squared, MAPE, elasticities, ROI by channel</div>
            <div><strong>Diagnostics:</strong> Convergence checks, residual analysis, posterior predictive</div>
            <div><strong>Attribution:</strong> Response curves, Shapley values, marginal ROI</div>
            <div><strong>Validation:</strong> Holdout metrics (if configured)</div>
          </div>
          <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
            <p className="text-sm text-success"><strong>Good results:</strong> R-squared above 0.7, MAPE below 15%, no divergences, R-hat below 1.05</p>
          </div>
        </div>
      )
    },
    {
      id: 'step-7',
      title: 'Step 7: Budget Planning',
      icon: PieChart,
      content: (
        <div className="space-y-3">
          <p>Optimize and plan your marketing budget allocation:</p>
          <ul className="list-disc list-inside space-y-1 text-foreground-muted">
            <li>Set your total budget or target sales</li>
            <li>Add constraints (min/max per channel)</li>
            <li>Use quick scenarios (-20%, -10%, +10%, +20%)</li>
            <li>Optimize allocation to maximize ROI</li>
            <li>View response curves and waterfall charts</li>
            <li>Compare scenarios and export results</li>
          </ul>
          <p className="text-sm text-foreground-muted">The optimizer uses marginal ROI to shift budget from saturated channels to high-opportunity ones. Save multiple scenarios to compare strategies.</p>
        </div>
      )
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">App Tutorial</h2>
        <p className="text-foreground-muted mt-1">Follow these steps to build your Marketing Mix Model</p>
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={step.id} className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleItem(step.id)}
              className="w-full p-4 flex items-center justify-between hover:bg-card-hover transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium text-foreground">{step.title}</span>
              </div>
              {expandedItems.has(step.id) ? (
                <ChevronDown className="w-5 h-5 text-foreground-muted" />
              ) : (
                <ChevronRight className="w-5 h-5 text-foreground-muted" />
              )}
            </button>
            {expandedItems.has(step.id) && (
              <div className="px-4 pb-4 pt-0 border-t border-border">
                <div className="pt-4 text-sm text-foreground-muted">
                  {step.content}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ModelingSection({ expandedItems, toggleItem }: { expandedItems: Set<string>; toggleItem: (id: string) => void }) {
  const concepts = [
    {
      id: 'loglog',
      title: 'Log-Log Model',
      content: (
        <div className="space-y-3">
          <p>The Log-Log model transforms both sides of the equation:</p>
          <div className="p-3 bg-card rounded-lg font-mono text-sm">
            log(Sales) = intercept + B1*log(Channel1) + B2*log(Channel2) + seasonality + trend
          </div>
          <p><strong>Why use it?</strong> The coefficients (B1, B2, etc.) are directly interpretable as elasticities:</p>
          <ul className="list-disc list-inside space-y-1 text-foreground-muted">
            <li>B = 0.1 means a 10% increase in spend leads to a 1% increase in sales</li>
            <li>Typical media elasticities range from 0.01 to 0.3</li>
            <li>Higher elasticity = more effective channel</li>
          </ul>
        </div>
      )
    },
    {
      id: 'adstock',
      title: 'Adstock (Carryover Effect)',
      content: (
        <div className="space-y-3">
          <p>Advertising effects do not happen instantly - they carry over time. Adstock models this decay:</p>
          <div className="p-3 bg-card rounded-lg font-mono text-sm">
            Adstocked_Spend[t] = Spend[t] + decay * Adstocked_Spend[t-1]
          </div>
          <p><strong>Decay rate interpretation:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-foreground-muted">
            <li><strong>0.1-0.3 (fast decay):</strong> Digital ads, search, social - effects fade within 1-2 weeks</li>
            <li><strong>0.4-0.6 (medium decay):</strong> Display, video - effects last 2-4 weeks</li>
            <li><strong>0.7-0.9 (slow decay):</strong> TV, brand campaigns - effects last months</li>
          </ul>
          <div className="p-3 bg-info/10 border border-info/20 rounded-lg">
            <p className="text-sm text-info"><strong>Tip:</strong> If you are unsure, start with 0.3 for digital and 0.5 for traditional media.</p>
          </div>
        </div>
      )
    },
    {
      id: 'saturation',
      title: 'Saturation (Diminishing Returns)',
      content: (
        <div className="space-y-3">
          <p>Media channels have diminishing returns - doubling spend does not double results. The Hill function models this:</p>
          <div className="p-3 bg-card rounded-lg font-mono text-sm">
            Saturated = Spend^S / (K^S + Spend^S)
          </div>
          <p><strong>Parameters:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-foreground-muted">
            <li><strong>K (half-saturation):</strong> Spend level where you get 50% of max effect. Set near your average spend.</li>
            <li><strong>S (shape):</strong> How sharply returns diminish. 1.0 = gradual, 2.0+ = sharp plateau.</li>
          </ul>
          <p className="text-sm text-foreground-muted">Enable saturation when you suspect a channel is hitting diminishing returns (high spend, flattening response).</p>
        </div>
      )
    },
    {
      id: 'seasonality',
      title: 'Seasonality (Fourier Features)',
      content: (
        <div className="space-y-3">
          <p>Seasonality captures recurring patterns using Fourier terms (sine and cosine waves):</p>
          <ul className="list-disc list-inside space-y-1 text-foreground-muted">
            <li><strong>Period:</strong> Length of one cycle. Use 52 for annual seasonality in weekly data.</li>
            <li><strong>Harmonics:</strong> Number of wave pairs. More harmonics = more complex patterns.</li>
          </ul>
          <p><strong>Recommended settings:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-foreground-muted">
            <li>2 harmonics: Simple seasonal patterns (summer/winter)</li>
            <li>3-4 harmonics: Moderate complexity (quarterly patterns)</li>
            <li>5-6 harmonics: Complex patterns (multiple holidays, events)</li>
          </ul>
        </div>
      )
    },
    {
      id: 'priors',
      title: 'Bayesian Priors',
      content: (
        <div className="space-y-3">
          <p>Priors encode your beliefs about parameter values before seeing data. We use Half-Normal priors for elasticities (positive values only).</p>
          <p><strong>Sigma controls the spread:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-foreground-muted">
            <li><strong>Uninformed (sigma=1.0):</strong> Wide distribution - let the data decide. Use with lots of data (100+ observations).</li>
            <li><strong>Industry (sigma=0.3):</strong> Moderate prior - expects elasticities between 0.01-0.5. Good default choice.</li>
            <li><strong>Conservative (sigma=0.15):</strong> Tight prior - expects small effects. Use for channels you believe are weak.</li>
          </ul>
          <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <p className="text-sm text-warning"><strong>Note:</strong> With limited data, priors have more influence. With lots of data, the data overwhelms the prior.</p>
          </div>
        </div>
      )
    },
    {
      id: 'mcmc',
      title: 'MCMC Sampling',
      content: (
        <div className="space-y-3">
          <p>MCMC (Markov Chain Monte Carlo) is how we estimate the Bayesian model. It generates samples from the posterior distribution.</p>
          <p><strong>Key settings:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-foreground-muted">
            <li><strong>Draws:</strong> Samples per chain. 500 = quick test, 2000 = production, 4000+ = publication quality.</li>
            <li><strong>Chains:</strong> Independent samplers. More chains = better convergence diagnostics. Use 2 for testing, 4 for production.</li>
            <li><strong>Tune:</strong> Warmup samples (discarded). Usually 1000 is sufficient.</li>
          </ul>
          <p><strong>Convergence diagnostics:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-foreground-muted">
            <li><strong>R-hat:</strong> Should be below 1.05. Higher values indicate chains have not converged.</li>
            <li><strong>ESS (Effective Sample Size):</strong> Should be above 400. Lower values mean high autocorrelation.</li>
            <li><strong>Divergences:</strong> Should be 0. Divergences indicate the sampler is struggling.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'metrics',
      title: 'Model Metrics',
      content: (
        <div className="space-y-3">
          <p><strong>Fit metrics:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-foreground-muted">
            <li><strong>R-squared:</strong> Proportion of variance explained. Above 0.7 is good, above 0.85 is excellent.</li>
            <li><strong>MAPE:</strong> Mean Absolute Percentage Error. Below 10% is excellent, below 20% is acceptable.</li>
          </ul>
          <p><strong>Attribution metrics:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-foreground-muted">
            <li><strong>Elasticity:</strong> % change in sales per 1% change in spend. Higher = more effective.</li>
            <li><strong>ROI:</strong> Return per dollar spent. Above 1.0 means positive return.</li>
            <li><strong>Contribution:</strong> Absolute sales attributed to each channel.</li>
            <li><strong>Shapley values:</strong> Fair attribution accounting for channel interactions.</li>
          </ul>
        </div>
      )
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Understanding the Model</h2>
        <p className="text-foreground-muted mt-1">Learn how each component affects your results</p>
      </div>

      <div className="space-y-3">
        {concepts.map(concept => (
          <div key={concept.id} className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleItem(concept.id)}
              className="w-full p-4 flex items-center justify-between hover:bg-card-hover transition-colors"
            >
              <span className="font-medium text-foreground">{concept.title}</span>
              {expandedItems.has(concept.id) ? (
                <ChevronDown className="w-5 h-5 text-foreground-muted" />
              ) : (
                <ChevronRight className="w-5 h-5 text-foreground-muted" />
              )}
            </button>
            {expandedItems.has(concept.id) && (
              <div className="px-4 pb-4 pt-0 border-t border-border">
                <div className="pt-4 text-sm text-foreground-muted">
                  {concept.content}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function TipsSection() {
  const tips = [
    {
      category: 'Improving Model Fit (R-squared)',
      icon: TrendingUp,
      items: [
        'Enable seasonality if your sales have recurring patterns (holidays, summer/winter)',
        'Add trend component if sales are growing or declining over time',
        'Include control variables (price, promotions, distribution) to explain non-media variance',
        'Check for data quality issues - missing values, outliers, or incorrect aggregation',
        'Ensure you have enough data - aim for 52+ weeks (1 year minimum)',
        'If R-squared is very low, your sales may be driven by factors not in the data',
      ]
    },
    {
      category: 'Improving Convergence',
      icon: Target,
      items: [
        'Increase MCMC draws (try 3000-4000)',
        'Increase tune/warmup samples',
        'Use more informative priors (Industry or Conservative preset)',
        'Reduce the number of channels if you have too many with little spend',
        'Check for multicollinearity - highly correlated channels confuse the model',
        'Scale your data appropriately - very large or small values can cause issues',
      ]
    },
    {
      category: 'Getting Realistic Elasticities',
      icon: BarChart3,
      items: [
        'Typical media elasticities range from 0.01 to 0.30',
        'If elasticities are too high (>0.5), use tighter priors (Conservative preset)',
        'If elasticities are negative, check data quality or use Half-Normal priors',
        'Digital channels typically have lower elasticities than TV/brand',
        'New channels may show higher elasticities due to novelty effects',
        'Consider adstock - without it, effects are underestimated',
      ]
    },
    {
      category: 'Channel Configuration',
      icon: Settings,
      items: [
        'Start without saturation, add it only if you see flattening response curves',
        'Use faster decay (0.1-0.3) for performance/digital channels',
        'Use slower decay (0.4-0.7) for brand/awareness channels',
        'Set saturation K near your average or median spend level',
        'If a channel has very low spend, consider removing it or combining with similar channels',
        'Test sensitivity by running models with different adstock values',
      ]
    },
    {
      category: 'Holdout Validation',
      icon: CheckCircle,
      items: [
        'Always use holdout validation to check out-of-sample performance',
        '8-12 weeks is a good holdout period',
        'If holdout MAPE is much worse than training MAPE, the model is overfitting',
        'If holdout R-squared is negative, the model is not generalizing',
        'Consider cross-validation for more robust validation',
      ]
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Optimization Tips</h2>
        <p className="text-foreground-muted mt-1">How to improve your model and get better results</p>
      </div>

      <div className="space-y-6">
        {tips.map((section, i) => (
          <div key={i} className="border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <section.icon className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">{section.category}</h3>
            </div>
            <ul className="space-y-2">
              {section.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2 text-sm text-foreground-muted">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function TroubleshootingSection({ expandedItems, toggleItem }: { expandedItems: Set<string>; toggleItem: (id: string) => void }) {
  const issues = [
    {
      id: 'low-rsquared',
      problem: 'Very low R-squared (below 0.5)',
      solutions: [
        'Enable seasonality - sales often have strong seasonal patterns',
        'Add trend component - check if your sales are trending up or down',
        'Include control variables like price, promotions, or distribution',
        'Check data quality - ensure aggregation is correct (weekly sums, not averages)',
        'Verify target variable - should be total sales, not sales per unit',
        'Consider external factors not in your data (economy, competition)',
      ]
    },
    {
      id: 'no-convergence',
      problem: 'Model does not converge (high R-hat, divergences)',
      solutions: [
        'Increase MCMC draws to 3000-4000',
        'Use more informative priors (Industry or Conservative preset)',
        'Reduce number of channels - remove low-spend or highly correlated ones',
        'Check for multicollinearity in your media variables',
        'Standardize your data if values are very large or very small',
        'Try removing saturation transforms if enabled',
      ]
    },
    {
      id: 'negative-elasticity',
      problem: 'Negative or unrealistic elasticities',
      solutions: [
        'Use Half-Normal priors (default) to enforce positive elasticities',
        'Check for reverse causality - do you spend more when sales are low?',
        'Look for data entry errors or sign issues',
        'Consider if the channel truly has no effect and should be removed',
        'Check correlation with other channels - effects may be attributed incorrectly',
      ]
    },
    {
      id: 'high-elasticity',
      problem: 'Unrealistically high elasticities (above 0.5)',
      solutions: [
        'Use tighter priors (Conservative preset with sigma=0.15)',
        'Enable adstock - without carryover, effects concentrate and inflate',
        'Check for confounding - is spend correlated with promotions or events?',
        'Verify data scale - spend should be in consistent units (e.g., dollars)',
        'Consider if the relationship is actually that strong (new channel, small base)',
      ]
    },
    {
      id: 'flat-curves',
      problem: 'Response curves are flat or linear',
      solutions: [
        'Enable saturation (Hill function) for the channel',
        'Adjust K parameter - set it near your average spend level',
        'Increase S parameter for more pronounced saturation (try 1.5-2.0)',
        'Check if the channel has enough spend variation to detect saturation',
        'Consider if the channel is truly not saturated yet',
      ]
    },
    {
      id: 'holdout-bad',
      problem: 'Poor holdout performance (high MAPE, low R-squared)',
      solutions: [
        'Model may be overfitting - use more regularizing priors',
        'Reduce model complexity - fewer harmonics, simpler saturation',
        'Check if holdout period has unusual events not in training data',
        'Ensure enough training data before holdout period',
        'Try different holdout periods to check robustness',
      ]
    },
    {
      id: 'slow-training',
      problem: 'Training takes too long',
      solutions: [
        'Reduce MCMC draws for initial testing (use 500-1000)',
        'Reduce number of chains to 2',
        'Reduce number of media channels if possible',
        'Disable saturation transforms (they add complexity)',
        'Aggregate data to weekly if using daily data',
      ]
    },
    {
      id: 'blank-charts',
      problem: 'Charts or results not displaying',
      solutions: [
        'Check browser console for JavaScript errors (F12)',
        'Ensure the backend API is running on port 8000',
        'Try refreshing the page with Cmd+Shift+R (hard refresh)',
        'Clear browser cache and cookies',
        'Check that model training completed successfully',
      ]
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Troubleshooting</h2>
        <p className="text-foreground-muted mt-1">Common issues and how to fix them</p>
      </div>

      <div className="space-y-3">
        {issues.map(issue => (
          <div key={issue.id} className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleItem(issue.id)}
              className="w-full p-4 flex items-center justify-between hover:bg-card-hover transition-colors"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <span className="font-medium text-foreground">{issue.problem}</span>
              </div>
              {expandedItems.has(issue.id) ? (
                <ChevronDown className="w-5 h-5 text-foreground-muted" />
              ) : (
                <ChevronRight className="w-5 h-5 text-foreground-muted" />
              )}
            </button>
            {expandedItems.has(issue.id) && (
              <div className="px-4 pb-4 pt-0 border-t border-border">
                <div className="pt-4">
                  <p className="text-sm font-medium text-foreground mb-2">Solutions:</p>
                  <ul className="space-y-1.5">
                    {issue.solutions.map((solution, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground-muted">
                        <span className="text-primary mt-1">•</span>
                        {solution}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
