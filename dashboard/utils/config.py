"""Configuration constants and defaults for the MMM Dashboard."""

# Default model parameters
DEFAULT_PARAMS = {
    "aggregation": "Weekly",
    "fourier_period": 52,
    "fourier_harmonics": 3,
    "adstock_decay_prior_mean": 0.5,
    "adstock_decay_prior_sd": 0.2,
    "mcmc_draws": 2000,
    "mcmc_tune": 1000,
    "mcmc_chains": 4,
    "mcmc_target_accept": 0.9,
}

# Budget optimization defaults
OPTIMIZATION_DEFAULTS = {
    "min_budget_pct": 0.10,
    "max_budget_pct": 0.80,
    "optimization_method": "marginal_roi",
}

# Chart colors matching the design system
CHART_COLORS = {
    "primary": "#4F46E5",
    "chart_1": "#4F46E5",  # Indigo
    "chart_2": "#06B6D4",  # Cyan
    "chart_3": "#10B981",  # Emerald
    "chart_4": "#F59E0B",  # Amber
    "chart_5": "#EC4899",  # Pink
    "chart_6": "#8B5CF6",  # Purple
    "success": "#10B981",
    "warning": "#F59E0B",
    "error": "#EF4444",
    "info": "#3B82F6",
}

# Dark theme colors
THEME_COLORS = {
    "background": "#0F172A",
    "background_secondary": "#1E293B",
    "card": "#1E293B",
    "foreground": "#F1F5F9",
    "foreground_muted": "#94A3B8",
    "border": "#334155",
}

# Supported file formats
SUPPORTED_FILE_TYPES = ["csv", "xlsx", "xls"]

# Column type hints for auto-detection
DATE_COLUMN_HINTS = ["date", "week", "month", "day", "time", "period"]
TARGET_COLUMN_HINTS = ["sales", "revenue", "conversions", "kpi", "target", "y"]
SPEND_COLUMN_HINTS = ["spend", "cost", "budget", "investment", "media"]
