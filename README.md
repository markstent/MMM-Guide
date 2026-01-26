# Marketing Mix Modelling - Complete Example

A practical implementation of Marketing Mix Modelling (MMM) using Bayesian methods, based on the concepts from [Marketing Mix Modelling: The Complete Guide](MMM_Complete_Guide_v7.docx) by Mark Stent.

## About This Project

The accompanying guide was written to incorporate as many MMM concepts as possible into a single resource. However, it's important to note:

- **Not exhaustive**: The guide doesn't cover every aspect of MMM - it's a comprehensive starting point, not the final word
- **Bayesian focus**: This implementation uses Bayesian methods exclusively. There are other valid approaches (frequentist regression, machine learning methods, etc.) that are not covered here
- **Two implementations**: This repository includes both additive and multiplicative model specifications, demonstrating different approaches to MMM

The goal is to provide a solid foundation for understanding and implementing Bayesian MMM, which you can then adapt to your specific needs.

## Notebooks

| Notebook | Model Type | Description |
|----------|------------|-------------|
| `mmm_complete_example.ipynb` | **Additive** | Standard MMM: `Sales = Baseline + Media_Effects + Controls` |
| `mmm_multiplicative_example.ipynb` | **Multiplicative** | Log-log and lift-factor models with Shapley decomposition |

### When to Use Each

- **Additive Model**: Simpler interpretation, straightforward decomposition, works well for most cases
- **Multiplicative Model**: Better when channels interact strongly, coefficients are elasticities, requires Shapley values for attribution

## Dataset

This project uses the [Multi-Region Marketing Mix Modeling Dataset](https://figshare.com/articles/dataset/Multi-Region_Marketing_Mix_Modeling_MMM_Dataset_for_Several_eCommerce_Brands/25314841) from Figshare, which contains e-commerce marketing data across multiple brands and channels.

## Topics Covered

### Additive Model (`mmm_complete_example.ipynb`)

### Part I: Data Foundations
- Loading and exploring marketing data
- Selecting appropriate data granularity (weekly aggregation)
- Exploratory data analysis

### Part II: Data Preprocessing
- Handling missing values
- Identifying and handling outliers
- Scaling variables for modelling
- Creating derived variables

### Part III: Multicollinearity Analysis
- Correlation matrix between channels
- Interpreting correlation levels
- Strategies for handling high correlation

### Part IV: Media Transformations
- **Adstock (Carryover Effects)**: Geometric adstock transformation
- **Saturation (Diminishing Returns)**: Hill function implementation
- Complete transformation pipeline

### Part V: Bayesian Model Building
- Prior specification (informed by domain knowledge)
- Complete model structure in PyMC
- MCMC sampling

### Part VI: Convergence Diagnostics
- R-hat interpretation
- Effective Sample Size (ESS)
- Trace plot analysis

### Part VII: Model Validation
- In-sample fit (R-squared, MAPE)
- Residual analysis
- Posterior predictive checks
- LOO-CV (Leave-One-Out Cross-Validation)

### Part VIII: Results Analysis
- Response curves with uncertainty
- ROI calculation with credible intervals
- Sales decomposition
- Channel contribution analysis

### Part IX: Budget Optimisation
- Marginal ROI calculation
- Optimal budget allocation
- Constraint handling

### Multiplicative Model (`mmm_multiplicative_example.ipynb`)

Covers the same data preparation as the additive model, plus:

- **Log-Log Specification**: Elasticity-based model where coefficients represent % change
- **Lift-Factor Specification**: Multiplicative lifts from baseline with natural interactions
- **Shapley Value Decomposition**: Fair attribution for multiplicative models
- **Model Comparison**: Side-by-side comparison of both multiplicative approaches
- **Budget Optimization**: Allocation optimization using elasticities

Key differences from additive:
```
Additive:       Sales = Baseline + b1*X1 + b2*X2
Log-Log:        log(Sales) = a + b1*log(X1) + b2*log(X2)
Lift-Factor:    Sales = Baseline * (1 + lift_1) * (1 + lift_2)
```

## Setup

### Prerequisites
- Python 3.11+
- [uv](https://github.com/astral-sh/uv) package manager

### Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd MMM-guide
```

2. Install dependencies using uv:
```bash
uv sync
```

3. Start Jupyter Lab:
```bash
uv run jupyter lab
```

4. Open `mmm_complete_example.ipynb` and run the cells

### Dependencies

Key packages used:
- **PyMC**: Bayesian modelling framework
- **PyMC-Marketing**: MMM-specific extensions
- **ArviZ**: Bayesian diagnostics and visualization
- **Pandas/NumPy**: Data manipulation
- **Matplotlib/Seaborn/Plotly**: Visualization

## Key Concepts

### The MMM Equation (Additive)
```
Sales = Baseline + Trend + Seasonality + Media_Effects + Noise
```

### The MMM Equation (Multiplicative)
```
Sales = Baseline * (1 + TV_lift) * (1 + Digital_lift) * Seasonality * exp(Noise)
```
Or in log-log form:
```
log(Sales) = alpha + elasticity_TV * log(TV) + elasticity_Digital * log(Digital) + ...
```

### Adstock Transformation
Models how advertising effects persist over time:
```
Adstock(t) = Spend(t) + λ × Adstock(t-1)
```

### Hill Saturation Function
Models diminishing returns:
```
Response = x^S / (K^S + x^S)
```

Where:
- **K**: Half-saturation point (spend level at 50% effect)
- **S**: Shape parameter (controls curve steepness)

## References

- Mark Stent, [Marketing Mix Modelling: The Complete Guide](MMM_Complete_Guide_v7.docx)
- [Figshare Dataset](https://figshare.com/articles/dataset/Multi-Region_Marketing_Mix_Modeling_MMM_Dataset_for_Several_eCommerce_Brands/25314841)
- [PyMC Documentation](https://www.pymc.io/)
- [PyMC-Marketing Documentation](https://www.pymc-marketing.io/)
