"""Core modeling modules for MMM."""

from .transformations import (
    geometric_adstock,
    geometric_adstock_matrix,
    hill_function,
    hill_function_scaled,
    log_transform,
    inverse_log_transform,
)
from .models import (
    build_loglog_model,
    build_lift_model,
    fit_model,
    compute_model_diagnostics,
)
from .attribution import (
    compute_channel_contributions_loglog,
    compute_shapley_values,
    decompose_sales,
    calculate_roi,
)
from .optimization import (
    calculate_marginal_roi_loglog,
    optimize_budget_marginal_roi,
    calculate_expected_lift,
    create_scenario,
    compare_scenarios,
)

__all__ = [
    "geometric_adstock",
    "geometric_adstock_matrix",
    "hill_function",
    "hill_function_scaled",
    "log_transform",
    "inverse_log_transform",
    "build_loglog_model",
    "build_lift_model",
    "fit_model",
    "compute_model_diagnostics",
    "compute_channel_contributions_loglog",
    "compute_shapley_values",
    "decompose_sales",
    "calculate_roi",
    "calculate_marginal_roi_loglog",
    "optimize_budget_marginal_roi",
    "calculate_expected_lift",
    "create_scenario",
    "compare_scenarios",
]
